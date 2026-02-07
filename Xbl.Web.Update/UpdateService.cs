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

        // Process title and achievement images in parallel
        var titleImagesTask = DownloadTitleImagesAsync(httpClient);
        var achievementImagesTask = DownloadAchievementImagesAsync(httpClient);
        
        await Task.WhenAll(titleImagesTask, achievementImagesTask);
        
        return (await titleImagesTask, await achievementImagesTask);
    }

    private async Task<int> DownloadTitleImagesAsync(HttpClient httpClient)
    {
        var tr = await _live.GetRepository<Title>();
        var all = await tr.GetAll();
        var titles = all.ToArray();

        _logger.LogInformation("Processing {Count} title images", titles.Length);

        // Get existing blobs from storage
        var existingBlobs = await _blobStorageService.GetExistingBlobsAsync("titles");
        _logger.LogInformation("Found {Count} existing title images in blob storage", existingBlobs.Count);

        // Filter to only titles that need processing (not in blob storage)
        var titlesToProcess = titles
            .Where(t => !existingBlobs.Contains($"{t.IntId}.png"))
            .ToArray();

        _logger.LogInformation("Need to download {Count} missing title images", titlesToProcess.Length);

        if (titlesToProcess.Length == 0)
        {
            return 0;
        }

        // Process images in parallel with a degree of parallelism
        var semaphore = new SemaphoreSlim(10); // Limit concurrent downloads to 10
        var successCount = 0;
        var lockObj = new object();

        var tasks = titlesToProcess.Select(async title =>
        {
            await semaphore.WaitAsync();
            try
            {
                var fileName = $"{title.IntId}.png";
                var filePath = Path.Combine(_config.DataFolder, "titles", fileName);

                var img = title.DisplayImage;
                var url = img.Contains('?') ? $"{img}&w=100" : $"{img}?w=100";
                var bytes = await httpClient.GetByteArrayAsync(url);

                Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);
                await File.WriteAllBytesAsync(filePath, bytes);
                await _blobStorageService.UploadImageAsync("titles", fileName, bytes);

                lock (lockObj)
                {
                    successCount++;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to process image for title {TitleId}", title.IntId);
            }
            finally
            {
                semaphore.Release();
            }
        });

        await Task.WhenAll(tasks);

        _logger.LogInformation("Uploaded {Uploaded} new title images to blob storage", successCount);
        return successCount;
    }

    private async Task<int> DownloadAchievementImagesAsync(HttpClient httpClient)
    {
        var ar = await _live.GetRepository<Achievement>();
        var allAchievements = await ar.GetAll();
        var achievements = allAchievements
            .Where(a => !string.IsNullOrEmpty(a.DisplayImage))
            .ToArray();

        _logger.LogInformation("Processing {Count} achievement images", achievements.Length);

        // Get existing blobs from storage
        var existingBlobs = await _blobStorageService.GetExistingBlobsAsync("achievements");
        _logger.LogInformation("Found {Count} existing achievement images in blob storage", existingBlobs.Count);

        // Filter to only achievements that need processing (not in blob storage)
        var achievementsToProcess = achievements
            .Where(a => !existingBlobs.Contains($"{a.TitleId}.{a.Id}.png"))
            .ToArray();

        _logger.LogInformation("Need to download {Count} missing achievement images", achievementsToProcess.Length);

        if (achievementsToProcess.Length == 0)
        {
            return 0;
        }

        // Process images in parallel with a degree of parallelism
        var semaphore = new SemaphoreSlim(10); // Limit concurrent downloads to 10
        var successCount = 0;
        var lockObj = new object();

        var tasks = achievementsToProcess.Select(async achievement =>
        {
            await semaphore.WaitAsync();
            try
            {
                var fileName = $"{achievement.TitleId}.{achievement.Id}.png";
                var filePath = Path.Combine(_config.DataFolder, "achievements", fileName);

                var bytes = await httpClient.GetByteArrayAsync($"{achievement.DisplayImage}&w=400");

                Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);
                await File.WriteAllBytesAsync(filePath, bytes);
                await _blobStorageService.UploadImageAsync("achievements", fileName, bytes);

                lock (lockObj)
                {
                    successCount++;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to process image for achievement {AchievementId} in title {TitleId}",
                    achievement.Id, achievement.TitleId);
            }
            finally
            {
                semaphore.Release();
            }
        });

        await Task.WhenAll(tasks);

        _logger.LogInformation("Uploaded {Uploaded} new achievement images to blob storage", successCount);
        return successCount;
    }
}
