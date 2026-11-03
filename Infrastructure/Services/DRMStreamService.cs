using Application.Interfaces;
using Microsoft.AspNetCore.Hosting;

namespace Infrastructure.Services
{
    public class DRMStreamService : IChapterStreamService
    {
        private readonly IWebHostEnvironment _environment;

        public DRMStreamService(IWebHostEnvironment environment)
        {
            _environment = environment;
        }

        public Task<Stream?> GetEncryptedChapterStreamAsync(string relativePath)
        {
            string fullPath = Path.Combine(_environment.ContentRootPath, relativePath);
            if (!File.Exists(fullPath))
            {
                return Task.FromResult<Stream?>(null);
            }

            Stream fileStream = new FileStream(fullPath, FileMode.Open, FileAccess.Read);
            return Task.FromResult<Stream?>(fileStream);
        }
    }
}