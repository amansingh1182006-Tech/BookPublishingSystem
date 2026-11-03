using Application.DTOs;
using Application.Interfaces;
using BookPublishingSystem.Domain.Entities;
using Infrastructure.Persistence;
using Infrastructure.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using PdfSharpCore.Pdf;
using PdfSharpCore.Pdf.IO;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace Web.Areas.Author.Controllers
{
    [Area("Author")]
    [Authorize(Roles = "Author,Publisher,Admin")]
    [Route("api/author/[controller]")]
    [ApiController]
    public class BookController : ControllerBase
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly LocalSecureStorageService _storageService;
        private readonly IWebHostEnvironment _environment;
        private readonly IConfiguration _configuration;

        public BookController(
            ApplicationDbContext dbContext,
            UserManager<ApplicationUser> userManager,
            IStorageService storageService,
            IWebHostEnvironment environment,
            IConfiguration configuration)
        {
            _dbContext = dbContext;
            _userManager = userManager;
            _storageService = (LocalSecureStorageService)storageService;
            _environment = environment;
            _configuration = configuration;
        }

        [HttpPost("upload-full-book")]
        public async Task<IActionResult> UploadFullBook([FromForm] BookUploadDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.ItemNo))
                return BadRequest(new { message = "Item Code is required." });

            if (dto.MainPdf == null || dto.MainPdf.Length == 0)
                return BadRequest(new { message = "Main PDF file is required." });

            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized(new { message = "Session expired." });

            try
            {
                string coverPath = "/images/default-cover.png";
                if (dto.CoverImage != null && dto.CoverImage.Length > 0)
                {
                    coverPath = await _storageService.SaveCoverImageAsync(dto.CoverImage, dto.ItemNo);
                }

                var book = new Book
                {
                    Id = Guid.NewGuid(),
                    ItemNo = dto.ItemNo.Trim().ToUpper(),
                    ISBN = string.IsNullOrWhiteSpace(dto.ISBN) ? "N/A" : dto.ISBN.Trim(),
                    ItemName = dto.ItemName.Trim(),
                    CategoryCode = string.IsNullOrWhiteSpace(dto.CategoryCode) ? "HOMEO" : dto.CategoryCode.Trim(),
                    NoOfPages = dto.NoOfPages <= 0 ? 1 : dto.NoOfPages,
                    Language = string.IsNullOrWhiteSpace(dto.Language) ? "English" : dto.Language.Trim(),
                    Description = string.IsNullOrWhiteSpace(dto.Description) ? "Official Homoeopathy Publication" : dto.Description,
                    CoverImagePath = coverPath,
                    Price = dto.Price,
                    AuthorId = user.Id,
                    IsPublished = false,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _dbContext.Books.Add(book);

                var chunkInfos = _storageService.ProcessAndSplitPdfInterleaved(dto.MainPdf, dto.ItemNo, 4);

                foreach (var info in chunkInfos)
                {
                    if (info.TableTarget == "Alpha")
                    {
                        _dbContext.BookSegmentsAlpha.Add(new BookSegmentAlpha
                        {
                            Id = info.ChunkId,
                            BookId = book.Id,
                            ParentChunkId = info.ParentChunkId,
                            StorageRelativePath = info.StorageRelativePath,
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                    else if (info.TableTarget == "Beta")
                    {
                        _dbContext.BookSegmentsBeta.Add(new BookSegmentBeta
                        {
                            Id = info.ChunkId,
                            BookId = book.Id,
                            ParentChunkId = info.ParentChunkId,
                            StorageRelativePath = info.StorageRelativePath,
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                    else
                    {
                        _dbContext.BookSegmentsGamma.Add(new BookSegmentGamma
                        {
                            Id = info.ChunkId,
                            BookId = book.Id,
                            ParentChunkId = info.ParentChunkId,
                            StorageRelativePath = info.StorageRelativePath,
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                }

                await _dbContext.SaveChangesAsync();

                return Ok(new
                {
                    message = $"Book '{book.ItemName}' split and saved directly to Desktop Storage successfully!",
                    bookId = book.Id
                });
            }
            catch (Exception ex)
            {
                var msg = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return StatusCode(500, new { message = $"Server Error: {msg}" });
            }
        }

        // FETCH ALL BOOKS FOR ITEMS MASTER LIST VIEW
        [HttpGet("my-books")]
        public async Task<IActionResult> GetMyBooks()
        {
            try
            {
                var books = await _dbContext.Books
                    .OrderByDescending(b => b.CreatedAt)
                    .Select(b => new
                    {
                        id = b.Id,
                        itemNo = b.ItemNo,
                        itemName = b.ItemName,
                        isbn = b.ISBN,
                        categoryCode = b.CategoryCode,
                        noOfPages = b.NoOfPages,
                        language = b.Language,
                        description = b.Description,
                        price = b.Price,
                        image = b.CoverImagePath,
                        authorName = b.Author != null ? b.Author.FullName ?? b.Author.UserName : "System Administrator",
                        author = b.Author != null ? b.Author.FullName ?? b.Author.UserName : "System Administrator",
                        isPublished = b.IsPublished,
                        createdAt = b.CreatedAt
                    })
                    .ToListAsync();

                return Ok(books);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error fetching books: " + ex.Message });
            }
        }

        // APPROVE BOOK DRAFT FOR STORE PUBLISHING
        [HttpPost("approve-book/{id}")]
        public async Task<IActionResult> ApproveBook(string id)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(id))
                    return BadRequest(new { success = false, message = "Invalid Book Identifier." });

                Book book = null;

                if (Guid.TryParse(id, out Guid parsedGuid))
                {
                    book = await _dbContext.Books.FindAsync(parsedGuid);
                }

                if (book == null)
                {
                    book = await _dbContext.Books.FirstOrDefaultAsync(b => b.ItemNo.ToLower() == id.Trim().ToLower());
                }

                if (book == null)
                {
                    return NotFound(new { success = false, message = $"Book '{id}' database mein nahi mila." });
                }

                book.IsPublished = true;
                book.UpdatedAt = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync();

                return Ok(new { success = true, message = $"Book '{book.ItemName}' approved & live on Store!" });
            }
            catch (Exception ex)
            {
                var errorMsg = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return StatusCode(500, new { success = false, message = "Approval Error: " + errorMsg });
            }
        }

        // UPDATE BOOK MASTER (USING DEDICATED BookUpdateDto)
        [HttpPut("update-book/{id}")]
        [HttpPost("update-book/{id}")]
        public async Task<IActionResult> UpdateBook(string id, [FromForm] BookUpdateDto dto)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(id))
                    return BadRequest(new { success = false, message = "Book ID is required." });

                Book book = null;

                if (Guid.TryParse(id, out Guid parsedGuid))
                {
                    book = await _dbContext.Books.FindAsync(parsedGuid);
                }

                if (book == null)
                {
                    book = await _dbContext.Books.FirstOrDefaultAsync(b => b.ItemNo.ToLower() == id.Trim().ToLower());
                }

                if (book == null)
                    return NotFound(new { success = false, message = $"Book '{id}' database mein nahi mila." });

                // Apply DTO updates
                if (!string.IsNullOrWhiteSpace(dto.ItemName)) book.ItemName = dto.ItemName.Trim();
                if (dto.Price >= 0) book.Price = dto.Price;
                if (dto.NoOfPages > 0) book.NoOfPages = dto.NoOfPages;
                if (!string.IsNullOrWhiteSpace(dto.Language)) book.Language = dto.Language.Trim();
                if (!string.IsNullOrWhiteSpace(dto.CategoryCode)) book.CategoryCode = dto.CategoryCode.Trim();
                if (!string.IsNullOrWhiteSpace(dto.Description)) book.Description = dto.Description.Trim();

                // Optional Cover Image Update
                if (dto.CoverImage != null && dto.CoverImage.Length > 0)
                {
                    string coverPath = await _storageService.SaveCoverImageAsync(dto.CoverImage, book.ItemNo);
                    book.CoverImagePath = coverPath;
                }

                // Optional Full Book PDF Replacement & Re-splitting Chunks
                if (dto.MainPdf != null && dto.MainPdf.Length > 0)
                {
                    var oldAlpha = _dbContext.BookSegmentsAlpha.Where(s => s.BookId == book.Id);
                    var oldBeta = _dbContext.BookSegmentsBeta.Where(s => s.BookId == book.Id);
                    var oldGamma = _dbContext.BookSegmentsGamma.Where(s => s.BookId == book.Id);

                    _dbContext.BookSegmentsAlpha.RemoveRange(oldAlpha);
                    _dbContext.BookSegmentsBeta.RemoveRange(oldBeta);
                    _dbContext.BookSegmentsGamma.RemoveRange(oldGamma);

                    var chunkInfos = _storageService.ProcessAndSplitPdfInterleaved(dto.MainPdf, book.ItemNo, 4);

                    foreach (var info in chunkInfos)
                    {
                        if (info.TableTarget == "Alpha")
                        {
                            _dbContext.BookSegmentsAlpha.Add(new BookSegmentAlpha
                            {
                                Id = info.ChunkId,
                                BookId = book.Id,
                                ParentChunkId = info.ParentChunkId,
                                StorageRelativePath = info.StorageRelativePath,
                                CreatedAt = DateTime.UtcNow
                            });
                        }
                        else if (info.TableTarget == "Beta")
                        {
                            _dbContext.BookSegmentsBeta.Add(new BookSegmentBeta
                            {
                                Id = info.ChunkId,
                                BookId = book.Id,
                                ParentChunkId = info.ParentChunkId,
                                StorageRelativePath = info.StorageRelativePath,
                                CreatedAt = DateTime.UtcNow
                            });
                        }
                        else
                        {
                            _dbContext.BookSegmentsGamma.Add(new BookSegmentGamma
                            {
                                Id = info.ChunkId,
                                BookId = book.Id,
                                ParentChunkId = info.ParentChunkId,
                                StorageRelativePath = info.StorageRelativePath,
                                CreatedAt = DateTime.UtcNow
                            });
                        }
                    }
                }

                book.UpdatedAt = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync();

                return Ok(new { success = true, message = $"Book '{book.ItemName}' details updated successfully!" });
            }
            catch (Exception ex)
            {
                var errorMsg = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return StatusCode(500, new { success = false, message = "Update Error: " + errorMsg });
            }
        }

        // DELETE BOOK MASTER
        [HttpDelete("delete-book/{id:guid}")]
        public async Task<IActionResult> DeleteBook(Guid id)
        {
            var book = await _dbContext.Books.FindAsync(id);
            if (book == null) return NotFound(new { message = "Book not found." });

            var alpha = _dbContext.BookSegmentsAlpha.Where(s => s.BookId == id);
            var beta = _dbContext.BookSegmentsBeta.Where(s => s.BookId == id);
            var gamma = _dbContext.BookSegmentsGamma.Where(s => s.BookId == id);

            _dbContext.BookSegmentsAlpha.RemoveRange(alpha);
            _dbContext.BookSegmentsBeta.RemoveRange(beta);
            _dbContext.BookSegmentsGamma.RemoveRange(gamma);

            _dbContext.Books.Remove(book);
            await _dbContext.SaveChangesAsync();

            return Ok(new { message = "Book and chunk segments deleted successfully." });
        }

        // DUAL COMPATIBLE VIEW PDF METHOD (SEQUENCE RE-ORDERING FIX)
        [HttpGet("view-pdf/{identifier}")]
        public async Task<IActionResult> ViewPdf(string identifier)
        {
            if (string.IsNullOrWhiteSpace(identifier))
                return BadRequest("Identifier is required.");

            Book book = null;
            if (Guid.TryParse(identifier, out Guid parsedGuid))
            {
                book = await _dbContext.Books.FirstOrDefaultAsync(b => b.Id == parsedGuid);
            }

            if (book == null)
            {
                book = await _dbContext.Books.FirstOrDefaultAsync(b => b.ItemNo.ToLower() == identifier.Trim().ToLower());
            }

            if (book == null) return NotFound($"Book '{identifier}' database mein nahi mila.");

            Guid bookId = book.Id;

            var alphaSegments = await _dbContext.BookSegmentsAlpha.Where(s => s.BookId == bookId).ToListAsync();
            var betaSegments = await _dbContext.BookSegmentsBeta.Where(s => s.BookId == bookId).ToListAsync();
            var gammaSegments = await _dbContext.BookSegmentsGamma.Where(s => s.BookId == bookId).ToListAsync();

            var combinedList = new List<SegmentNode>();
            combinedList.AddRange(alphaSegments.Select(a => new SegmentNode { Id = a.Id, ParentId = a.ParentChunkId, Path = a.StorageRelativePath }));
            combinedList.AddRange(betaSegments.Select(b => new SegmentNode { Id = b.Id, ParentId = b.ParentChunkId, Path = b.StorageRelativePath }));
            combinedList.AddRange(gammaSegments.Select(g => new SegmentNode { Id = g.Id, ParentId = g.ParentChunkId, Path = g.StorageRelativePath }));

            if (!combinedList.Any()) return NotFound("Record mil gaya par is book ke PDF segments missing hain.");

            var orderedSegments = new List<SegmentNode>();
            var current = combinedList.FirstOrDefault(s => s.ParentId == null);

            while (current != null)
            {
                orderedSegments.Add(current);
                current = combinedList.FirstOrDefault(s => s.ParentId == current.Id);
            }

            if (!orderedSegments.Any())
            {
                orderedSegments = combinedList;
            }

            var openedDocuments = new List<PdfDocument>();
            var extractedPages = new List<PdfPage>();

            try
            {
                using (PdfDocument outputDocument = new PdfDocument())
                {
                    string desktopBasePath = _configuration["StorageSettings:BaseDrivePath"] ?? @"C:\Users\ADMIN\Desktop\B.Jain Store Book";

                    
                    foreach (var seg in orderedSegments)
                    {
                        string physicalPath = seg.Path;

                        if (!System.IO.File.Exists(physicalPath))
                        {
                            string cleanPath = seg.Path.TrimStart('/', '\\').Replace("/", Path.DirectorySeparatorChar.ToString());
                            physicalPath = Path.Combine(_environment.ContentRootPath, cleanPath);
                        }

                        if (!System.IO.File.Exists(physicalPath))
                        {
                            string fileName = Path.GetFileName(seg.Path);
                            string folderName = seg.Path.Contains("Alpha") ? "Alpha_Storage" : (seg.Path.Contains("Beta") ? "Beta_Storage" : "Gamma_Storage");
                            physicalPath = Path.Combine(desktopBasePath, "Books", book.ItemNo.Trim().ToUpper(), folderName, fileName);
                        }

                        if (System.IO.File.Exists(physicalPath))
                        {
                            PdfDocument inputChunk = PdfReader.Open(physicalPath, PdfDocumentOpenMode.Import);
                            openedDocuments.Add(inputChunk);

                            for (int pageIdx = 0; pageIdx < inputChunk.PageCount; pageIdx++)
                            {
                                extractedPages.Add(inputChunk.Pages[pageIdx]);
                            }
                        }
                    }

                    if (!extractedPages.Any())
                    {
                        return NotFound("PDF Chunks physical disk location par nahi mile.");
                    }

                   
                    int pagesPerChunk = 4;
                    int totalExtracted = extractedPages.Count;
                    PdfPage[] reorderedArray = new PdfPage[totalExtracted];

                    var unmappedIndices = new List<int>();
                    for (int i = 0; i < totalExtracted; i++) unmappedIndices.Add(i);

                    int currentSourceIdx = 0;
                    int step = 2;
                    int nextTargetPos = 0;

                    while (unmappedIndices.Count > 0 && currentSourceIdx < totalExtracted)
                    {
                        int targetIndexInChunk = 0;
                        for (int k = 0; k < pagesPerChunk && unmappedIndices.Count > 0; k++)
                        {
                            if (targetIndexInChunk >= unmappedIndices.Count)
                            {
                                targetIndexInChunk = 0;
                            }

                            int originalPageIndex = unmappedIndices[targetIndexInChunk];

                            if (originalPageIndex < totalExtracted)
                            {
                                reorderedArray[originalPageIndex] = extractedPages[currentSourceIdx++];
                            }

                            unmappedIndices.RemoveAt(targetIndexInChunk);
                            targetIndexInChunk += (step - 1);
                        }
                    }

                    
                    for (int i = 0; i < totalExtracted; i++)
                    {
                        if (reorderedArray[i] != null)
                        {
                            outputDocument.AddPage(reorderedArray[i]);
                        }
                        else if (i < extractedPages.Count)
                        {
                            outputDocument.AddPage(extractedPages[i]);
                        }
                    }

                    MemoryStream stream = new MemoryStream();
                    outputDocument.Save(stream, false);
                    stream.Position = 0;

                    return File(stream, "application/pdf");
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"PDF Stitching Error: {ex.Message}");
            }
            finally
            {
                foreach (var doc in openedDocuments) doc.Dispose();
            }
        }
    }
}