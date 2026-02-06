# Xbl.Web.Update - Final Configuration Summary

## Overview

Xbl.Web.Update is now a **pure CLI application** with no configuration files. All settings come from command-line arguments.

## Command-Line Usage

```bash
Xbl.Web.Update.exe <api-key> <data-folder> <blob-connection-string>
```

### Parameters

1. **api-key** (required)
   - OpenXBL API key
   - Source: Azure Key Vault (`OpenXblApiKey`)

2. **data-folder** (required)
   - Path to data folder where live.db is located
   - Example: `$(Build.SourcesDirectory)/Xbl.Web/Xbl.Web/data`
   - This is where the pipeline downloads live.db

3. **blob-connection-string** (required)
   - Azure Storage connection string
   - Source: Azure Key Vault (`AzureStorageConnectionString`)
   - Used to upload images to blob containers

## Pipeline Integration

### Nightly Pipeline (azure-pipelines-nightly.yml)

The pipeline:
1. Gets both secrets from Key Vault: `OpenXblApiKey` and `AzureStorageConnectionString`
2. Passes all three arguments to Xbl.Web.Update
3. Data folder is set to: `$(Build.SourcesDirectory)/Xbl.Web/Xbl.Web/data`

```powershell
& Xbl.Web.Update.exe $apiKey $dataFolder $blobConnectionString
```

## Console Logging

The application logs everything to console with:
- ? **Info**: Progress messages, statistics
- ?? **Warning**: Non-critical failures (e.g., single image fails)
- ? **Error**: Critical failures
- ?? **Filtered**: Microsoft/System logs at Warning level only

All logs visible in Azure DevOps pipeline output.

## What Was Removed

- ? `appsettings.json` - No longer needed
- ? `Microsoft.Extensions.Configuration.*` packages - Removed
- ? Environment variable dependencies - All via CLI

## What Was Added

- ? Three CLI parameters (api-key, data-folder, blob-connection-string)
- ? Console logging with filtering
- ? Startup logging (shows configuration being used)
- ? Summary logging (success/failure with details)

## Key Vault Secrets Required

### OpenXblApiKey
```bash
az keyvault secret set --vault-name xbl-keyvault --name OpenXblApiKey --value "your-api-key"
```

### AzureStorageConnectionString
```bash
az keyvault secret set --vault-name xbl-keyvault --name AzureStorageConnectionString --value "DefaultEndpointsProtocol=https;AccountName=xblstorage;AccountKey=...;EndpointSuffix=core.windows.net"
```

**Note**: This same connection string is used for:
- Xbl.Web.Update to upload images to blob containers (`titles`, `achievements`)
- Pipeline templates to download/upload `live.db` from/to the `data` container

## Local Testing

```bash
cd Xbl.Web.Update
dotnet run -- "your-api-key" "./data" "your-connection-string"
```

## Benefits

? **Zero configuration files** - Everything via CLI  
? **Perfect for CI/CD** - All secrets from Key Vault  
? **Clear logging** - See everything in pipeline output  
? **Simple** - No config file management  
? **Secure** - No secrets in code or config files

## Flow in Pipeline

```
1. Azure Key Vault
   ?
2. Get OpenXblApiKey + AzureStorageConnectionString
   ?
3. Download live.db from Blob Storage (using connection string, container: 'data')
   ? to $(Build.SourcesDirectory)/Xbl.Web/Xbl.Web/data
   ?
4. Run: Xbl.Web.Update.exe <api-key> <data-folder> <blob-connection>
   ?
5. Console logs show progress
   ?
6. Images uploaded to blob storage (containers: 'titles', 'achievements')
   ?
7. Upload updated live.db back to blob storage (using connection string, container: 'data')
```

## Exit Codes

- **0**: Success
- **1**: Failure (invalid arguments, update failed, etc.)

## Example Pipeline Output

```
=== Xbl.Web.Update Starting ===
Data Folder: C:\agent\_work\1\s\Xbl.Web\Xbl.Web\data
Blob Storage: Configured
Update started at: 2024-01-15 00:00:00
XblClient Update completed successfully
Processing 1234 title images
Downloaded 10 new title images, uploaded 1234 to blob storage
Processing 5678 achievement images
Downloaded 25 new achievement images, uploaded 5678 to blob storage
Image download and upload completed successfully
Update completed at: 2024-01-15 00:15:32
=== Xbl.Web.Update Completed Successfully ===
```

## Build Status

? **Build Successful** - All projects compile without errors
