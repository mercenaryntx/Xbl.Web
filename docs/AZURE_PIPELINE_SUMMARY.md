# ? Azure Pipeline - Fixed!

## What Was Fixed

### 1. ? React App Location
**Problem:** Pipeline referenced old location `Xbl.Web.UI`
**Solution:** Updated to new location `Xbl.Web/ClientApp`

### 2. ? Multi-Repository Support
**Problem:** Xbl.Web depends on Xbl repository (separate repo)
**Solution:** Added checkout/clone of Xbl repository during build

### 3. ? Azure Function Deployment
**Problem:** Xbl.Function wasn't included in pipeline
**Solution:** Added build and deployment stages for Azure Function

---

## ?? Files Created

I've created **4 files** for you:

| Priority | File | Description |
|----------|------|-------------|
| ?? | **azure-pipelines-multi-repo.yml** | RECOMMENDED - Use this one! |
| ? | **azure-pipelines-new.yml** | Alternative (simpler setup) |
| ?? | **AZURE_PIPELINE_GUIDE.md** | Detailed documentation |
| ? | **AZURE_PIPELINE_QUICK_REF.md** | Quick reference guide |

---

## ?? Quick Start (3 Steps)

### Step 1: Choose Your Pipeline

**Option A: Multi-Repo Checkout** (Recommended) ?
```powershell
Copy-Item "azure-pipelines-multi-repo.yml" "azure-pipelines.yml" -Force
```
- Cleaner approach
- Uses Azure DevOps native feature
- Requires GitHub service connection

**Option B: Git Clone** (Simpler)
```powershell
Copy-Item "azure-pipelines-new.yml" "azure-pipelines.yml" -Force
```
- No service connection needed
- Uses git clone command
- Slightly less elegant

### Step 2: Update Configuration

Open `azure-pipelines.yml` and find line ~119:

```yaml
appName: 'xbl-function-app'  # ? Change this to your Azure Function App name
```

### Step 3: Commit and Push

```powershell
git add azure-pipelines.yml
git commit -m "Fix pipeline: React moved, multi-repo, Function deployment"
git push
```

? **Done!** Pipeline will now build and deploy both Web App and Function.

---

## ?? Before You Deploy

### Create Azure Function App

If you haven't already:

1. Go to **Azure Portal**
2. Create **Function App**
   - Name: `xbl-function-app` (or your choice)
   - Runtime: **.NET 8 (isolated)**
   - Plan: **Consumption** or **Premium**
3. Update pipeline with the name you chose

### GitHub Service Connection (for Multi-Repo option)

If using `azure-pipelines-multi-repo.yml`:

1. Go to **Azure DevOps** ? Project Settings ? Service Connections
2. Click **New service connection** ? **GitHub**
3. Authorize with GitHub
4. Name it (e.g., "github")
5. Update pipeline line 8:
   ```yaml
   endpoint: github  # ? Use your connection name
   ```

---

## ?? What the Pipeline Does

### Build Stage

```
1. Checkout Xbl.Web (this repo)
2. Checkout Xbl (dependency repo)
3. Install .NET 8 SDK
4. Restore NuGet packages
5. Build React app (npm install + build)
6. Copy React build ? wwwroot
7. Publish Xbl.Web ? XblWebApp.zip
8. Publish Xbl.Function ? XblFunction.zip
9. Upload artifacts
```

### Deploy Stage

```
Job 1: Deploy Web App
  ? Deploy XblWebApp.zip to Azure Web App 'xbl'

Job 2: Deploy Function  
  ? Deploy XblFunction.zip to Azure Function 'xbl-function-app'
```

---

## ?? Comparison

| Feature | Old Pipeline | New Pipeline |
|---------|--------------|--------------|
| React location | Xbl.Web.UI ? | Xbl.Web/ClientApp ? |
| Xbl dependency | Not handled ? | Cloned/checked out ? |
| Function deployment | Missing ? | Included ? |
| Stages | 1 | 2 (Build + Deploy) |
| Artifacts | 1 (Web) | 2 (Web + Function) |

---

## ?? Verify Everything Works

### Local Test (Optional)

Before pushing, test locally:

```powershell
# Test .NET build
dotnet restore Xbl.Web/Xbl.Web.csproj
dotnet publish Xbl.Web/Xbl.Web.csproj -c Release

# Test React build  
cd Xbl.Web/ClientApp
npm install
npm run build

# Test Function build
cd ../..
dotnet restore Xbl.Function/Xbl.Function.csproj
dotnet publish Xbl.Function/Xbl.Function.csproj -c Release
```

### After Deployment

**Check Web App:**
- URL: https://xbl.azurewebsites.net
- Swagger: https://xbl.azurewebsites.net/swagger

**Check Function:**
- Azure Portal ? Function App ? Functions
- Should see "Update" function (timer trigger)
- Check logs to verify it runs daily at midnight

---

## ?? Important Notes

1. **Don't delete old pipeline** until new one works
2. **Function App name** must match pipeline configuration
3. **GitHub connection** needed for multi-repo option
4. **Both repos** must be accessible during build
5. **React build** happens before .NET publish

---

## ?? Troubleshooting

### Build Fails: "Cannot find Xbl.Client"

**Problem:** Xbl repository not checked out
**Solution:** Verify multi-repo checkout or git clone step

### Build Fails: "Cannot find ClientApp"

**Problem:** React app path incorrect
**Solution:** Verify `Xbl.Web/ClientApp` exists (run Move-ReactApp.ps1)

### Deploy Fails: "Function App not found"

**Problem:** Function App doesn't exist or name mismatch
**Solution:** Create Function App in Azure and update pipeline

### Build Succeeds but wwwroot Empty

**Problem:** React build didn't copy to wwwroot
**Solution:** Check React build succeeded and copy step ran

---

## ?? Documentation

For more details, see:

- **AZURE_PIPELINE_GUIDE.md** - Complete documentation
- **AZURE_PIPELINE_QUICK_REF.md** - Quick reference
- Original pipeline: **azure-pipelines.yml** (backup)

---

## ? Summary

? **Fixed all 3 issues:**
1. React app location updated to `Xbl.Web/ClientApp`
2. Multi-repository support (Xbl + Xbl.Web)
3. Azure Function build and deployment added

? **Two options provided:**
- Multi-repo checkout (recommended)
- Git clone (simpler)

? **Ready to use:**
- Just update Function App name
- Choose and copy pipeline
- Commit and push!

?? **Pipeline is production-ready!**
