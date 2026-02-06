using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.Extensions.Logging;

namespace Xbl.Web.Update;

public class BlobStorageService : IBlobStorageService
{
    private readonly BlobServiceClient _blobServiceClient;
    private readonly ILogger<BlobStorageService> _logger;

    public BlobStorageService(BlobServiceClient blobServiceClient, ILogger<BlobStorageService> logger)
    {
        _blobServiceClient = blobServiceClient;
        _logger = logger;
    }

    public async Task UploadImageAsync(string containerName, string blobName, byte[] data)
    {
        try
        {
            var containerClient = _blobServiceClient.GetBlobContainerClient(containerName);
            await containerClient.CreateIfNotExistsAsync(PublicAccessType.Blob);

            var blobClient = containerClient.GetBlobClient(blobName);
            
            using var stream = new MemoryStream(data);
            var blobHttpHeaders = new BlobHttpHeaders { ContentType = "image/png" };
            
            await blobClient.UploadAsync(stream, new BlobUploadOptions 
            { 
                HttpHeaders = blobHttpHeaders,
                Conditions = null
            });

            _logger.LogDebug("Uploaded blob {BlobName} to container {ContainerName}", blobName, containerName);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to upload blob {BlobName} to container {ContainerName}", blobName, containerName);
        }
    }
}
