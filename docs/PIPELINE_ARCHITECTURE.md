# Azure Pipelines Architecture

## Overview

The project uses two separate Azure Pipelines with shared templates for efficient CI/CD and data management.

## Pipeline Structure

```
azure-pipelines-cicd.yml      # CI/CD pipeline (triggered on commits)
azure-pipelines-nightly.yml   # Nightly data update pipeline (scheduled)
pipeline-templates/
??? checkout-repos.yml        # Checkout both repositories
??? dotnet-restore.yml        # NuGet restore
??? react-build.yml           # Build React application
??? download-database.yml     # Download live.db from Blob Storage
??? upload-database.yml       # Upload live.db to Blob Storage
??? build-and-publish-web.yml # Build and package Xbl.Web
??? deploy-web.yml            # Deploy to Azure Web App
```

## Pipeline 1: CI/CD (azure-pipelines-cicd.yml)

**Trigger**: Git commits to main/master branches

**Flow**:
1. Checkout repositories (Xbl.Web + Xbl)
2. NuGet restore
3. Build React app
4. Download live.db from Blob Storage
5. Build and publish Xbl.Web
6. Deploy to Azure Web App

**Purpose**: Fast deployment of code changes without data updates

## Pipeline 2: Nightly Build (azure-pipelines-nightly.yml)

**Trigger**: Scheduled (midnight UTC)

**Flow**:

### Stage 1: Update
1. Checkout repositories
2. NuGet restore
3. Build Xbl.Web.Update
4. Download live.db from Blob Storage
5. Get API key from Azure Key Vault
6. Run Xbl.Web.Update (updates data + uploads images)
7. Upload live.db back to Blob Storage

### Stage 2: Build
1. Checkout repositories
2. NuGet restore
3. Build React app
4. Download live.db from Blob Storage
5. Build and publish Xbl.Web

### Stage 3: Deploy
1. Deploy Xbl.Web to Azure Web App

**Purpose**: Automated data updates and deployment with fresh data

## Templates

### checkout-repos.yml
Checks out both Xbl.Web and Xbl repositories

### dotnet-restore.yml
Restores NuGet packages for the solution

**Parameters**:
- `solutionPath`: Path to .sln file

### react-build.yml
Installs Node.js, npm packages, and builds React app

**Parameters**:
- `workingDirectory`: React app directory

### download-database.yml
Downloads live.db from Azure Blob Storage using Azure CLI

**Parameters**:
- `storageAccountName`: Azure Storage account name
- `containerName`: Container name (default: 'database')
- `blobName`: Blob name (default: 'live.db')
- `targetFolder`: Local folder to download to
- `azureSubscription`: Service connection name

### upload-database.yml
Uploads live.db to Azure Blob Storage with overwrite

**Parameters**:
- `storageAccountName`: Azure Storage account name
- `containerName`: Container name (default: 'database')
- `blobName`: Blob name (default: 'live.db')
- `sourceFile`: Local file to upload
- `azureSubscription`: Service connection name

### build-and-publish-web.yml
Builds Xbl.Web, creates deployment package, publishes artifact

**Parameters**:
- `projectPath`: Path to Xbl.Web.csproj
- `buildConfiguration`: Build configuration
- `publishDir`: Output directory
- `reactBuildDir`: React build directory

### deploy-web.yml
Deploys Xbl.Web artifact to Azure Web App

**Parameters**:
- `appName`: Azure Web App name
- `azureSubscription`: Service connection name

## Required Azure Resources

### 1. Azure DevOps
- Service connection named 'xbl' to Azure subscription
- GitHub service connection named 'mercenaryntx'

### 2. Azure Storage Account
- Storage account for database and images
- Container: `database` (for live.db)
- Container: `titles` (public blob access)
- Container: `achievements` (public blob access)

### 3. Azure Key Vault
- Key Vault to store secrets
- Secret: `OpenXblApiKey` (OpenXBL API key)
- Secret: `AzureStorageConnectionString` (Storage connection string)

### 4. Azure Web App
- Web App named 'xbl' for Xbl.Web deployment
- Runtime: .NET 8

## Variables to Configure

Update these variables in both pipeline files:

```yaml
variables:
  storageAccountName: 'xblstorage'  # Your storage account name
  keyVaultName: 'xbl-keyvault'      # Your Key Vault name (nightly only)
```

## Setup Instructions

### 1. Create Azure Resources

```bash
# Create resource group
az group create --name xbl-rg --location eastus

# Create storage account
az storage account create \
  --name xblstorage \
  --resource-group xbl-rg \
  --location eastus \
  --sku Standard_LRS

# Create containers
az storage container create --name database --account-name xblstorage
az storage container create --name titles --account-name xblstorage --public-access blob
az storage container create --name achievements --account-name xblstorage --public-access blob

# Create Key Vault
az keyvault create \
  --name xbl-keyvault \
  --resource-group xbl-rg \
  --location eastus

# Add secrets
az keyvault secret set --vault-name xbl-keyvault --name OpenXblApiKey --value "your-api-key"
az keyvault secret set --vault-name xbl-keyvault --name AzureStorageConnectionString --value "your-connection-string"

# Create Web App
az webapp create \
  --name xbl \
  --resource-group xbl-rg \
  --plan xbl-plan \
  --runtime "DOTNETCORE:8.0"
```

### 2. Configure Azure DevOps

1. **Create Service Connection**:
   - Project Settings ? Service connections
   - New service connection ? Azure Resource Manager
   - Name: `xbl`
   - Grant access to all pipelines

2. **Create Pipelines**:
   - New pipeline ? GitHub ? Select repository
   - Existing Azure Pipelines YAML file
   - Select `azure-pipelines-cicd.yml`
   - Repeat for `azure-pipelines-nightly.yml`

3. **Configure Pipeline Variables** (if needed):
   - Edit pipeline ? Variables
   - Add any sensitive variables

### 3. Grant Permissions

Ensure the service principal has:
- **Storage Blob Data Contributor** on storage account
- **Key Vault Secrets User** on Key Vault
- **Contributor** on Web App

## Benefits of This Architecture

? **Separation of Concerns**:
- CI/CD for fast code deployments
- Nightly updates for data refresh

? **Reusable Templates**:
- DRY principle
- Easy to maintain
- Consistent across pipelines

? **Security**:
- API key stored in Key Vault
- No secrets in code or pipeline YAML

? **Efficiency**:
- CI/CD skips data update (faster)
- Nightly runs only when needed

? **Reliability**:
- Database download/upload handles concurrency
- Atomic updates

? **Cost-Effective**:
- No separate Azure Function resource
- Pipeline runs only when needed

## Troubleshooting

### Database Download Fails
- Check storage account name in variables
- Verify service connection has access
- Check container and blob exist

### Key Vault Access Denied
- Grant service principal "Key Vault Secrets User" role
- Add access policy in Key Vault

### Xbl.Web.Update Fails
- Check API key is valid
- Verify data folder exists
- Review logs in pipeline output

### Deployment Fails
- Check Web App name and subscription
- Verify artifact was published
- Check Web App runtime is .NET 8
