# Azure Storage Quick Reference

## Container Structure

```
Azure Storage Account: xblstorage
??? data/              # Private - Database
?   ??? live.db
??? titles/            # Public - Title images  
?   ??? {titleId}.png
??? achievements/      # Public - Achievement images
    ??? {titleId}.{achievementId}.png
```

## Key Vault Secrets

```bash
# Required secrets
OpenXblApiKey                    # OpenXBL API key
AzureStorageConnectionString     # Storage account connection string
```

## Pipeline Variables

```yaml
# Only this variable needed in both pipelines
keyVaultName: 'xbl-keyvault'
```

## Usage in Pipelines

### Download Database
```yaml
- template: pipeline-templates/download-database.yml
# No parameters needed - uses $(AzureStorageConnectionString)
# Downloads from 'data' container by default
```

### Upload Database
```yaml
- template: pipeline-templates/upload-database.yml
# No parameters needed - uses $(AzureStorageConnectionString)
# Uploads to 'data' container by default
```

### Run Xbl.Web.Update
```powershell
$apiKey = $env:OPENXBLAPIKEY
$connectionString = $env:AZURESTORAGECONNECTIONSTRING
$dataFolder = "$(Build.SourcesDirectory)/Xbl.Web/Xbl.Web/data"

& Xbl.Web.Update.exe $apiKey $dataFolder $connectionString
```

## Setup Commands

### Create Storage & Containers
```bash
az storage account create -n xblstorage -g xbl-rg
az storage container create --name data --account-name xblstorage
az storage container create --name titles --account-name xblstorage --public-access blob
az storage container create --name achievements --account-name xblstorage --public-access blob
```

### Store Connection String in Key Vault
```bash
$connectionString = az storage account show-connection-string \
  -n xblstorage -g xbl-rg --query connectionString -o tsv

az keyvault secret set \
  --vault-name xbl-keyvault \
  --name AzureStorageConnectionString \
  --value "$connectionString"
```

## What Changed

### ? Removed
- `storageAccountName` variable in pipelines
- `azureSubscription` parameter in templates
- Service principal RBAC permissions on storage
- `parameters: storageAccountName` in template calls

### ? Added
- Connection string from Key Vault for all operations
- Unified authentication approach
- Container name changed: `database` ? `data`

## Benefits

? Single connection string for all blob operations  
? No RBAC configuration needed  
? Simpler pipeline templates  
? Consistent authentication  
? Easier troubleshooting

## All Blob Operations Use Connection String

| Operation | Container | Access | Used By |
|-----------|-----------|--------|---------|
| Download DB | `data` | Private | Pipeline templates |
| Upload DB | `data` | Private | Pipeline templates |
| Upload titles | `titles` | Public | Xbl.Web.Update |
| Upload achievements | `achievements` | Public | Xbl.Web.Update |

## Common Issues

| Error | Solution |
|-------|----------|
| "Connection string not found" | Ensure Key Vault task ran before template |
| "Container not found" | Create containers: `data`, `titles`, `achievements` |
| "Access denied" | Check connection string has correct account key |
| "Blob not found" | Upload initial `live.db` to `data` container |

## Quick Test

```bash
# Test connection string
az storage container list --connection-string "$connectionString"

# Upload test file
az storage blob upload \
  --connection-string "$connectionString" \
  --container-name data \
  --name live.db \
  --file path/to/live.db
```
