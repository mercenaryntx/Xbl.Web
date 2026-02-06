# Xbl.Web Refactoring Summary

## Overview

Successfully refactored the Xbl.Function Azure Function into a console application (Xbl.Web.Update) and restructured Azure Pipelines into modular templates with separate CI/CD and nightly build workflows.

## What Changed

### 1. ? Removed: Xbl.Function (Azure Function)

**Why**: Azure Functions were overkill for this use case. Running updates in the pipeline provides better control, simpler deployment, and lower costs.

### 2. ? Created: Xbl.Web.Update (Console Application)

**Location**: `Xbl.Web.Update/`

**Purpose**: Console app that updates Xbox Live data and uploads images to Azure Blob Storage.

**Features**:
- Takes API key as CLI parameter
- Updates Xbox Live data via `XblClient.Update()`
- Downloads title and achievement images
- Uploads images to Azure Blob Storage:
  - `titles` container for title images
  - `achievements` container for achievement images
- Proper logging and error handling
- Exit code 0 on success, 1 on failure

**Files Created**:
- `Xbl.Web.Update.csproj` - Project file with dependencies
- `Program.cs` - Entry point with DI configuration
- `UpdateService.cs` - Main update logic
- `IBlobStorageService.cs` - Blob storage interface
- `BlobStorageService.cs` - Azure Blob Storage implementation
- `NullBlobStorageService.cs` - Null implementation for local dev
- `appsettings.json` - Configuration file
- `README.md` - Documentation

**Dependencies**:
- Azure.Storage.Blobs (12.19.1)
- Microsoft.Extensions.* packages for DI, Configuration, Logging
- Xbl.Client, Xbl.Data, Xbl.Web.Shared

### 3. ? Created: Pipeline Templates

**Location**: `pipeline-templates/`

Reusable YAML templates to avoid duplication:

- **checkout-repos.yml** - Checks out Xbl.Web and Xbl repositories
- **dotnet-restore.yml** - Restores NuGet packages
- **react-build.yml** - Builds React application
- **download-database.yml** - Downloads live.db from Azure Blob Storage
- **upload-database.yml** - Uploads live.db to Azure Blob Storage
- **build-and-publish-web.yml** - Builds and packages Xbl.Web
- **deploy-web.yml** - Deploys Xbl.Web to Azure Web App

### 4. ? Created: CI/CD Pipeline

**File**: `azure-pipelines-cicd.yml`

**Trigger**: Git commits to main/master

**Flow**:
1. Checkout repositories
2. NuGet restore
3. Build React app
4. Download live.db from Blob Storage
5. Build and publish Xbl.Web
6. Deploy to Azure Web App

**Purpose**: Fast deployment of code changes without data updates

### 5. ? Created: Nightly Build Pipeline

**File**: `azure-pipelines-nightly.yml`

**Trigger**: Scheduled (midnight UTC)

**Flow**:

**Stage 1: Update**
1. Checkout repositories
2. NuGet restore
3. Build Xbl.Web.Update
4. Download live.db from Blob Storage
5. Get API key from Azure Key Vault
6. Run Xbl.Web.Update (updates data + uploads images)
7. Upload live.db back to Blob Storage

**Stage 2: Build**
1. Checkout repositories
2. NuGet restore
3. Build React app
4. Download live.db from Blob Storage
5. Build and publish Xbl.Web

**Stage 3: Deploy**
1. Deploy Xbl.Web to Azure Web App

**Purpose**: Automated nightly data updates and deployment

### 6. ? Created: Documentation

- **PIPELINE_ARCHITECTURE.md** - Comprehensive pipeline documentation with setup instructions
- **Xbl.Web.Update/README.md** - Console application documentation

## Project Structure

```
Xbl.Web/
??? Xbl.Web/                        # Web application
??? Xbl.Web.Shared/                 # Shared infrastructure
??? Xbl.Web.Update/                 # ? New console app
?   ??? Program.cs
?   ??? UpdateService.cs
?   ??? BlobStorageService.cs
?   ??? NullBlobStorageService.cs
?   ??? IBlobStorageService.cs
?   ??? appsettings.json
?   ??? README.md
?   ??? Xbl.Web.Update.csproj
??? pipeline-templates/             # ? New templates
?   ??? checkout-repos.yml
?   ??? dotnet-restore.yml
?   ??? react-build.yml
?   ??? download-database.yml
?   ??? upload-database.yml
?   ??? build-and-publish-web.yml
?   ??? deploy-web.yml
??? azure-pipelines-cicd.yml        # ? New CI/CD pipeline
??? azure-pipelines-nightly.yml     # ? New nightly pipeline
??? azure-pipelines.yml             # ?? Old (can be removed)
??? PIPELINE_ARCHITECTURE.md        # ? New documentation
??? Xbl.sln
```

## Required Azure Resources

### 1. Azure Storage Account
- Container: `database` - Stores live.db
- Container: `titles` - Stores title images (public blob access)
- Container: `achievements` - Stores achievement images (public blob access)

### 2. Azure Key Vault
- Secret: `OpenXblApiKey` - OpenXBL API key
- Secret: `AzureStorageConnectionString` - Storage connection string

### 3. Azure Web App
- Name: `xbl`
- Runtime: .NET 8

### 4. Azure DevOps
- Service connection: `xbl` (Azure Resource Manager)
- Service connection: `mercenaryntx` (GitHub)

## Configuration Required

### In Pipeline YAML Files

Update these variables in both `azure-pipelines-cicd.yml` and `azure-pipelines-nightly.yml`:

```yaml
variables:
  storageAccountName: 'xblstorage'     # Your storage account name
  keyVaultName: 'xbl-keyvault'         # Your Key Vault name
```

### In Azure Key Vault

Add these secrets:
- `OpenXblApiKey`: Your OpenXBL API key
- `AzureStorageConnectionString`: Your storage account connection string

### Grant Permissions

Service principal needs:
- **Storage Blob Data Contributor** on storage account
- **Key Vault Secrets User** on Key Vault
- **Contributor** on Web App

## Benefits of New Architecture

? **Cost Savings**: No Azure Function hosting costs

? **Simpler Deployment**: Everything runs in pipelines

? **Better Security**: API keys in Key Vault, not in code

? **Database Lifecycle Control**: Explicit download/upload in pipeline

? **Separation of Concerns**: 
- Fast CI/CD for code changes
- Separate nightly updates for data

? **Maintainability**: Reusable pipeline templates

? **Reliability**: Atomic database updates

? **Image Management**: Automatic upload to Blob Storage

## Migration Steps

### 1. Create Azure Resources

```bash
# Storage account with containers
az storage account create --name xblstorage --resource-group xbl-rg
az storage container create --name database --account-name xblstorage
az storage container create --name titles --account-name xblstorage --public-access blob
az storage container create --name achievements --account-name xblstorage --public-access blob

# Key Vault with secrets
az keyvault create --name xbl-keyvault --resource-group xbl-rg
az keyvault secret set --vault-name xbl-keyvault --name OpenXblApiKey --value "your-key"
az keyvault secret set --vault-name xbl-keyvault --name AzureStorageConnectionString --value "your-connection"
```

### 2. Configure Azure DevOps

1. Create service connection named `xbl`
2. Create pipeline for `azure-pipelines-cicd.yml`
3. Create pipeline for `azure-pipelines-nightly.yml`
4. Update variables in both pipelines

### 3. Grant Permissions

```bash
# Get service principal ID
$spId = az ad sp list --display-name "your-service-principal" --query "[0].id" -o tsv

# Grant storage access
az role assignment create --assignee $spId --role "Storage Blob Data Contributor" --scope "/subscriptions/{sub-id}/resourceGroups/xbl-rg/providers/Microsoft.Storage/storageAccounts/xblstorage"

# Grant Key Vault access
az keyvault set-policy --name xbl-keyvault --object-id $spId --secret-permissions get list
```

### 4. Initial Database Upload

Upload your existing `live.db` to the `database` container:

```bash
az storage blob upload \
  --account-name xblstorage \
  --container-name database \
  --name live.db \
  --file path/to/your/live.db \
  --auth-mode login
```

### 5. Test Pipelines

1. Test CI/CD: Push a code change
2. Test Nightly: Run manually or wait for schedule

### 6. Decommission Old Resources

Once new pipelines are working:
- Delete Xbl.Function Azure Function App (if deployed)
- Remove old pipeline (azure-pipelines.yml) if desired
- Archive Xbl.Function folder (optional)

## Testing

### Local Testing of Xbl.Web.Update

```bash
cd Xbl.Web.Update

# Update appsettings.json with your settings
dotnet run -- your-api-key-here
```

### Pipeline Testing

1. **CI/CD**: Push a commit to trigger
2. **Nightly**: Run manually from Azure DevOps

## Build Status

? **Build Successful** - All projects compile without errors

## Next Steps

1. ? Review configuration in `azure-pipelines-cicd.yml`
2. ? Review configuration in `azure-pipelines-nightly.yml`
3. ? Update storage account name variable
4. ? Update Key Vault name variable
5. ? Create Azure resources (storage, Key Vault)
6. ? Configure secrets in Key Vault
7. ? Grant service principal permissions
8. ? Create pipelines in Azure DevOps
9. ? Upload initial live.db to storage
10. ? Test both pipelines

## Notes

- The old `azure-pipelines.yml` is kept for reference but can be removed
- The `Xbl.Function` folder can be archived/removed after migration
- Images are stored in Blob Storage with public read access
- Database is stored in Blob Storage with private access
- Nightly pipeline runs at midnight UTC (can be adjusted)

## Support

See `PIPELINE_ARCHITECTURE.md` for detailed setup instructions and troubleshooting.
