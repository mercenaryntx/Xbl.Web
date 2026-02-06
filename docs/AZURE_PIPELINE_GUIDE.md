# Azure Pipelines Configuration - Updated

## Overview

The Azure DevOps pipeline has been updated to address three key requirements:

1. ? **React App moved** from `Xbl.Web.UI` to `Xbl.Web/ClientApp`
2. ? **Multi-repository support** - Builds both Xbl.Web (this repo) and its dependency Xbl (separate repo)
3. ? **Azure Function deployment** - Added build and deployment for Xbl.Function

---

## Two Pipeline Options

I've created **two versions** of the pipeline. Choose the one that best fits your Azure DevOps setup:

### Option 1: Git Clone Approach (`azure-pipelines-new.yml`)
- **Pros**: Simple, doesn't require GitHub service connection
- **Cons**: Clones Xbl repo using git command
- **Use when**: You want a quick setup without configuring service connections

### Option 2: Multi-Repo Checkout (`azure-pipelines-multi-repo.yml`) ? **RECOMMENDED**
- **Pros**: Official Azure DevOps multi-repo feature, cleaner, better integration
- **Cons**: Requires GitHub service connection in Azure DevOps
- **Use when**: You have GitHub service connection configured

---

## Key Changes Made

### 1. React App Location Updated ?

**Before:**
```yaml
reactBuildDir: 'Xbl.Web.UI/build'
workingDir: 'Xbl.Web.UI'
```

**After:**
```yaml
reactBuildDir: 'Xbl.Web/ClientApp/build'
workingDir: 'Xbl.Web/ClientApp'
```

The pipeline now:
- Runs `npm install` in `Xbl.Web/ClientApp`
- Runs `npm run build` in `Xbl.Web/ClientApp`
- Copies build output to `Xbl.Web/wwwroot`

### 2. Multi-Repository Support ?

**Option 1 - Git Clone:**
```yaml
- script: |
    git clone https://github.com/mercenaryntx/Xbl.git $(Agent.TempDirectory)/Xbl
  displayName: 'Clone Xbl repository'
```

**Option 2 - Multi-Repo Checkout (Recommended):**
```yaml
resources:
  repositories:
  - repository: XblRepo
    type: github
    name: mercenaryntx/Xbl
    ref: main

- checkout: self
  path: Xbl.Web
- checkout: XblRepo
  path: Xbl
```

This ensures the Xbl repository (containing Xbl.Client, Xbl.Data, etc.) is available during build.

### 3. Azure Function Build & Deployment ?

**New Build Step:**
```yaml
- task: DotNetCoreCLI@2
  displayName: 'Publish Xbl.Function'
  inputs:
    command: 'publish'
    projects: 'Xbl.Function/Xbl.Function.csproj'
    arguments: '--configuration $(buildConfiguration) --output $(xblFunctionOutputDir)'
```

**New Deployment Stage:**
```yaml
- deployment: DeployFunction
  displayName: 'Deploy Xbl.Function to Azure Functions'
  environment: 'Production'
  strategy:
    runOnce:
      deploy:
        steps:
        - task: AzureFunctionApp@2
          inputs:
            appType: 'functionApp'
            appName: 'xbl-function-app'
            package: '$(Pipeline.Workspace)/xbl-function/XblFunction.zip'
```

---

## Complete Pipeline Flow

### Stage 1: Build

1. **Checkout Repositories**
   - Xbl.Web (current repo)
   - Xbl (dependency repo)

2. **Install .NET SDK** (.NET 8.x)

3. **Restore NuGet Packages**
   - Xbl.Web.csproj
   - Xbl.Function.csproj
   - Xbl.Web.Shared.csproj

4. **Build React App**
   - Install Node.js 20.x
   - npm install in Xbl.Web/ClientApp
   - npm run build in Xbl.Web/ClientApp

5. **Copy React Build**
   - Copy from `Xbl.Web/ClientApp/build` to `Xbl.Web/wwwroot`

6. **Publish .NET Projects**
   - Publish Xbl.Web ? XblWebApp.zip
   - Publish Xbl.Function ? XblFunction.zip

7. **Publish Artifacts**
   - Upload XblWebApp.zip as 'xbl-web' artifact
   - Upload XblFunction.zip as 'xbl-function' artifact

### Stage 2: Deploy

**Job 1: Deploy Web App**
- Download 'xbl-web' artifact
- Deploy to Azure Web App 'xbl'

**Job 2: Deploy Function**
- Download 'xbl-function' artifact
- Deploy to Azure Function App 'xbl-function-app'

---

## Setup Instructions

### Option 1: Using Git Clone (Simpler)

1. **Replace** `azure-pipelines.yml` with `azure-pipelines-new.yml`:
   ```powershell
   Copy-Item "azure-pipelines-new.yml" "azure-pipelines.yml" -Force
   ```

2. **Commit and push** to trigger the pipeline

3. **No additional Azure DevOps configuration needed**

### Option 2: Using Multi-Repo Checkout (Recommended)

1. **Create GitHub Service Connection** in Azure DevOps:
   - Go to Project Settings ? Service Connections
   - Click "New service connection"
   - Choose "GitHub"
   - Name it (e.g., "github")
   - Authorize with your GitHub account

2. **Update the pipeline** to use your service connection name:
   ```yaml
   resources:
     repositories:
     - repository: XblRepo
       type: github
       name: mercenaryntx/Xbl
       ref: main
       endpoint: github  # ? Replace with your connection name
   ```

3. **Replace** `azure-pipelines.yml` with `azure-pipelines-multi-repo.yml`:
   ```powershell
   Copy-Item "azure-pipelines-multi-repo.yml" "azure-pipelines.yml" -Force
   ```

4. **Commit and push** to trigger the pipeline

---

## Configuration Required

### Azure Function App Name

Update this in the pipeline:

```yaml
- task: AzureFunctionApp@2
  inputs:
    appName: 'xbl-function-app'  # ? Replace with your actual Azure Function App name
```

### Azure Subscription

The pipeline uses this subscription (already configured):
```yaml
azureSubscription: 'Visual Studio Enterprise(edecda7b-57b5-41b5-845a-33e9333d4186)'
```

If you need to change it:
- Go to Azure DevOps ? Project Settings ? Service Connections
- Find your Azure subscription
- Copy the connection name/ID

---

## Environment Setup

### Azure Resources Required

1. **Azure Web App** (already configured)
   - Name: `xbl`
   - Runtime: .NET 8
   - OS: Windows or Linux

2. **Azure Function App** (needs to be created)
   - Name: `xbl-function-app` (update pipeline with actual name)
   - Runtime: .NET 8 (isolated)
   - Plan: Consumption or Premium

3. **Azure Storage Account** (for Function App)
   - Required by Azure Functions

### Azure DevOps Environment

The pipeline uses a `Production` environment:
```yaml
environment: 'Production'
```

To create it:
1. Go to Pipelines ? Environments
2. Create "Production" environment
3. (Optional) Add approvals/checks for deployments

---

## Testing the Pipeline

### Local Build Test

Before pushing to Azure DevOps, test locally:

```powershell
# Test .NET build with Xbl dependency
dotnet restore Xbl.Web/Xbl.Web.csproj
dotnet publish Xbl.Web/Xbl.Web.csproj -c Release

# Test React build
cd Xbl.Web/ClientApp
npm install
npm run build

# Test Function build
dotnet restore Xbl.Function/Xbl.Function.csproj
dotnet publish Xbl.Function/Xbl.Function.csproj -c Release
```

### Pipeline Variables

The pipeline uses these variables (customize if needed):

```yaml
variables:
  buildConfiguration: 'Release'
  xblWebOutputDir: '$(Build.ArtifactStagingDirectory)/publish/Xbl.Web'
  xblFunctionOutputDir: '$(Build.ArtifactStagingDirectory)/publish/Xbl.Function'
  reactBuildDir: 'Xbl.Web/ClientApp/build'
```

---

## Troubleshooting

### Issue: Xbl repository not found
**Solution:** 
- Option 1: Check git clone URL in pipeline
- Option 2: Verify GitHub service connection is authorized

### Issue: React build fails
**Solution:**
- Verify `Xbl.Web/ClientApp/package.json` exists
- Check Node.js version (should be 20.x)
- Ensure `npm run build` script is defined

### Issue: Function deployment fails
**Solution:**
- Verify Azure Function App name is correct
- Ensure Function App exists in Azure
- Check Azure subscription connection

### Issue: NuGet restore fails
**Solution:**
- Verify both Xbl.Web and Xbl repositories are checked out
- Check project references in .csproj files
- Ensure .NET 8 SDK is installed

---

## Files Created

| File | Description |
|------|-------------|
| `azure-pipelines-new.yml` | Updated pipeline using git clone |
| `azure-pipelines-multi-repo.yml` | Updated pipeline using multi-repo checkout ? |
| `AZURE_PIPELINE_GUIDE.md` | This documentation file |

---

## Next Steps

1. ? **Choose** Option 1 or Option 2 based on your preference
2. ? **Create** Azure Function App in Azure Portal
3. ? **Update** pipeline with Function App name
4. ? **Replace** azure-pipelines.yml with chosen version
5. ? **Commit and push** to trigger pipeline
6. ? **Monitor** pipeline execution in Azure DevOps
7. ? **Verify** both Web App and Function are deployed

---

## Summary of Changes

? **React App**: Updated from `Xbl.Web.UI` to `Xbl.Web/ClientApp`
? **Multi-Repo**: Added Xbl repository checkout
? **Azure Function**: Added build and deployment stages
? **Separation**: Web App and Function deploy independently
? **Production Ready**: Includes proper staging and deployment strategies
