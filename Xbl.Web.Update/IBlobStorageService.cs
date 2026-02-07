namespace Xbl.Web.Update;

public interface IBlobStorageService
{
    Task UploadImageAsync(string containerName, string blobName, byte[] data);
    Task<bool> BlobExistsAsync(string containerName, string blobName);
    Task<HashSet<string>> GetExistingBlobsAsync(string containerName, string prefix = "");
}
