# Azure Function Deployment Configuration

## Required Azure Resources

1. **Azure Function App**
   - Runtime: .NET 8 (isolated)
   - OS: Windows or Linux
   - Plan: Consumption, Premium, or App Service Plan

2. **Azure Storage Account**
   - For Function App storage (required)
   - For storing data files (optional, can use different storage)

3. **Application Insights** (recommended)
   - For monitoring and logging

## Application Settings

Configure these in the Azure Function App Configuration:

```
Settings__ApiKey=<your-openxbl-api-key>
Settings__Update=all
DataFolder=<path-to-data-folder>
AzureWebJobsStorage=<storage-connection-string>
FUNCTIONS_WORKER_RUNTIME=dotnet-isolated
APPLICATIONINSIGHTS_CONNECTION_STRING=<app-insights-connection-string>
```

**Note**: In Azure, use double underscore (`__`) to represent configuration hierarchy:
- `Settings__ApiKey` ? `Settings:ApiKey`
- `Settings__Update` ? `Settings:Update`

## File Storage Options

### Option 1: Azure File Share (Recommended for Azure)
Mount an Azure File Share to the Function App to persist images and database files.

1. Create a File Share in your Storage Account
2. In Function App -> Configuration -> Path mappings
3. Add New Azure Storage Mount
   - Name: data
   - Storage Account: Select your account
   - Storage Type: Azure Files
   - Share Name: xbldata
   - Mount Path: /data

Then set: `DataFolder=/data`

### Option 2: Blob Storage
Store images in Blob Storage and use Blob SDK in code.

### Option 3: App Service Plan with Persistent Storage
Use an App Service Plan instead of Consumption plan for persistent file system.

## Deployment Methods

### Visual Studio
1. Right-click Xbl.Function project
2. Select "Publish"
3. Choose Azure -> Azure Function App
4. Select or create your Function App
5. Publish

### Azure CLI
```bash
# Login
az login

# Create resource group
az group create --name xbl-rg --location eastus

# Create storage account
az storage account create --name xblstorage --resource-group xbl-rg --location eastus

# Create function app
az functionapp create --name xbl-function-app --resource-group xbl-rg --consumption-plan-location eastus --runtime dotnet-isolated --runtime-version 8 --functions-version 4 --storage-account xblstorage

# Deploy
func azure functionapp publish xbl-function-app
```

### GitHub Actions
Create `.github/workflows/azure-function.yml` for CI/CD deployment.

## Monitoring

- View logs in Azure Portal -> Function App -> Log Stream
- Use Application Insights for detailed telemetry
- Set up alerts for function failures

## Cost Considerations

- **Consumption Plan**: Pay per execution (free tier available)
- **Premium Plan**: Always-ready instances, VNet integration
- **App Service Plan**: Fixed monthly cost, more features

The timer trigger runs once daily, so consumption plan should be very cost-effective.
