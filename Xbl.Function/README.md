# Xbl.Function

Azure Functions project for automated Xbox Live data updates.

## Overview

This Azure Function runs daily at midnight (UTC) to update Xbox Live data by:
1. Calling `XblClient.Update()` to fetch and update titles, achievements, and stats
2. Downloading title and achievement images after the update completes

## Configuration

### Local Development

Update `local.settings.json` with the following settings:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "dotnet-isolated",
    "Settings__ApiKey": "your-openxbl-api-key",
    "Settings__Update": "all",
    "DataFolder": "path/to/data/folder"
  }
}
```

**Important**: Azure Functions uses double underscore (`__`) to represent nested configuration sections. 
- `Settings__ApiKey` maps to `Settings:ApiKey`
- `Settings__Update` maps to `Settings:Update`

### Azure Deployment

Configure the following Application Settings in Azure:

- `ApiKey`: Your OpenXBL API key
- `DataFolder`: Path to the data folder for storing databases and images
- `AzureWebJobsStorage`: Connection string for Azure Storage

You can also configure settings via `appsettings.json` in the Settings section.

## Timer Schedule

The function runs on a CRON schedule: `0 0 0 * * *` (daily at midnight UTC)

To change the schedule, modify the `TimerTrigger` attribute in `UpdateFunction.cs`.

CRON format: `{second} {minute} {hour} {day} {month} {day-of-week}`

Examples:
- Every hour: `0 0 * * * *`
- Every 12 hours: `0 0 */12 * * *`
- Every day at 2 AM: `0 0 2 * * *`

## Dependencies

- Xbl.Client - Contains the XblClient for Xbox Live API integration
- Xbl.Data - Contains data models and database contexts
- Xbl.Web.Shared - Contains shared infrastructure (NullConsole, NullProgressContext)

## Running Locally

1. Install [Azure Functions Core Tools](https://docs.microsoft.com/azure/azure-functions/functions-run-local)
2. Update `local.settings.json` with your configuration
3. Run: `func start` or press F5 in Visual Studio

## Deployment

Deploy to Azure using:
- Visual Studio: Right-click project -> Publish
- Azure Functions Core Tools: `func azure functionapp publish <app-name>`
- CI/CD pipeline with GitHub Actions or Azure DevOps
