# Update Tracking Implementation Summary

## Overview
Implemented a comprehensive change tracking system for `Xbl.Web.Update` that detects whether any new data was added to the database. The pipeline now skips deployment when no updates are made, saving time and resources.

## Exit Codes
The `Xbl.Web.Update` application now uses three exit codes:
- **0**: Updates were made successfully - proceed with deployment
- **1**: An error occurred - stop the pipeline
- **2**: No updates were found - skip deployment

## Changes Made

### 1. Core Library Changes (`Xbl.Client`)

#### `IXblClient.cs` and `UpdateResult` Record
- Changed return type from `Task<int>` to `Task<UpdateResult>`
- Added `UpdateResult` record that tracks:
  - `TitlesInserted` and `TitlesUpdated`
  - `AchievementsInserted` and `AchievementsUpdated`
  - `StatsInserted` and `StatsUpdated`
  - `TotalChanges` (computed property summing all changes)

#### `XblClient.cs`
- Modified `Update()` method to return `UpdateResult` instead of exit code
- Modified `UpdateTitles()` to return tuple with counts: `(AchievementTitles, string Xuid, int Inserted, int Updated)`
- Modified `UpdateAchievements()` to return tuple: `(int Inserted, int Updated)`
- Modified `UpdateStats()` to return tuple: `(int Inserted, int Updated)`
- All methods now track and accumulate insert/update counts

#### `App.cs`
- Updated `Update()` method to handle the new `UpdateResult` return type
- Method continues to return 0 for success (maintains backward compatibility)

### 2. Xbl.Web.Update Changes

#### `UpdateService.cs`
- Modified `RunAsync()` to capture `UpdateResult` from `XblClient`
- Modified `DownloadAndUploadImagesAsync()` to return image counts: `(int TitleImages, int AchievementImages)`
- Modified `DownloadTitleImagesAsync()` to return count of new images uploaded
- Modified `DownloadAchievementImagesAsync()` to return count of new images uploaded
- Calculates total changes including database updates and new images
- Returns exit code 2 when `totalChanges == 0`
- Logs detailed summary of all changes:
  ```
  Update summary: Titles (Inserted: X, Updated: Y), 
                  Achievements (Inserted: X, Updated: Y), 
                  Stats (Inserted: X, Updated: Y)
  Image download and upload completed. New images: X titles, Y achievements
  Total changes: Z
  ```

### 3. Pipeline Changes

#### `azure-pipelines-nightly.yml`
- **Step 6**: Modified PowerShell script for running `Xbl.Web.Update`:
  - Captures exit code from the executable
  - If exit code is 2: Logs warning "No new data found. Skipping deployment."
  - Sets output variable `HasUpdates=false`
  - Exits with 0 (success, but no updates)
  - If exit code is 0: Sets output variable `HasUpdates=true`
  - If exit code is 1: Exits with error (pipeline stops)
  - Provides detailed logging for each scenario

- **Steps 7-11**: Added conditional execution based on `HasUpdates` variable:
  - Upload database: `condition: eq(variables['RunUpdate.HasUpdates'], 'true')`
  - Build React App: `condition: eq(variables['RunUpdate.HasUpdates'], 'true')`
  - Build Xbl.Web: `condition: eq(variables['RunUpdate.HasUpdates'], 'true')`
  - Copy database: `condition: eq(variables['RunUpdate.HasUpdates'], 'true')`
  - Archive and publish artifact: `condition: eq(variables['RunUpdate.HasUpdates'], 'true')`

- **Deployment Job**: Added condition to skip deployment when no updates:
  ```yaml
  condition: and(succeeded(), eq(dependencies.UpdateAndBuild.outputs['UpdateAndBuild.RunUpdate.HasUpdates'], 'true'))
  ```

#### Pipeline Templates
Updated all templates to support conditional execution:

- **`upload-database.yml`**: Added `condition` parameter (default: 'true')
- **`react-build.yml`**: Added `condition` parameter to all 3 tasks
- **`build-publish-web.yml`**: Added `condition` parameter to both tasks
- **`archive-publish-artifact.yml`**: Added `condition` parameter to both tasks

## Pipeline Flow

### When Updates Are Found (Exit Code 0)
1. Download live.db from Azure Blob Storage
2. Run Xbl.Web.Update
3. Log: "Xbl.Web.Update completed successfully with new data"
4. Set `HasUpdates=true`
5. Upload updated live.db
6. Build React App
7. Build Xbl.Web
8. Copy database to publish directory
9. Archive and publish artifact
10. Deploy to Azure Web App

### When No Updates Found (Exit Code 2)
1. Download live.db from Azure Blob Storage
2. Run Xbl.Web.Update
3. Log: "##[warning]No new data found. Skipping deployment."
4. Set `HasUpdates=false`
5. **Skip steps 5-11** (upload, builds, deployment)
6. Pipeline completes successfully without deployment

### When Error Occurs (Exit Code 1)
1. Steps run until error
2. Log error message
3. Pipeline fails and stops

## Benefits

1. **Cost Savings**: Avoids unnecessary Azure Web App deployments when no data changes
2. **Time Savings**: Skips React build, .NET build, archiving, and deployment steps
3. **Resource Efficiency**: Reduces build agent time and Azure resources
4. **Clear Logging**: Detailed logs show exactly what changed and why deployment was skipped
5. **Monitoring**: Easy to track in Azure DevOps whether updates were made each night

## Testing Recommendations

1. **Test with updates**: Ensure deployment happens when new titles/achievements are added
2. **Test without updates**: Verify deployment is skipped on subsequent runs without changes
3. **Test with errors**: Confirm pipeline fails appropriately on API errors
4. **Monitor logs**: Check that all summary information is logged correctly

## Backward Compatibility

- The `Xbl.Client` library API changed (return type), but this is only used by `Xbl.Web.Update` and the CLI app
- The CLI app (`App.cs`) was updated to handle the new return type
- No breaking changes for other consumers

## Example Log Output

### With Updates:
```
Update started at: 2024-01-15 00:00:00
XblClient Update completed successfully
Update summary: Titles (Inserted: 2, Updated: 5), 
                Achievements (Inserted: 15, Updated: 3), 
                Stats (Inserted: 1, Updated: 4)
Image download and upload completed. New images: 2 titles, 15 achievements
Total changes: 47
Update completed at: 2024-01-15 00:05:30
Xbl.Web.Update completed successfully with new data
```

### Without Updates:
```
Update started at: 2024-01-15 00:00:00
XblClient Update completed successfully
Update summary: Titles (Inserted: 0, Updated: 0), 
                Achievements (Inserted: 0, Updated: 0), 
                Stats (Inserted: 0, Updated: 0)
Image download and upload completed. New images: 0 titles, 0 achievements
Total changes: 0
No new data found. Skipping deployment.
Update completed at: 2024-01-15 00:02:15
##[warning]No new data found. Skipping deployment.
```
