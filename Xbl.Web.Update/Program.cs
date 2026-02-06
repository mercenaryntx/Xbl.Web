using AutoMapper;
using Azure.Storage.Blobs;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Xbl.Client;
using Xbl.Client.Infrastructure;
using Xbl.Client.Io;
using Xbl.Data;
using Xbl.Data.Extensions;
using Xbl.Web.Shared;
using Xbl.Web.Update;

var apiKey = args[0];
var dataFolder = args[1];
var blobConnectionString = args[2];

if (string.IsNullOrWhiteSpace(apiKey))
{
    Console.WriteLine("Error: API key cannot be empty");
    return 1;
}

if (string.IsNullOrWhiteSpace(dataFolder))
{
    Console.WriteLine("Error: Data folder path cannot be empty");
    return 1;
}

if (string.IsNullOrWhiteSpace(blobConnectionString))
{
    Console.WriteLine("Error: Blob connection string cannot be empty");
    return 1;
}

var services = new ServiceCollection();

var config = new MapperConfiguration(cfg =>
{
    cfg.AddProfile<MappingProfile>();
});

services
    .AddLogging(builder =>
    {
        builder.AddConsole();
        builder.AddFilter("Microsoft", LogLevel.Warning);
        builder.AddFilter("System", LogLevel.Warning);
        builder.SetMinimumLevel(LogLevel.Information);
    })
    .AddSingleton(new BlobServiceClient(blobConnectionString))
    .AddSingleton<IBlobStorageService, BlobStorageService>()
    .AddSingleton(config.CreateMapper())
    .AddSingleton<IConsole, NullConsole>()
    .AddSingleton(new GlobalConfig
    {
        DataFolder = dataFolder
    })
    .AddSingleton(new Settings { ApiKey = apiKey, Update = "all" })
    .AddSingleton<UpdateService>()
    .AddData(DataSource.Live, DataSource.Xbox360, DataSource.Dbox, DataSource.Xbl)
    .AddHttpClient<IXblClient, XblClient>((s, c) =>
    {
        c.DefaultRequestHeaders.Add("x-authorization", apiKey);
        c.BaseAddress = new Uri("https://xbl.io/api/v2/");
    });

var serviceProvider = services.BuildServiceProvider();
var updateService = serviceProvider.GetRequiredService<UpdateService>();

return await updateService.RunAsync();