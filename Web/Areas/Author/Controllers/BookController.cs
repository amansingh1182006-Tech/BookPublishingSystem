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
using System.Net;
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

        public BookController(ApplicationDbContext dbContext, UserManager<ApplicationUser> userManager, IStorageService storageService, IWebHostEnvironment environment, IConfiguration configuration)
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


            var currentUser = await _userManager.GetUserAsync(User);
            if (currentUser == null) return Unauthorized(new { message = "Session expired." });

            try
            {
                string coverPath = "/images/default-cover.png";
                if (dto.CoverImage != null && dto.CoverImage.Length > 0)
                {
                    coverPath = await _storageService.SaveCoverImageAsync(dto.CoverImage, dto.ItemNo);
                }

                Guid? matchedAuthorMasterId = null;
                if (!string.IsNullOrWhiteSpace(dto.AuthorId) && Guid.TryParse(dto.AuthorId, out Guid parsedAuthGuid))
                {
                    matchedAuthorMasterId = parsedAuthGuid;
                }
                else if (!string.IsNullOrWhiteSpace(dto.AuthorName))
                {
                    var existingAuthor = await _dbContext.Authors
                        .FirstOrDefaultAsync(a => a.AuthorName.ToLower() == dto.AuthorName.Trim().ToLower());
                    if (existingAuthor != null)
                    {
                        matchedAuthorMasterId = existingAuthor.Id;
                    }
                }
                Guid? matchedVendorId = null;
                string finalVendorName = "In-House (B. Jain)";
                if (!string.IsNullOrWhiteSpace(dto.VendorName))
                {
                    string cleanVName = dto.VendorName.Trim().ToLower();
                    var existingVendor = await _dbContext.Vendors
                        .FirstOrDefaultAsync(v => v.Name.ToLower() == cleanVName || v.VendorCode.ToLower() == cleanVName);
                    if (existingVendor != null)
                    {
                        matchedVendorId = existingVendor.Id;
                        finalVendorName = existingVendor.Name;
                    }
                    else
                    {
                        finalVendorName = dto.VendorName.Trim();
                    }
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
                    AuthorMasterId = matchedAuthorMasterId,
                    AuthorId = currentUser.Id,
                    VendorId = matchedVendorId,
                    VendorName = finalVendorName,
                    IsPublished = false,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _dbContext.Books.Add(book);

                if (dto.MainPdf != null && dto.MainPdf.Length > 0)
                {
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
                }

                await _dbContext.SaveChangesAsync();

                return Ok(new
                {
                    message = (dto.MainPdf != null && dto.MainPdf.Length > 0)
                        ? $"Book '{book.ItemName}' split and saved directly to Desktop Storage successfully!"
                        : $"Book '{book.ItemName}' saved to Items list successfully (without PDF)!",
                    bookId = book.Id
                });
            }
            catch (Exception ex)
            {
                var msg = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return StatusCode(500, new { message = $"Server Error: {msg}" });
            }
        }

        [HttpPost("bulk-upload-grid")]
        public async Task<IActionResult> BulkUploadGrid([FromForm] BulkGridUploadRequest request)
        {
            if (request == null || request.Books == null || !request.Books.Any())
                return BadRequest(new { success = false, message = "This is not Provide any book of data." });

            var currentUser = await _userManager.GetUserAsync(User);
            if (currentUser == null)
                return Unauthorized(new { success = false, message = "Session is expire." });

            int successCount = 0;
            var errorLogs = new List<string>();

            for (int i = 0; i < request.Books.Count; i++)
            {
                var row = request.Books[i];
                if (string.IsNullOrWhiteSpace(row.ItemName)) continue;

                try
                {
                    Guid? matchedAuthorMasterId = null;
                    if (!string.IsNullOrWhiteSpace(row.AuthorName))
                    {
                        var existingAuthor = await _dbContext.Authors
                            .FirstOrDefaultAsync(a => a.AuthorName.ToLower() == row.AuthorName.Trim().ToLower());
                        if (existingAuthor != null) matchedAuthorMasterId = existingAuthor.Id;
                    }
                    Guid? matchedVendorId = null;
                    string finalVendorName = "In-House (B. Jain)";
                    if (!string.IsNullOrWhiteSpace(row.VendorName))
                    {
                        string cleanVName = row.VendorName.Trim().ToLower();
                        var existingVendor = await _dbContext.Vendors
                            .FirstOrDefaultAsync(v => v.Name.ToLower() == cleanVName || v.VendorCode.ToLower() == cleanVName);
                        if (existingVendor != null)
                        {
                            matchedVendorId = existingVendor.Id;
                            finalVendorName = existingVendor.Name;
                        }
                        else
                        {
                            finalVendorName = row.VendorName.Trim();
                        }
                    }

                    string itemNo = !string.IsNullOrWhiteSpace(row.ItemNo)
                        ? row.ItemNo.Trim().ToUpper()
                        : $"BK-{DateTime.UtcNow:yyMM}-{new Random().Next(1000, 9999)}";

                    string coverPath = "/images/default-cover.png";
                    if (row.CoverImage != null && row.CoverImage.Length > 0)
                    {
                        coverPath = await _storageService.SaveCoverImageAsync(row.CoverImage, itemNo);
                    }

                    var book = new Book
                    {
                        Id = Guid.NewGuid(),
                        ItemNo = itemNo,
                        ISBN = string.IsNullOrWhiteSpace(row.ISBN) ? "N/A" : row.ISBN.Trim(),
                        ItemName = row.ItemName.Trim(),
                        CategoryCode = string.IsNullOrWhiteSpace(row.CategoryCode) ? "HOMEO" : row.CategoryCode.Trim(),
                        NoOfPages = row.NoOfPages <= 0 ? 100 : row.NoOfPages,
                        Language = string.IsNullOrWhiteSpace(row.Language) ? "English" : row.Language.Trim(),
                        Description = "Interactive Grid Bulk Uploaded Book",
                        CoverImagePath = coverPath,
                        Price = row.Price,
                        AuthorMasterId = matchedAuthorMasterId,
                        AuthorId = currentUser.Id,
                        VendorId = matchedVendorId,
                        VendorName = finalVendorName,
                        IsPublished = false,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };

                    _dbContext.Books.Add(book);

                    if (row.MainPdf != null && row.MainPdf.Length > 0)
                    {
                        var chunkInfos = _storageService.ProcessAndSplitPdfInterleaved(row.MainPdf, itemNo, 4);

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

                    successCount++;
                }
                catch (Exception exRow)
                {
                    errorLogs.Add($"Row {i + 1} ({row.ItemName}) error: {exRow.Message}");
                }
            }

            await _dbContext.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                message = $"{successCount} Books Save in list!",
                errors = errorLogs
            });
        }

        [HttpGet("my-books")]
        public async Task<IActionResult> GetMyBooks()
        {
            try
            {
                var rawBooks = await _dbContext.Books
                    .Include(b => b.AuthorMaster)
                    .Include(b => b.Author)
                    .OrderByDescending(b => b.CreatedAt)
                    .ToListAsync();

                var categoriesMap = await _dbContext.Categories
                    .ToDictionaryAsync(c => c.CategoryCode.Trim().ToLower(), c => c.CategoryName);

                
                var royaltyBookIds = await _dbContext.VendorRoyaltyRules
                    .Where(r => r.IsRoyaltyApplicable && r.LiveStatus == "Live")
                    .Select(r => r.BookId)
                    .ToListAsync();

                var royaltySet = new HashSet<Guid>(royaltyBookIds);

                var books = rawBooks.Select(b =>
                {
                    string displayAuthor = b.AuthorMaster != null ? b.AuthorMaster.AuthorName : null;
                    if (string.IsNullOrWhiteSpace(displayAuthor))
                    {
                        displayAuthor = "Dr. Samuel Hahnemann";
                    }

                    string publisherName = b.Author != null ? (b.Author.FullName ?? b.Author.UserName) : "System Administrator";
                    string catCode = b.CategoryCode?.Trim() ?? "HOMEO";
                    string catName = categoriesMap.ContainsKey(catCode.ToLower()) ? categoriesMap[catCode.ToLower()] : catCode;

                    return new
                    {
                        id = b.Id,
                        itemNo = b.ItemNo,
                        itemName = b.ItemName,
                        isbn = b.ISBN,
                        categoryCode = catCode,
                        categoryName = catName,
                        noOfPages = b.NoOfPages,
                        language = b.Language,
                        description = b.Description,
                        price = b.Price,
                        image = b.CoverImagePath,

                        authorName = displayAuthor,
                        author = displayAuthor,
                        publishedBy = publisherName,
                        createdBy = publisherName,

                        vendorId = b.VendorId,
                        vendorName = !string.IsNullOrWhiteSpace(b.VendorName) ? b.VendorName : "In-House (B. Jain)",

                        isRoyaltyApplicable = royaltySet.Contains(b.Id),

                        isPublished = b.IsPublished,
                        createdAt = b.CreatedAt
                    };
                }).ToList();

                return Ok(books);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error fetching books: " + ex.Message });
            }
        }


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
                    return NotFound(new { success = false, message = $"Book '{id}' Not in Database." });
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
                    return NotFound(new { success = false, message = $"Book '{id}' Not in Database." });

                
                if (!string.IsNullOrWhiteSpace(dto.ItemName)) book.ItemName = dto.ItemName.Trim();
                if (dto.Price >= 0) book.Price = dto.Price;
                if (dto.NoOfPages > 0) book.NoOfPages = dto.NoOfPages;
                if (!string.IsNullOrWhiteSpace(dto.Language)) book.Language = dto.Language.Trim();
                if (!string.IsNullOrWhiteSpace(dto.CategoryCode)) book.CategoryCode = dto.CategoryCode.Trim();
                if (!string.IsNullOrWhiteSpace(dto.Description)) book.Description = dto.Description.Trim();

                if (!string.IsNullOrWhiteSpace(dto.AuthorId) && Guid.TryParse(dto.AuthorId, out Guid updatedAuthGuid))
                {
                    book.AuthorMasterId = updatedAuthGuid;
                }

               
                if (dto.CoverImage != null && dto.CoverImage.Length > 0)
                {
                    string coverPath = await _storageService.SaveCoverImageAsync(dto.CoverImage, book.ItemNo);
                    book.CoverImagePath = coverPath;
                }

                
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


        [HttpDelete("delete-book/{id}")]
        [HttpPost("delete-book/{id}")]
        [HttpDelete("delete/{id}")]
        [HttpPost("delete/{id}")]
        public async Task<IActionResult> DeleteBook([FromRoute] string id)
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest(new { success = false, message = "Invalid Book Identifier." });
            }

            string cleanId = Uri.UnescapeDataString(id).Trim();

            try
            {
                Book? book = null;

                if (Guid.TryParse(cleanId, out Guid parsedGuid))
                {
                    book = await _dbContext.Books.FirstOrDefaultAsync(b => b.Id == parsedGuid);
                }

                if (book == null)
                {
                    book = await _dbContext.Books.FirstOrDefaultAsync(b => b.ItemNo.ToLower() == cleanId.ToLower());
                }

                if (book == null)
                {
                    book = await _dbContext.Books.FirstOrDefaultAsync(b => b.ItemName.ToLower() == cleanId.ToLower());
                }

                if (book == null)
                {
                    return NotFound(new { success = false, message = $"Book '{cleanId}' Not in Database." });
                }

                Guid targetBookId = book.Id;

                var readingProgress = await _dbContext.UserReadingProgress
                    .Where(p => p.BookId == targetBookId)
                    .ToListAsync();
                if (readingProgress.Any()) _dbContext.UserReadingProgress.RemoveRange(readingProgress);

                var alphaSegments = await _dbContext.BookSegmentsAlpha
                    .Where(s => s.BookId == targetBookId)
                    .ToListAsync();
                if (alphaSegments.Any()) _dbContext.BookSegmentsAlpha.RemoveRange(alphaSegments);

                var betaSegments = await _dbContext.BookSegmentsBeta
                    .Where(s => s.BookId == targetBookId)
                    .ToListAsync();
                if (betaSegments.Any()) _dbContext.BookSegmentsBeta.RemoveRange(betaSegments);

                var gammaSegments = await _dbContext.BookSegmentsGamma
                    .Where(s => s.BookId == targetBookId)
                    .ToListAsync();
                if (gammaSegments.Any()) _dbContext.BookSegmentsGamma.RemoveRange(gammaSegments);

                var bundleItems = await _dbContext.BundleItems
                    .Where(bi => bi.BookId == targetBookId)
                    .ToListAsync();
                if (bundleItems.Any()) _dbContext.BundleItems.RemoveRange(bundleItems);

                var royaltyRules = await _dbContext.VendorRoyaltyRules
                    .Where(r => r.BookId == targetBookId)
                    .ToListAsync();
                if (royaltyRules.Any()) _dbContext.VendorRoyaltyRules.RemoveRange(royaltyRules);

                var royaltyTxns = await _dbContext.VendorRoyaltyTransactions
                    .Where(t => t.BookId == targetBookId)
                    .ToListAsync();
                if (royaltyTxns.Any()) _dbContext.VendorRoyaltyTransactions.RemoveRange(royaltyTxns);

                var linkedCustomers = await _dbContext.Customers
                    .Where(c => c.BookId == targetBookId)
                    .ToListAsync();

                if (linkedCustomers.Any())
                {
                    var fallbackBook = await _dbContext.Books
                        .FirstOrDefaultAsync(b => b.Id != targetBookId);

                    if (fallbackBook != null)
                    {
                        foreach (var cust in linkedCustomers)
                        {
                            cust.BookId = fallbackBook.Id;
                        }
                    }
                    else
                    {
                        _dbContext.Customers.RemoveRange(linkedCustomers);
                    }
                }

                
                _dbContext.Books.Remove(book);
                await _dbContext.SaveChangesAsync();

                return Ok(new { success = true, message = $"Book '{book.ItemName}' deleted successfully!" });
            }
            catch (Exception ex)
            {
                var msg = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return StatusCode(500, new { success = false, message = "Delete Error: " + msg });
            }
        }


        [HttpGet("view-pdf/{identifier}")]
        [AllowAnonymous]
        public async Task<IActionResult> ViewPdf(string identifier)
        {
            if (string.IsNullOrWhiteSpace(identifier))
                return BadRequest("Identifier is required.");

            string cleanId = Uri.UnescapeDataString(identifier).Trim();
            Book book = null;

            if (Guid.TryParse(cleanId, out Guid parsedGuid))
            {
                book = await _dbContext.Books.FirstOrDefaultAsync(b => b.Id == parsedGuid);
            }

            if (book == null)
            {
                book = await _dbContext.Books.FirstOrDefaultAsync(b => b.ItemNo.ToLower() == cleanId.ToLower());
            }

            if (book == null) return NotFound($"Book '{cleanId}' Not in Database.");

            Guid bookId = book.Id;

            var alphaSegments = await _dbContext.BookSegmentsAlpha.Where(s => s.BookId == bookId).ToListAsync();
            var betaSegments = await _dbContext.BookSegmentsBeta.Where(s => s.BookId == bookId).ToListAsync();
            var gammaSegments = await _dbContext.BookSegmentsGamma.Where(s => s.BookId == bookId).ToListAsync();

            var combinedList = new List<SegmentNode>();
            combinedList.AddRange(alphaSegments.Select(a => new SegmentNode { Id = a.Id, ParentId = a.ParentChunkId, Path = a.StorageRelativePath }));
            combinedList.AddRange(betaSegments.Select(b => new SegmentNode { Id = b.Id, ParentId = b.ParentChunkId, Path = b.StorageRelativePath }));
            combinedList.AddRange(gammaSegments.Select(g => new SegmentNode { Id = g.Id, ParentId = g.ParentChunkId, Path = g.StorageRelativePath }));

            if (!combinedList.Any())
            {
                string uploadsFolder = Path.Combine(_environment.WebRootPath, "uploads", "books");
                string physicalFilePath = Path.Combine(uploadsFolder, $"{bookId}.pdf");

                if (!System.IO.File.Exists(physicalFilePath))
                {
                    physicalFilePath = Path.Combine(uploadsFolder, $"{book.ItemNo}.pdf");
                }

                if (System.IO.File.Exists(physicalFilePath))
                {
                    byte[] fileBytes = await System.IO.File.ReadAllBytesAsync(physicalFilePath);
                    return File(fileBytes, "application/pdf");
                }

                return NotFound("PDF Segments missing on storage.");
            }

            var orderedSegments = new List<SegmentNode>();
            var current = combinedList.FirstOrDefault(s => s.ParentId == null);

            while (current != null)
            {
                orderedSegments.Add(current);
                current = combinedList.FirstOrDefault(s => s.ParentId == current.Id);
            }

            if (!orderedSegments.Any()) orderedSegments = combinedList;

            var openedDocuments = new List<PdfDocument>();
            var extractedPages = new List<PdfPage>();

            try
            {
                using (PdfDocument outputDocument = new PdfDocument())
                {
                    string desktopBasePath = _configuration["StorageSettings:BaseDrivePath"] ?? @"C:\RadarBooks\B.Jain Store Book";

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

                    if (!extractedPages.Any()) return NotFound("PDF Chunks is not Available on Physical Disk.");

                    int pagesPerChunk = 4;
                    int totalExtracted = extractedPages.Count;
                    PdfPage[] reorderedArray = new PdfPage[totalExtracted];

                    var unmappedIndices = new List<int>();
                    for (int i = 0; i < totalExtracted; i++) unmappedIndices.Add(i);

                    int currentSourceIdx = 0;
                    int step = 2;

                    while (unmappedIndices.Count > 0 && currentSourceIdx < totalExtracted)
                    {
                        int targetIndexInChunk = 0;
                        for (int k = 0; k < pagesPerChunk && unmappedIndices.Count > 0; k++)
                        {
                            if (targetIndexInChunk >= unmappedIndices.Count) targetIndexInChunk = 0;

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
                        if (reorderedArray[i] != null) outputDocument.AddPage(reorderedArray[i]);
                        else if (i < extractedPages.Count) outputDocument.AddPage(extractedPages[i]);
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