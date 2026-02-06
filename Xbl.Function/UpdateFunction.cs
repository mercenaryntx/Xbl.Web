using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Xbl.Client;
using Xbl.Client.Io;
using Xbl.Client.Models.Xbl.Achievements;
using Xbl.Data;

namespace Xbl.Function;

public class UpdateFunction
{
    private readonly ILogger<UpdateFunction> _logger;
    private readonly IXblClient _xblClient;
    private readonly IDatabaseContext _live;

    public UpdateFunction(
        ILogger<UpdateFunction> logger, 
        IXblClient xblClient,
        [FromKeyedServices(DataSource.Live)] IDatabaseContext live)
    {
        _logger = logger;
        _xblClient = xblClient;
        _live = live;
    }

    [Function("Update")]
    public async Task Run([TimerTrigger("0 0 0 * * *")] TimerInfo timerInfo)
    {
        _logger.LogInformation("Update function started at: {time}", DateTime.UtcNow);

        try
        {
            var result = await _xblClient.Update();
            
            if (result == 0)
            {
                _logger.LogInformation("XblClient Update completed successfully");
                await DownloadLiveImages();
                _logger.LogInformation("Image download completed successfully");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during update execution");
            throw;
        }

        _logger.LogInformation("Update function completed at: {time}", DateTime.UtcNow);
    }

    private async Task DownloadLiveImages()
    {
        var handler = new HttpClientHandler();
        handler.ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator;
        var hc = new HttpClient(handler);
        
        var tr = await _live.GetRepository<Title>();
        var all = await tr.GetAll();
        var titles = all.ToArray();
        
        _logger.LogInformation("Downloading {count} title images", titles.Length);
        
        var downloadedCount = 0;
        foreach (var title in titles)
        {
            var fileName = title.IntId + ".png";
            var filePath = Path.Combine(DataSource.DataFolder, "titles", fileName);
            if (!File.Exists(filePath))
            {
                try
                {
                    var img = title.DisplayImage;
                    var url = img.Contains('?') ? img + "&w=100" : img + "?w=100";
                    var bytes = await hc.GetByteArrayAsync(url);
                    await File.WriteAllBytesAsync(filePath, bytes);
                    downloadedCount++;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to download image for title {titleId}", title.IntId);
                }
            }
        }
        _logger.LogInformation("Downloaded {downloaded} new title images", downloadedCount);

        var ar = await _live.GetRepository<Achievement>();
        var allAchievements = await ar.GetAll();
        var achievements = allAchievements.ToArray();
        
        _logger.LogInformation("Downloading {count} achievement images", achievements.Length);
        
        downloadedCount = 0;
        foreach (var achievement in achievements)
        {
            var fileName = achievement.TitleId + "." + achievement.Id + ".png";
            var filePath = Path.Combine(DataSource.DataFolder, "achievements", fileName);
            if (!File.Exists(filePath))
            {
                try
                {
                    var img = achievement.DisplayImage;
                    if (img != null)
                    {
                        var bytes = await hc.GetByteArrayAsync(img + "&w=400");
                        await File.WriteAllBytesAsync(filePath, bytes);
                        downloadedCount++;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to download image for achievement {achievementId} in title {titleId}", 
                        achievement.Id, achievement.TitleId);
                }
            }
        }
        _logger.LogInformation("Downloaded {downloaded} new achievement images", downloadedCount);
    }
}
