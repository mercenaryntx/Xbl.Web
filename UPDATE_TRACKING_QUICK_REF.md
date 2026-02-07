# Update Tracking Quick Reference

## Exit Codes
- **0**: Updates made ? Continue with deployment
- **1**: Error occurred ? Stop pipeline  
- **2**: No updates ? Skip deployment

## Key Pipeline Variables
```yaml
# Set by Step 6 (Run Xbl.Web.Update)
RunUpdate.HasUpdates = 'true' | 'false'
```

## Conditional Execution Pattern
```yaml
# In template parameters
- template: pipeline-templates/some-template.yml
  parameters:
    condition: eq(variables['RunUpdate.HasUpdates'], 'true')

# In deployment job
condition: and(succeeded(), eq(dependencies.UpdateAndBuild.outputs['UpdateAndBuild.RunUpdate.HasUpdates'], 'true'))
```

## What Gets Tracked
| Category | Metrics |
|----------|---------|
| **Database** | Titles inserted/updated |
| | Achievements inserted/updated |
| | Stats inserted/updated |
| **Images** | New title images uploaded |
| | New achievement images uploaded |

## UpdateResult Properties
```csharp
record UpdateResult
{
    int TitlesInserted
    int TitlesUpdated
    int AchievementsInserted
    int AchievementsUpdated
    int StatsInserted
    int StatsUpdated
    int TotalChanges // Sum of all above
}
```

## Pipeline Steps Affected
| Step | Condition | Action |
|------|-----------|--------|
| 1-5 | Always | Run (checkout, build update tool, download DB) |
| 6 | Always | Run update and set HasUpdates variable |
| 7-11 | HasUpdates=true | Upload DB, build React, build .NET, deploy |
| Deploy Job | HasUpdates=true | Deploy to Azure Web App |

## Monitoring Tips
1. Check Azure DevOps pipeline logs for "No new data found" warnings
2. Review detailed update summary in logs showing all insert/update counts
3. Monitor how often deployment is skipped to measure cost savings
4. Track total changes over time to understand update patterns
