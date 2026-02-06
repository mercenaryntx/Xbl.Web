# Azure Pipeline - Quick Reference

## What Changed

| Aspect | Old Pipeline | New Pipeline |
|--------|-------------|--------------|
| **React Location** | `Xbl.Web.UI/` | `Xbl.Web/ClientApp/` |
| **Xbl Dependency** | ? Not handled | ? Cloned/checked out |
| **Azure Function** | ? Not included | ? Built and deployed |
| **Deployment** | Single (Web App) | Dual (Web App + Function) |
| **Stages** | 1 stage | 2 stages (Build + Deploy) |

## Quick Start

### Recommended Approach (Multi-Repo)

```powershell
# 1. Copy the recommended pipeline
Copy-Item "azure-pipelines-multi-repo.yml" "azure-pipelines.yml" -Force

# 2. Update Function App name (line 119)
# Edit azure-pipelines.yml and replace 'xbl-function-app' with your app name

# 3. Commit and push
git add azure-pipelines.yml
git commit -m "Update pipeline for React move, multi-repo, and Function deployment"
git push
```

### Simple Approach (Git Clone)

```powershell
# 1. Copy the simple pipeline
Copy-Item "azure-pipelines-new.yml" "azure-pipelines.yml" -Force

# 2. Update Function App name (line 119)
# Edit azure-pipelines.yml and replace 'xbl-function-app' with your app name

# 3. Commit and push
git add azure-pipelines.yml
git commit -m "Update pipeline for React move, multi-repo, and Function deployment"
git push
```

## Before You Deploy

### ? Prerequisites Checklist

- [ ] Azure Function App created in Azure Portal
- [ ] Function App name updated in pipeline (line 119)
- [ ] GitHub service connection configured (for multi-repo option)
- [ ] React app moved to `Xbl.Web/ClientApp` (already done)
- [ ] Both repositories accessible (Xbl.Web and Xbl)

### ??? Azure Resources Needed

1. **Azure Web App** 
   - Name: `xbl` (already exists)
   - Type: Web App
   
2. **Azure Function App** 
   - Name: `xbl-function-app` (update in pipeline)
   - Runtime: .NET 8 isolated
   - Plan: Consumption or Premium

3. **Storage Account**
   - Required for Function App
   - Created automatically with Function App

## Build Output

After successful build, you'll have:

```
Artifacts/
??? xbl-web/
?   ??? XblWebApp.zip          ? Web App package
??? xbl-function/
    ??? XblFunction.zip        ? Function App package
```

## Deployment Targets

```
Azure Web App (xbl)
??? wwwroot/                   ? React app
??? Controllers/
??? Program.cs
??? ...

Azure Function App (xbl-function-app)
??? UpdateFunction/            ? Timer trigger
??? host.json
??? ...
```

## Pipeline Stages

### Stage 1: Build (10-15 minutes)
1. Checkout repositories (Xbl.Web + Xbl)
2. Restore NuGet packages
3. Build React app (npm install + build)
4. Publish Xbl.Web (.NET)
5. Publish Xbl.Function (.NET)
6. Create deployment packages
7. Upload artifacts

### Stage 2: Deploy (5-10 minutes)
1. **Deploy Web App**
   - Download xbl-web artifact
   - Deploy to Azure Web App 'xbl'
   
2. **Deploy Function**
   - Download xbl-function artifact
   - Deploy to Azure Function App 'xbl-function-app'

## Monitoring

After deployment:

### Web App
- URL: https://xbl.azurewebsites.net
- Logs: Azure Portal ? Web App ? Log stream
- Swagger: https://xbl.azurewebsites.net/swagger

### Function App
- URL: https://xbl-function-app.azurewebsites.net
- Logs: Azure Portal ? Function App ? Log stream
- Monitor: Azure Portal ? Function App ? Monitor

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Xbl repository not found" | Check service connection or git URL |
| "React build failed" | Verify `Xbl.Web/ClientApp` exists and has package.json |
| "Function deployment failed" | Create Function App in Azure and update pipeline |
| "NuGet restore failed" | Ensure both repos are checked out correctly |
| "wwwroot is empty" | Check React build step completed successfully |

## Files Reference

| File | Use This If... |
|------|----------------|
| `azure-pipelines-new.yml` | You want simple git clone approach |
| `azure-pipelines-multi-repo.yml` | You want official multi-repo feature ? |
| `AZURE_PIPELINE_GUIDE.md` | You need detailed documentation |
| `AZURE_PIPELINE_QUICK_REF.md` | You need quick reference (this file) |

## Summary

? **Three problems fixed:**
1. React app location updated
2. Multi-repository support added
3. Azure Function deployment added

? **Two deployment options:**
1. Git clone (simple)
2. Multi-repo checkout (recommended)

? **Ready to deploy:**
- Just update Function App name and push!
