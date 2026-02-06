# Xbl.Web.Update - Console Application

## Overview

Xbl.Web.Update is a console application that updates Xbox Live data and uploads images to Azure Blob Storage. It replaces the previous Azure Function approach.

## Features

- Updates Xbox Live data (titles, achievements, stats)
- Downloads title and achievement images
- Uploads images to Azure Blob Storage:
  - Title images ? `titles` container
  - Achievement images ? `achievements` container

## Usage

```bash
Xbl.Web.Update.exe <api-key> <data-folder> <blob-connection-string>
```

**Parameters:**
- `api-key`: OpenXBL API key for Xbox Live data access
- `data-folder`: Path to the data folder (where live.db is located)
- `blob-connection-string`: Azure Storage connection string for uploading images

**Example:**
```bash
Xbl.Web.Update.exe "your-api-key" "C:\data" "DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net"
```

## Configuration

No configuration files needed! All settings are passed via CLI arguments.

This makes it perfect for CI/CD pipelines where:
- API key comes from Azure Key Vault
- Data folder path is the pipeline working directory
- Blob connection string comes from Azure Key Vault

## How It Works

1. **Data Update**: Calls `XblClient.Update()` to fetch latest Xbox Live data
2. **Image Download**: Downloads title and achievement images if they don't exist locally
3. **Blob Upload**: Uploads all images to Azure Blob Storage containers
   - Creates containers if they don't exist
   - Sets public read access for images
   - Sets correct content type (image/png)

## Azure Pipelines Integration

This application is designed to run in two pipeline scenarios:

### CI/CD Pipeline (azure-pipelines-cicd.yml)
Triggered on Git commits:
- Builds and deploys Xbl.Web
- Does NOT run data updates

### Nightly Pipeline (azure-pipelines-nightly.yml)
Runs daily at midnight UTC:
1. Downloads live.db from Azure Blob Storage
2. Runs Xbl.Web.Update with:
   - API key from Key Vault
   - Data folder path from pipeline
   - Blob connection string from Key Vault
3. Uploads updated live.db back to Blob Storage
4. Builds and deploys Xbl.Web with fresh data

## Dependencies

- **Xbl.Client**: Xbox Live API client
- **Xbl.Data**: Data models and database contexts
- **Xbl.Web.Shared**: Shared infrastructure (NullConsole)
- **Azure.Storage.Blobs**: Azure Blob Storage SDK
- **Microsoft.Extensions.Logging.Console**: Console logging

## Local Development

Run from command line with all three arguments:
```bash
dotnet run --project Xbl.Web.Update -- "your-api-key" "./data" "your-connection-string"
```

## Blob Storage Setup

The application requires:
1. Azure Storage Account
2. Connection string passed as CLI argument
3. Containers will be created automatically:
   - `titles`: Public blob access
   - `achievements`: Public blob access

## Console Logging

The application logs all operations to the console with:
- ? Informational messages for progress tracking
- ?? Warnings for non-critical failures (e.g., single image download fails)
- ? Errors for critical failures
- ?? Summary statistics (downloaded/uploaded counts)
- ?? Microsoft/System logs filtered to Warning level for cleaner output

Perfect for viewing in Azure DevOps pipeline logs!

## Error Handling

- Logs all operations to console
- Continues processing if individual image downloads fail
- Returns exit code 0 on success, 1 on failure
- Suitable for automated pipeline execution

## Migration from Xbl.Function

This replaces the Azure Function approach with advantages:
- ? Runs in pipeline (no separate Azure Function resource needed)
- ? Uses Key Vault for API key security
- ? Better control over database lifecycle
- ? Simpler deployment model
- ? Cost-effective (no function hosting costs)
