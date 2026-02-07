using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Xbl.Client;
using Xbl.Client.Io;
using Xbl.Client.Models.Xbl.Achievements;
using Xbl.Data;

namespace Xbl.Web.Update;

public class UpdateService
{
    private readonly ILogger<UpdateService> _logger;
    private readonly IXblClient _xblClient;
    private readonly GlobalConfig _config;
    private readonly IDatabaseContext _live;
    private readonly IBlobStorageService _blobStorageService;

    public UpdateService(
        ILogger<UpdateService> logger,
        IXblClient xblClient,
        GlobalConfig config,
        [FromKeyedServices(DataSource.Live)] IDatabaseContext live,
        IBlobStorageService blobStorageService)
    {
        _logger = logger;
        _xblClient = xblClient;
        _config = config;
        _live = live;
        _blobStorageService = blobStorageService;
    }

    public async Task<int> RunAsync()
    {
        _logger.LogInformation("Update started at: {Time}", DateTime.UtcNow);

        try
        {
            var result = await _xblClient.Update();

            _logger.LogInformation("XblClient Update completed successfully");
            _logger.LogInformation("Update summary: Titles (Inserted: {TitlesInserted}, Updated: {TitlesUpdated}), " +
                                 "Achievements (Inserted: {AchievementsInserted}, Updated: {AchievementsUpdated}), " +
                                 "Stats (Inserted: {StatsInserted}, Updated: {StatsUpdated})",
                result.TitlesInserted, result.TitlesUpdated,
                result.AchievementsInserted, result.AchievementsUpdated,
                result.StatsInserted, result.StatsUpdated);

            var (newTitleImages, newAchievementImages) = await DownloadAndUploadImagesAsync();
            _logger.LogInformation("Image download and upload completed. New images: {TitleImages} titles, {AchievementImages} achievements",
                newTitleImages, newAchievementImages);

            var totalChanges = result.TotalChanges + newTitleImages + newAchievementImages;
            _logger.LogInformation("Total changes: {TotalChanges}", totalChanges);

            _logger.LogInformation("Update completed at: {Time}", DateTime.UtcNow);

            if (totalChanges == 0)
            {
                _logger.LogInformation("No new data found. Skipping deployment.");
                return 2;
            }

            return 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during update execution");
            return 1;
        }
    }

    private async Task<(int TitleImages, int AchievementImages)> DownloadAndUploadImagesAsync()
    {
        var handler = new HttpClientHandler
        {
            ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
        };
        using var httpClient = new HttpClient(handler);

        var titleImages = await DownloadTitleImagesAsync(httpClient);
        var achievementImages = await DownloadAchievementImagesAsync(httpClient);
        
        return (titleImages, achievementImages);
    }

    private async Task<int> DownloadTitleImagesAsync(HttpClient httpClient)
    {
        var tr = await _live.GetRepository<Title>();
        var all = await tr.GetAll();
        var titles = all.ToArray();

        _logger.LogInformation("Processing title images");

        var count = 0;

        foreach (var title in titles)
        {
            var fileName = $"{title.IntId}.png";
            var filePath = Path.Combine(_config.DataFolder, "titles", fileName);

            try
            {
                if (!File.Exists(filePath))
                {
                    var img = title.DisplayImage;
                    var url = img.Contains('?') ? $"{img}&w=100" : $"{img}?w=100";
                    var bytes = await httpClient.GetByteArrayAsync(url);

                    Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);
                    await File.WriteAllBytesAsync(filePath, bytes);
                    await _blobStorageService.UploadImageAsync("titles", fileName, bytes);
                    count++;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to process image for title {TitleId}", title.IntId);
            }
        }

        _logger.LogInformation("Uploaded {Uploaded} new title images to blob storage", count);
        return count;
    }

    private async Task<int> DownloadAchievementImagesAsync(HttpClient httpClient)
    {
        var ar = await _live.GetRepository<Achievement>();
        var allAchievements = await ar.GetAll();
        var achievements = allAchievements.ToArray();

        _logger.LogInformation("Processing achievement images");

        var count = 0;

        foreach (var achievement in achievements)
        {
            var fileName = $"{achievement.TitleId}.{achievement.Id}.png";
            var filePath = Path.Combine(_config.DataFolder, "achievements", fileName);

            try
            {
                if (string.IsNullOrEmpty(achievement.DisplayImage)) continue;

                if (!File.Exists(filePath))
                {
                    var bytes = await httpClient.GetByteArrayAsync($"{achievement.DisplayImage}&w=400");

                    Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);
                    await File.WriteAllBytesAsync(filePath, bytes);
                    await _blobStorageService.UploadImageAsync("achievements", fileName, bytes);
                    count++;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to process image for achievement {AchievementId} in title {TitleId}",
                    achievement.Id, achievement.TitleId);
            }
        }

        _logger.LogInformation("Uploaded {Uploaded} new achievement images to blob storage", count);
        return count;
    }
}
