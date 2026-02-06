# Pipeline Refactoring - Quick Setup Guide

## What Changed

? **Xbl.Function** ? **Xbl.Web.Update** (Azure Function ? Console App)  
? **Monolithic Pipeline** ? **Modular Templates**  
? **Single Pipeline** ? **CI/CD + Nightly Pipelines**

## Files Created

### Xbl.Web.Update Project
- `Xbl.Web.Update/Program.cs`
- `Xbl.Web.Update/UpdateService.cs`
- `Xbl.Web.Update/BlobStorageService.cs`
- `Xbl.Web.Update/NullBlobStorageService.cs`
- `Xbl.Web.Update/IBlobStorageService.cs`
- `Xbl.Web.Update/appsettings.json`
- `Xbl.Web.Update/Xbl.Web.Update.csproj`

### Pipeline Templates
- `pipeline-templates/checkout-repos.yml`
- `pipeline-templates/dotnet-restore.yml`
- `pipeline-templates/react-build.yml`
- `pipeline-templates/download-database.yml`
- `pipeline-templates/upload-database.yml`
- `pipeline-templates/build-and-publish-web.yml`
- `pipeline-templates/deploy-web.yml`

### Pipeline Files
- `azure-pipelines-cicd.yml` (CI/CD on commits)
- `azure-pipelines-nightly.yml` (Scheduled nightly)

### Documentation
- `PIPELINE_ARCHITECTURE.md` (Full details)
- `REFACTORING_COMPLETE.md` (Complete summary)
- `Xbl.Web.Update/README.md` (App docs)

## 5-Minute Setup

### Step 1: Update Pipeline Variables

Edit both `azure-pipelines-cicd.yml` and `azure-pipelines-nightly.yml`:

```yaml
variables:
  storageAccountName: 'YOUR_STORAGE_ACCOUNT'
  keyVaultName: 'YOUR_KEY_VAULT'  # nightly only
```

### Step 2: Create Azure Resources

```bash
# Set variables
$rg = "xbl-rg"
$location = "eastus"
$storage = "YOUR_STORAGE_ACCOUNT"
$kv = "YOUR_KEY_VAULT"

# Create storage with containers
az storage account create -n $storage -g $rg -l $location
az storage container create --name database --account-name $storage
az storage container create --name titles --account-name $storage --public-access blob
az storage container create --name achievements --account-name $storage --public-access blob

# Create Key Vault with secrets
az keyvault create -n $kv -g $rg -l $location
az keyvault secret set --vault-name $kv --name OpenXblApiKey --value "YOUR_API_KEY"
az keyvault secret set --vault-name $kv --name AzureStorageConnectionString --value "YOUR_CONNECTION_STRING"

# Upload initial database
az storage blob upload --account-name $storage --container-name database --name live.db --file path/to/live.db
```

### Step 3: Grant Permissions

```bash
# Get service principal ID from your service connection
$spId = "YOUR_SERVICE_PRINCIPAL_OBJECT_ID"

# Grant storage access
az role assignment create --assignee $spId --role "Storage Blob Data Contributor" --scope "/subscriptions/YOUR_SUB_ID/resourceGroups/$rg/providers/Microsoft.Storage/storageAccounts/$storage"

# Grant Key Vault access
az keyvault set-policy --name $kv --object-id $spId --secret-permissions get list
```

### Step 4: Create Pipelines

1. Azure DevOps ? Pipelines ? New Pipeline
2. Select GitHub
3. Select repository: `mercenaryntx/Xbl.Web`
4. Existing Azure Pipelines YAML
5. Select `azure-pipelines-cicd.yml`
6. Save and run

Repeat for `azure-pipelines-nightly.yml`

### Step 5: Test

- **CI/CD**: Push a commit
- **Nightly**: Run manually or wait for schedule

## Architecture

### CI/CD Pipeline (Fast Deploy)
```
Commit ? Checkout ? Restore ? React Build ? Download DB ? Build Web ? Deploy
```

### Nightly Pipeline (Data Update)
```
Schedule ? Checkout ? Build Update Tool ? Download DB ? Run Update (with Key Vault API key) 
? Upload DB ? Build Web ? Deploy
```

## What Each Pipeline Does

### azure-pipelines-cicd.yml
- ? **Fast**: No data updates
- ?? **Purpose**: Deploy code changes quickly
- ?? **Trigger**: Git commits

### azure-pipelines-nightly.yml
- ?? **Scheduled**: Midnight UTC
- ?? **Purpose**: Update Xbox Live data + deploy
- ?? **Security**: API key from Key Vault
- ?? **Artifacts**: Uploads images to Blob Storage

## Benefits

? No Azure Function hosting costs  
? API keys secure in Key Vault  
? Fast CI/CD (no data updates)  
? Automated nightly data refresh  
? Reusable pipeline templates  
? Better database lifecycle management

## Full Documentation

See `PIPELINE_ARCHITECTURE.md` for complete details, troubleshooting, and advanced configuration.

## Build Status

? **Build Successful** - All projects compile without errors
