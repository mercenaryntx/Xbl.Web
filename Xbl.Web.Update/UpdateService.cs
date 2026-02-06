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
    private readonly IDatabaseContext _live;
    private readonly IBlobStorageService _blobStorageService;

    public UpdateService(
        ILogger<UpdateService> logger,
        IXblClient xblClient,
        [FromKeyedServices(DataSource.Live)] IDatabaseContext live,
        IBlobStorageService blobStorageService)
    {
        _logger = logger;
        _xblClient = xblClient;
        _live = live;
        _blobStorageService = blobStorageService;
    }

    public async Task<int> RunAsync()
    {
        _logger.LogInformation("Update started at: {Time}", DateTime.UtcNow);

        try
        {
            var result = await _xblClient.Update();

            if (result == 0)
            {
                _logger.LogInformation("XblClient Update completed successfully");
                await DownloadAndUploadImagesAsync();
                _logger.LogInformation("Image download and upload completed successfully");
            }
            else
            {
                _logger.LogError("XblClient Update failed with code: {Result}", result);
                return result;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during update execution");
            return 1;
        }

        _logger.LogInformation("Update completed at: {Time}", DateTime.UtcNow);
        return 0;
    }

    private async Task DownloadAndUploadImagesAsync()
    {
        var handler = new HttpClientHandler
        {
            ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
        };
        using var httpClient = new HttpClient(handler);

        await DownloadTitleImagesAsync(httpClient);
        await DownloadAchievementImagesAsync(httpClient);
    }

    private async Task DownloadTitleImagesAsync(HttpClient httpClient)
    {
        var tr = await _live.GetRepository<Title>();
        var all = await tr.GetAll();
        var titles = all.ToArray();

        _logger.LogInformation("Processing {Count} title images", titles.Length);

        var downloadedCount = 0;
        var uploadedCount = 0;

        foreach (var title in titles)
        {
            var fileName = $"{title.IntId}.png";
            var filePath = Path.Combine(DataSource.DataFolder, "titles", fileName);

            try
            {
                byte[] bytes;
                var needsDownload = !File.Exists(filePath);

                if (needsDownload)
                {
                    var img = title.DisplayImage;
                    var url = img.Contains('?') ? $"{img}&w=100" : $"{img}?w=100";
                    bytes = await httpClient.GetByteArrayAsync(url);

                    Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);
                    await File.WriteAllBytesAsync(filePath, bytes);
                    downloadedCount++;
                }
                else
                {
                    bytes = await File.ReadAllBytesAsync(filePath);
                }

                await _blobStorageService.UploadImageAsync("titles", fileName, bytes);
                uploadedCount++;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to process image for title {TitleId}", title.IntId);
            }
        }

        _logger.LogInformation("Downloaded {Downloaded} new title images, uploaded {Uploaded} to blob storage", downloadedCount, uploadedCount);
    }

    private async Task DownloadAchievementImagesAsync(HttpClient httpClient)
    {
        var ar = await _live.GetRepository<Achievement>();
        var allAchievements = await ar.GetAll();
        var achievements = allAchievements.ToArray();

        _logger.LogInformation("Processing {Count} achievement images", achievements.Length);

        var downloadedCount = 0;
        var uploadedCount = 0;

        foreach (var achievement in achievements)
        {
            var fileName = $"{achievement.TitleId}.{achievement.Id}.png";
            var filePath = Path.Combine(DataSource.DataFolder, "achievements", fileName);

            try
            {
                if (string.IsNullOrEmpty(achievement.DisplayImage))
                    continue;

                byte[] bytes;
                var needsDownload = !File.Exists(filePath);

                if (needsDownload)
                {
                    bytes = await httpClient.GetByteArrayAsync($"{achievement.DisplayImage}&w=400");

                    Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);
                    await File.WriteAllBytesAsync(filePath, bytes);
                    downloadedCount++;
                }
                else
                {
                    bytes = await File.ReadAllBytesAsync(filePath);
                }

                await _blobStorageService.UploadImageAsync("achievements", fileName, bytes);
                uploadedCount++;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to process image for achievement {AchievementId} in title {TitleId}",
                    achievement.Id, achievement.TitleId);
            }
        }

        _logger.LogInformation("Downloaded {Downloaded} new achievement images, uploaded {Uploaded} to blob storage", downloadedCount, uploadedCount);
    }
}
