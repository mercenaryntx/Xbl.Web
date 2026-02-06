# Azure Blob Storage Configuration - Final Summary

## Overview

All blob storage operations (database download/upload and image uploads) now use the **same Azure Storage connection string** from Key Vault.

## Key Changes

### ? Unified Storage Access
- **Single connection string** for all blob operations
- **No more service principal authentication** for database operations
- **Consistent approach** across all pipeline tasks

### ?? Single Key Vault Secret

**AzureStorageConnectionString** is used for:
1. **Database Operations** (download/upload `live.db` in `data` container)
2. **Image Uploads** (Xbl.Web.Update uploads to `titles` and `achievements` containers)

## Container Structure

### Azure Storage Account Containers

```
Storage Account: xblstorage
??? data/              # Database storage
?   ??? live.db        # SQLite database
??? titles/            # Title images (public read)
?   ??? *.png
??? achievements/      # Achievement images (public read)
    ??? *.png
```

## Pipeline Templates Updated

### 1. download-database.yml
**Old**: Used Azure CLI with service principal (`az login`)
```yaml
parameters:
  - storageAccountName  ? Removed
  - azureSubscription   ? Removed
```

**New**: Uses connection string from environment
```yaml
parameters:
  - containerName: 'data' (default)
  - blobName: 'live.db' (default)
  - targetFolder: path
```

Uses: `$(AzureStorageConnectionString)` from Key Vault

### 2. upload-database.yml
**Old**: Used Azure CLI with service principal (`az login`)
```yaml
parameters:
  - storageAccountName  ? Removed
  - azureSubscription   ? Removed
```

**New**: Uses connection string from environment
```yaml
parameters:
  - containerName: 'data' (default)
  - blobName: 'live.db' (default)
  - sourceFile: path
```

Uses: `$(AzureStorageConnectionString)` from Key Vault

## Pipeline Files Updated

### azure-pipelines-cicd.yml
**Changed**:
- ? Removed `storageAccountName` variable
- ? Added Key Vault task to get `AzureStorageConnectionString`
- ? Removed `parameters: storageAccountName` from template calls

### azure-pipelines-nightly.yml
**Changed**:
- ? Removed `storageAccountName` variable
- ? Removed `parameters: storageAccountName` from all template calls
- ? Connection string already retrieved in Key Vault task

## Configuration Required

### 1. Azure Storage Account Setup

```bash
# Create storage account
az storage account create \
  --name xblstorage \
  --resource-group xbl-rg \
  --location eastus \
  --sku Standard_LRS

# Get connection string
$connectionString = az storage account show-connection-string \
  --name xblstorage \
  --resource-group xbl-rg \
  --query connectionString \
  --output tsv

# Create containers
az storage container create --name data --account-name xblstorage
az storage container create --name titles --account-name xblstorage --public-access blob
az storage container create --name achievements --account-name xblstorage --public-access blob
```

### 2. Key Vault Setup

```bash
# Store connection string in Key Vault
az keyvault secret set \
  --vault-name xbl-keyvault \
  --name AzureStorageConnectionString \
  --value "$connectionString"

# Store API key in Key Vault
az keyvault secret set \
  --vault-name xbl-keyvault \
  --name OpenXblApiKey \
  --value "your-api-key"
```

### 3. No Service Principal Permissions Needed

? **Simplified**: No need to grant "Storage Blob Data Contributor" role to service principal  
? **Key Vault Only**: Service principal only needs Key Vault access  

## Benefits

### ? Simplified Authentication
- Single connection string instead of service principal + RBAC
- No more "Storage Blob Data Contributor" role assignment needed
- Easier to troubleshoot

### ? Consistent Approach
- Same connection string for all blob operations
- Templates and Xbl.Web.Update use same credential

### ? Better Security
- Connection string stored in Key Vault (not in code)
- Key Vault access is the only permission needed

### ? Easier Setup
- One storage account connection string
- One Key Vault secret
- Done!

## Pipeline Flow

### CI/CD Pipeline
```
1. Get AzureStorageConnectionString from Key Vault
   ?
2. Download live.db (container: 'data')
   ?
3. Build Xbl.Web
   ?
4. Deploy
```

### Nightly Pipeline
```
1. Get OpenXblApiKey + AzureStorageConnectionString from Key Vault
   ?
2. Download live.db (container: 'data')
   ?
3. Run Xbl.Web.Update with connection string
   ??? Updates data
   ??? Uploads images (containers: 'titles', 'achievements')
   ?
4. Upload live.db back (container: 'data')
   ?
5. Build & Deploy Xbl.Web
```

## Required Variables in Pipelines

### Both Pipelines
```yaml
variables:
  keyVaultName: 'xbl-keyvault'
```

**Removed**:
- ? `storageAccountName` (no longer needed)
- ? `azureSubscription` parameter in template calls

## Testing

### Local Test of Xbl.Web.Update
```bash
# Get connection string from Key Vault
$connectionString = az keyvault secret show \
  --vault-name xbl-keyvault \
  --name AzureStorageConnectionString \
  --query value \
  --output tsv

# Run with connection string
cd Xbl.Web.Update
dotnet run -- "your-api-key" "./data" "$connectionString"
```

### Verify Containers
```bash
# List blobs in data container
az storage blob list \
  --container-name data \
  --account-name xblstorage \
  --output table

# List blobs in titles container
az storage blob list \
  --container-name titles \
  --account-name xblstorage \
  --output table

# List blobs in achievements container
az storage blob list \
  --container-name achievements \
  --account-name xblstorage \
  --output table
```

## Migration Notes

If you have existing pipelines:

1. **Remove storage account name** from pipeline variables
2. **Add Key Vault task** to CI/CD pipeline (if not already present)
3. **Update template calls** - Remove `storageAccountName` parameter
4. **Change container name** from `database` to `data` (if using old name)

## Summary

? **One connection string** for all blob operations  
? **Three containers**: `data`, `titles`, `achievements`  
? **Two Key Vault secrets**: `OpenXblApiKey`, `AzureStorageConnectionString`  
? **No RBAC needed** for storage account  
? **Simpler setup** and troubleshooting  

**Build Status**: ? Build Successful
