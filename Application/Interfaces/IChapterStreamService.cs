namespace Application.Interfaces
{
    public interface IChapterStreamService
    {
        Task<Stream?> GetEncryptedChapterStreamAsync(string relativePath);
    }
}