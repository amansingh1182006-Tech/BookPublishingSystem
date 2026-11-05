using Application.DTOs;
using Application.Interfaces;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using PdfSharpCore.Pdf;
using PdfSharpCore.Pdf.IO;
using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;

namespace Infrastructure.Storage
{
    public class LocalSecureStorageService : IStorageService
    {
        private readonly IWebHostEnvironment _environment;
        private readonly string _baseStoragePath;

        public LocalSecureStorageService(IWebHostEnvironment environment, IConfiguration configuration)
        {
            _environment = environment;

           
            string configuredPath = configuration["StorageSettings:BaseDrivePath"];
            if (string.IsNullOrWhiteSpace(configuredPath))
            {
                configuredPath = @"C:\RadarBooks\B.Jain Store Book";
            }

            _baseStoragePath = Path.Combine(configuredPath, "Books");

            if (!Directory.Exists(_baseStoragePath))
            {
                Directory.CreateDirectory(_baseStoragePath);
            }
        }

        public async Task<string> SaveCoverImageAsync(IFormFile coverImage, string bookCode)
        {
            if (coverImage == null || coverImage.Length == 0)
                return "/images/default-cover.png";

            string wwwrootCoversFolder = Path.Combine(_environment.WebRootPath, "images", "covers");
            if (!Directory.Exists(wwwrootCoversFolder))
            {
                Directory.CreateDirectory(wwwrootCoversFolder);
            }

            string extension = Path.GetExtension(coverImage.FileName);
            string fileName = $"{bookCode}_cover_{Guid.NewGuid()}{extension}";
            string fullPath = Path.Combine(wwwrootCoversFolder, fileName);

            using (var stream = new FileStream(fullPath, FileMode.Create))
            {
                await coverImage.CopyToAsync(stream);
            }

            return $"/images/covers/{fileName}";
        }

        public async Task<string> SaveChapterFileAsync(IFormFile file, Guid bookId, int sequenceNumber)
        {
            string uploadsFolder = Path.Combine(_baseStoragePath, "Chapters", bookId.ToString());

            if (!Directory.Exists(uploadsFolder))
            {
                Directory.CreateDirectory(uploadsFolder);
            }

            string fileName = $"Chapter_{sequenceNumber}_{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
            string filePath = Path.Combine(uploadsFolder, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            return filePath;
        }

        public List<InterleavedSegmentChunkInfo> ProcessAndSplitPdfInterleaved(IFormFile mainPdf, string bookCode, int pagesPerChunk = 4)
        {
            var chunkList = new List<InterleavedSegmentChunkInfo>();

            string bookFolder = Path.Combine(_baseStoragePath, bookCode.Trim().ToUpper());
            Directory.CreateDirectory(bookFolder);

            string[] threeFolders = new string[]
            {
        Path.Combine(bookFolder, "Alpha_Storage"),
        Path.Combine(bookFolder, "Beta_Storage"),
        Path.Combine(bookFolder, "Gamma_Storage")
            };

            foreach (var dir in threeFolders)
            {
                if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
            }

            using (var inputStream = mainPdf.OpenReadStream())
            {
                PdfDocument inputDocument = PdfReader.Open(inputStream, PdfDocumentOpenMode.Import);
                int totalPages = inputDocument.PageCount;

                var unmappedPages = new List<int>();
                for (int i = 0; i < totalPages; i++) unmappedPages.Add(i);

                Guid? previousChunkId = null;
                int turn = 0;

                while (unmappedPages.Count > 0)
                {
                    Guid currentChunkId = Guid.NewGuid();
                    string selectedFolder = threeFolders[turn];

                    var currentChunkPages = new List<int>();
                    int step = 2;
                    int currentIndex = 0;

                    for (int k = 0; k < pagesPerChunk && unmappedPages.Count > 0; k++)
                    {
                        if (currentIndex >= unmappedPages.Count)
                        {
                            currentIndex = 0;
                        }

                        int originalPageIndex = unmappedPages[currentIndex];
                        currentChunkPages.Add(originalPageIndex);

                        unmappedPages.RemoveAt(currentIndex);
                        currentIndex += (step - 1);
                    }

                    using (PdfDocument chunkDocument = new PdfDocument())
                    {
                        foreach (int pageIdx in currentChunkPages)
                        {
                            chunkDocument.AddPage(inputDocument.Pages[pageIdx]);
                        }

                        string chunkFileName = $"alt_{currentChunkId:N}.dat";
                        string chunkPhysicalPath = Path.Combine(selectedFolder, chunkFileName);
                        chunkDocument.Save(chunkPhysicalPath);

                        string folderName = turn == 0 ? "Alpha_Storage" : (turn == 1 ? "Beta_Storage" : "Gamma_Storage");
                        string fullPathInDrive = Path.Combine(_baseStoragePath, bookCode.Trim().ToUpper(), folderName, chunkFileName);

                        chunkList.Add(new InterleavedSegmentChunkInfo
                        {
                            ChunkId = currentChunkId,
                            ParentChunkId = previousChunkId,
                            StorageRelativePath = fullPathInDrive,
                            TableTarget = turn == 0 ? "Alpha" : (turn == 1 ? "Beta" : "Gamma"),
                            PageIndices = string.Join(",", currentChunkPages)
                        });

                        previousChunkId = currentChunkId;
                        turn = (turn + 1) % 3;
                    }
                }
            }

            return chunkList;
        }
    }
}