namespace Xbl.Web.Update;

public interface IBlobStorageService
{
    Task UploadImageAsync(string containerName, string blobName, byte[] data);
}
