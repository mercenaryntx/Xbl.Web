# Azure Functions Configuration Explained

## Configuration Structure Differences

Azure Functions uses a different configuration structure than regular ASP.NET applications:

### Regular ASP.NET (appsettings.json)
```json
{
  "Settings": {
    "ApiKey": "value",
    "Update": "all"
  },
  "DataFolder": "path"
}
```

### Azure Functions (local.settings.json)
```json
{
  "Values": {
    "Settings__ApiKey": "value",
    "Settings__Update": "all",
    "DataFolder": "path"
  }
}
```

## Why the Double Underscore?

Azure Functions stores all configuration in the `Values` section as **flat key-value pairs**. To represent nested configuration sections (like `Settings:ApiKey`), it uses double underscores (`__`) as a hierarchy separator.

### Configuration Binding in Code

In `Program.cs`:
```csharp
services.AddSingleton(sp =>
{
    var c = sp.GetRequiredService<IConfiguration>();
    var s = new Settings();
    c.GetSection("Settings").Bind(s);  // Looks for Settings:ApiKey
    return s;
})
```

This code looks for:
- `Settings:ApiKey` ? In local.settings.json this is `Settings__ApiKey`
- `Settings:Update` ? In local.settings.json this is `Settings__Update`

### How It Works

1. **Local Development** (`local.settings.json`):
   - Azure Functions runtime reads `Values` section
   - Converts `Settings__ApiKey` ? `Settings:ApiKey` in IConfiguration
   - Your code reads from IConfiguration using `GetSection("Settings")`

2. **Azure Deployment** (Application Settings):
   - Set as environment variables: `Settings__ApiKey=value`
   - Azure converts to: `Settings:ApiKey` in IConfiguration

## Complete Configuration Examples

### local.settings.json (Local Development)
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "dotnet-isolated",
    "Settings__ApiKey": "389a3a61-c98b-4a44-942f-0076f483841e",
    "Settings__Update": "all",
    "DataFolder": "..\\..\\Xbl.Client\\bin\\Debug\\net8.0\\data"
  }
}
```

### Azure Application Settings (Production)
```
Settings__ApiKey=your-production-api-key
Settings__Update=all
DataFolder=/data
AzureWebJobsStorage=DefaultEndpointsProtocol=https;AccountName=...
FUNCTIONS_WORKER_RUNTIME=dotnet-isolated
APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=...
```

## Key Points

? **Double underscore (`__`)** represents hierarchy in Azure Functions configuration
? **All values** go in the `Values` section in `local.settings.json`
? **In Azure**, set as flat application settings (environment variables)
? **IConfiguration** automatically converts `__` to `:` hierarchy

## Testing Your Configuration

You can verify configuration is loaded correctly by adding logging in `Program.cs`:

```csharp
var settings = sp.GetRequiredService<Settings>();
Console.WriteLine($"ApiKey loaded: {!string.IsNullOrEmpty(settings.ApiKey)}");
Console.WriteLine($"Update mode: {settings.Update}");

var dataFolder = sp.GetRequiredService<GlobalConfig>().DataFolder;
Console.WriteLine($"DataFolder: {dataFolder}");
```

## Common Issues

? **Wrong**: `"ApiKey": "value"` (won't bind to Settings.ApiKey)
? **Correct**: `"Settings__ApiKey": "value"`

? **Wrong**: Using `:` in local.settings.json
? **Correct**: Use `__` (double underscore)

? **Wrong**: Putting values outside `Values` section
? **Correct**: All app settings go inside `Values`
