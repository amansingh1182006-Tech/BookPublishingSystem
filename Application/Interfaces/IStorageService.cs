using Application.DTOs;
using Microsoft.AspNetCore.Http;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Application.Interfaces
{
    public interface IStorageService
    {
        Task<string> SaveCoverImageAsync(IFormFile coverImage, string bookCode);
        Task<string> SaveChapterFileAsync(IFormFile file, Guid bookId, int sequenceNumber);
        List<InterleavedSegmentChunkInfo> ProcessAndSplitPdfInterleaved(IFormFile mainPdf, string bookCode, int pagesPerChunk = 4);
    }
}