using AutoMapper;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Xbl.Client;
using Xbl.Client.Infrastructure;
using Xbl.Client.Io;
using Xbl.Data;
using Xbl.Data.Extensions;
using Xbl.Web.Shared;

var host = new HostBuilder()
.ConfigureFunctionsWorkerDefaults()
.ConfigureServices((context, services) =>
    {
        services.AddApplicationInsightsTelemetryWorkerService();
        services.ConfigureFunctionsApplicationInsights();

        var config = new MapperConfiguration(cfg =>
        {
            cfg.AddProfile<MappingProfile>();
        });

        services
            .AddSingleton(sp =>
            {
                var c = sp.GetRequiredService<IConfiguration>();
                var s = new Settings();
                c.GetSection("Settings").Bind(s);
                return s;
            })
            .AddSingleton<IConsole, NullConsole>()
            .AddSingleton(config.CreateMapper())
            .AddSingleton(sp => new GlobalConfig
            {
                DataFolder = sp.GetRequiredService<IConfiguration>().GetValue<string>("DataFolder")
            })
            .AddData(DataSource.Live, DataSource.Xbox360, DataSource.Dbox, DataSource.Xbl)
            .AddHttpClient<IXblClient, XblClient>((s, c) =>
            {
                var settings = s.GetRequiredService<Settings>();
                c.DefaultRequestHeaders.Add("x-authorization", settings.ApiKey);
                c.BaseAddress = new Uri("https://xbl.io/api/v2/");
            });
    })
    .Build();

host.Run();
