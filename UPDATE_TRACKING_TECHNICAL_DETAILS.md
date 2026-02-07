# Update Tracking - Technical Implementation Details

## Architecture Overview

The update tracking system works through a chain of responsibility:

```
XblClient ? UpdateService ? Program.cs ? PowerShell Script ? Pipeline Variables ? Conditional Steps
```

## Data Flow

### 1. XblClient.Update()
**Returns**: `UpdateResult` record

**Process**:
1. Calls `UpdateTitles()` ? Returns (AchievementTitles, Xuid, Inserted, Updated)
2. Calls `UpdateAchievements()` for each title group ? Returns (Inserted, Updated)
3. Calls `UpdateStats()` ? Returns (Inserted, Updated)
4. Accumulates all counts into `UpdateResult`

**Key Implementation**:
```csharp
var result = new UpdateResult();
// ... after UpdateTitles
result = result with { TitlesInserted = ..., TitlesUpdated = ... };
// ... after UpdateAchievements
result = result with { 
    AchievementsInserted = result.AchievementsInserted + achievementsResult.Inserted,
    AchievementsUpdated = result.AchievementsUpdated + achievementsResult.Updated
};
return result;
```

### 2. UpdateService.RunAsync()
**Returns**: Exit code (0, 1, or 2)

**Process**:
1. Calls `XblClient.Update()` and captures `UpdateResult`
2. Logs detailed summary of database changes
3. Calls `DownloadAndUploadImagesAsync()` and captures image counts
4. Calculates `totalChanges = UpdateResult.TotalChanges + image counts`
5. Returns exit code based on totalChanges

**Decision Logic**:
```csharp
if (totalChanges == 0)
{
    _logger.LogInformation("No new data found. Skipping deployment.");
    return 2; // Skip deployment
}
return 0; // Proceed with deployment
```

### 3. Program.cs
**Returns**: Exit code from UpdateService

**Simple Pass-Through**:
```csharp
return await updateService.RunAsync();
```

### 4. PowerShell Script (Pipeline Step 6)
**Sets**: Output variable `HasUpdates`

**Logic**:
```powershell
& $exePath $apiKey $dataFolder $blobConnectionString 
$exitCode = $LASTEXITCODE

if ($exitCode -eq 2) {
    Write-Host "##[warning]No new data found. Skipping deployment."
    Write-Host "##vso[task.setvariable variable=HasUpdates;isOutput=true]false"
    exit 0  # Don't fail the pipeline
}
elseif ($exitCode -ne 0) {
    Write-Error "Xbl.Web.Update failed with exit code: $exitCode"
    exit $exitCode  # Fail the pipeline
}
else {
    Write-Host "Xbl.Web.Update completed successfully with new data"
    Write-Host "##vso[task.setvariable variable=HasUpdates;isOutput=true]true"
}
```

### 5. Pipeline Conditional Steps
**Checks**: `RunUpdate.HasUpdates` variable

**Template Usage**:
```yaml
- template: pipeline-templates/upload-database.yml
  parameters:
    condition: eq(variables['RunUpdate.HasUpdates'], 'true')
```

**Template Implementation**:
```yaml
# In template file
parameters:
- name: condition
  type: string
  default: 'true'

steps:
- task: SomeTask@2
  condition: ${{ parameters.condition }}
```

### 6. Deployment Job
**Checks**: Output variable from build job

**Syntax**:
```yaml
deployment: DeployWebApp
dependsOn: UpdateAndBuild
condition: and(succeeded(), eq(dependencies.UpdateAndBuild.outputs['UpdateAndBuild.RunUpdate.HasUpdates'], 'true'))
```

## Method Signature Changes

### Before
```csharp
// IXblClient.cs
Task<int> Update();

// XblClient.cs
public async Task<int> Update() { ... }
private async Task<AchievementTitles> UpdateTitles(...) { ... }
private static async Task UpdateAchievements(...) { ... }
private async Task UpdateStats(...) { ... }

// UpdateService.cs
private async Task DownloadAndUploadImagesAsync() { ... }
private async Task DownloadTitleImagesAsync(...) { ... }
private async Task DownloadAchievementImagesAsync(...) { ... }
```

### After
```csharp
// IXblClient.cs
Task<UpdateResult> Update();

public record UpdateResult
{
    public int TitlesInserted { get; init; }
    public int TitlesUpdated { get; init; }
    public int AchievementsInserted { get; init; }
    public int AchievementsUpdated { get; init; }
    public int StatsInserted { get; init; }
    public int StatsUpdated { get; init; }
    public int TotalChanges => TitlesInserted + TitlesUpdated + 
                                AchievementsInserted + AchievementsUpdated + 
                                StatsInserted + StatsUpdated;
}

// XblClient.cs
public async Task<UpdateResult> Update() { ... }
private async Task<(AchievementTitles Titles, string Xuid, int Inserted, int Updated)> UpdateTitles(...) { ... }
private static async Task<(int Inserted, int Updated)> UpdateAchievements(...) { ... }
private async Task<(int Inserted, int Updated)> UpdateStats(...) { ... }

// UpdateService.cs
private async Task<(int TitleImages, int AchievementImages)> DownloadAndUploadImagesAsync() { ... }
private async Task<int> DownloadTitleImagesAsync(...) { ... }
private async Task<int> DownloadAchievementImagesAsync(...) { ... }
```

## Counting Implementation Pattern

All update methods follow this pattern:

```csharp
private async Task<(int Inserted, int Updated)> UpdateXxx(...)
{
    // Get existing records
    var headers = (await repository.GetHeaders()).ToDictionary(...);
    
    // Get new records from API
    var newRecords = ...;
    
    // Calculate inserts (not in headers)
    var toInsert = newRecords.Where(r => !headers.ContainsKey(r.Id)).ToArray();
    await repository.BulkInsert(toInsert);
    
    // Calculate updates (in headers, but changed)
    var toUpdate = newRecords.Where(r => headers.ContainsKey(r.Id) && changed).ToArray();
    await repository.BulkUpdate(toUpdate);
    
    return (toInsert.Length, toUpdate.Length);
}
```

## Error Handling

### XblClient
- Throws `HttpRequestException` on API errors
- Logs error and rethrows (no longer returns error code)

### UpdateService
- Catches all exceptions in `RunAsync()`
- Logs error with full exception details
- Returns exit code 1

### Pipeline
- Exit code 1 ? Task fails ? Pipeline stops
- Exit code 2 ? Task succeeds ? Pipeline continues but skips deployment
- Exit code 0 ? Task succeeds ? Pipeline continues with deployment

## Variable Naming Convention

| Level | Variable Name | Type | Values |
|-------|--------------|------|--------|
| Step Output | `HasUpdates` | boolean string | 'true', 'false' |
| Task Variable | `RunUpdate.HasUpdates` | boolean string | 'true', 'false' |
| Job Output | `UpdateAndBuild.RunUpdate.HasUpdates` | boolean string | 'true', 'false' |

Access patterns:
- **Same job**: `variables['RunUpdate.HasUpdates']`
- **Different job**: `dependencies.UpdateAndBuild.outputs['UpdateAndBuild.RunUpdate.HasUpdates']`

## Testing Scenarios

### Scenario 1: First Run (All New Data)
- TitlesInserted > 0
- AchievementsInserted > 0
- All images downloaded
- TotalChanges >> 0
- **Result**: Deploy

### Scenario 2: Subsequent Run (No Changes)
- All counts = 0
- No new images
- TotalChanges = 0
- **Result**: Skip deployment

### Scenario 3: Minor Updates
- TitlesUpdated > 0 (last played time changed)
- AchievementsUpdated > 0 (unlock count changed)
- No new images
- TotalChanges > 0
- **Result**: Deploy

### Scenario 4: API Error
- Exception thrown in XblClient
- Caught in UpdateService
- Returns exit code 1
- **Result**: Pipeline fails

### Scenario 5: New Achievement for Existing Title
- TitlesUpdated may be 0
- AchievementsInserted > 0
- New achievement image downloaded
- TotalChanges > 0
- **Result**: Deploy

## Optimization Opportunities

Future enhancements could include:

1. **Database-only changes**: Skip deployment if only images were added (images are in blob storage)
2. **Threshold-based deployment**: Only deploy if changes exceed X threshold
3. **Time-based deployment**: Deploy at most once per week even if no changes
4. **Detailed change report**: Email summary of what changed to administrators
5. **Rollback detection**: Track if update resulted in data loss and alert

## Maintenance Notes

1. **Adding new update types**: 
   - Add properties to `UpdateResult`
   - Update `TotalChanges` calculation
   - Add logging in `UpdateService.RunAsync()`

2. **Changing exit codes**:
   - Update documentation
   - Update PowerShell script in pipeline
   - Ensure all consumers handle new codes

3. **Template modifications**:
   - Always include `condition` parameter with default `'true'`
   - Apply condition to all tasks in template
   - Test with both true and false values
