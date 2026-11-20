using Application.DTOs;
using Application.Interfaces;
using BookPublishingSystem.Domain.Entities;
using Infrastructure.Persistence;
using Infrastructure.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using PdfSharpCore.Pdf;
using PdfSharpCore.Pdf.IO;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace BookPublishingSystem.Web.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class JournalController : ControllerBase
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly LocalSecureStorageService _storageService;
        private readonly IWebHostEnvironment _environment;
        private readonly IConfiguration _configuration;

        public JournalController(ApplicationDbContext dbContext, IStorageService storageService, IWebHostEnvironment environment, IConfiguration configuration)
        {
            _dbContext = dbContext;
            _storageService = (LocalSecureStorageService)storageService;
            _environment = environment;
            _configuration = configuration;
        }

        private string GetDriveBooksBasePath()
        {
            string configuredPath = _configuration["StorageSettings:BaseDrivePath"];
            if (string.IsNullOrWhiteSpace(configuredPath))
            {
                configuredPath = @"C:\RadarBooks\B.Jain Store Book";
            }
            return Path.Combine(configuredPath, "Books");
        }

        
        private async Task<string> SaveJournalPdfInterleavedAsync(Microsoft.AspNetCore.Http.IFormFile pdfFile, string jCode)
        {
            string cleanCode = jCode.Trim().ToUpper();
            string journalFolder = Path.Combine(GetDriveBooksBasePath(), cleanCode);

            if (Directory.Exists(journalFolder))
            {
                try { Directory.Delete(journalFolder, true); } catch { }
            }

            
            var chunkInfos = _storageService.ProcessAndSplitPdfInterleaved(pdfFile, cleanCode, 4);

            
            string manifestPath = Path.Combine(journalFolder, "chunks_manifest.json");
            string manifestJson = JsonSerializer.Serialize(chunkInfos);
            await System.IO.File.WriteAllTextAsync(manifestPath, manifestJson);

            return $"SECURE_INTERLEAVED:{cleanCode}";
        }

        // GET: api/journal/all
        [HttpGet("all")]
        public async Task<IActionResult> GetAllJournals()
        {
            try
            {
                var categoriesMap = await _dbContext.Categories
                    .ToDictionaryAsync(c => c.CategoryCode.Trim().ToLower(), c => c.CategoryName);

                var journals = await _dbContext.Journals
                    .OrderByDescending(j => j.PublishDate)
                    .ThenByDescending(j => j.CreatedAt)
                    .ToListAsync();

                var result = journals.Select(j =>
                {
                    string catCode = j.CategoryCode?.Trim() ?? "HOMEO";
                    string catName = categoriesMap.ContainsKey(catCode.ToLower()) ? categoriesMap[catCode.ToLower()] : catCode;

                    return new
                    {
                        id = j.Id,
                        journalCode = j.JournalCode,
                        name = j.Name,
                        publisherName = j.PublisherName,
                        publishDate = j.PublishDate,
                        issn = j.ISSN ?? "",
                        volumeIssue = j.VolumeIssue ?? "",
                        frequency = j.Frequency ?? "Quarterly",
                        categoryCode = catCode,
                        categoryName = catName,
                        language = j.Language ?? "English",
                        description = j.Description ?? "",
                        coverImagePath = string.IsNullOrWhiteSpace(j.CoverImagePath) ? "/images/default-cover.png" : j.CoverImagePath,
                        pdfFilePath = j.PdfFilePath ?? "",
                        hasPdf = !string.IsNullOrWhiteSpace(j.PdfFilePath),
                        price = j.Price,
                        vendorId = j.VendorId,
                        vendorName = string.IsNullOrWhiteSpace(j.VendorName) ? "In-House (B. Jain)" : j.VendorName,
                        isActive = j.IsActive,
                        createdAt = j.CreatedAt,
                        modifiedAt = j.ModifiedAt
                    };
                }).ToList();

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error fetching journals: " + ex.Message });
            }
        }

        // POST: api/journal/create
        [HttpPost("create")]
        public async Task<IActionResult> CreateJournal([FromForm] JournalFormDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest(new { success = false, message = "Journal Name is required." });

            if (string.IsNullOrWhiteSpace(dto.PublisherName))
                return BadRequest(new { success = false, message = "Publisher Name is required." });

            try
            {
                string jCode = !string.IsNullOrWhiteSpace(dto.JournalCode)
                    ? dto.JournalCode.Trim().ToUpper()
                    : $"JRN-{Guid.NewGuid().ToString("N").Substring(0, 6).ToUpper()}";

                string coverPath = "/images/default-cover.png";
                if (dto.CoverImage != null && dto.CoverImage.Length > 0)
                {
                    coverPath = await _storageService.SaveCoverImageAsync(dto.CoverImage, jCode);
                }

                string? pdfPath = null;
                if (dto.JournalPdf != null && dto.JournalPdf.Length > 0)
                {
                    pdfPath = await SaveJournalPdfInterleavedAsync(dto.JournalPdf, jCode);
                }

                decimal parsedPrice = 0m;
                if (Request.Form.TryGetValue("Price", out var priceVal))
                    decimal.TryParse(priceVal.ToString(), out parsedPrice);

                Guid? matchedVendorId = null;
                string finalVendorName = "In-House (B. Jain)";
                if (Request.Form.TryGetValue("VendorName", out var vNameVal) && !string.IsNullOrWhiteSpace(vNameVal))
                {
                    string cleanVName = vNameVal.ToString().Trim().ToLower();
                    var existingVendor = await _dbContext.Vendors
                        .FirstOrDefaultAsync(v => v.Name.ToLower() == cleanVName || v.VendorCode.ToLower() == cleanVName);
                    if (existingVendor != null)
                    {
                        matchedVendorId = existingVendor.Id;
                        finalVendorName = existingVendor.Name;
                    }
                    else
                    {
                        finalVendorName = vNameVal.ToString().Trim();
                    }
                }

                var journal = new Journal
                {
                    Id = Guid.NewGuid(),
                    JournalCode = jCode,
                    Name = dto.Name.Trim(),
                    PublisherName = dto.PublisherName.Trim(),
                    PublishDate = dto.PublishDate == default ? DateTime.UtcNow : dto.PublishDate,
                    ISSN = string.IsNullOrWhiteSpace(dto.ISSN) ? null : dto.ISSN.Trim().ToUpper(),
                    VolumeIssue = string.IsNullOrWhiteSpace(dto.VolumeIssue) ? null : dto.VolumeIssue.Trim(),
                    Frequency = string.IsNullOrWhiteSpace(dto.Frequency) ? "Quarterly" : dto.Frequency.Trim(),
                    CategoryCode = string.IsNullOrWhiteSpace(dto.CategoryCode) ? "HOMEO" : dto.CategoryCode.Trim(),
                    Language = string.IsNullOrWhiteSpace(dto.Language) ? "English" : dto.Language.Trim(),
                    Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim(),
                    CoverImagePath = coverPath,
                    PdfFilePath = pdfPath,
                    Price = parsedPrice,
                    VendorId = matchedVendorId,
                    VendorName = finalVendorName,
                    IsActive = dto.IsActive,
                    CreatedAt = DateTime.UtcNow
                };

                _dbContext.Journals.Add(journal);
                await _dbContext.SaveChangesAsync();

                return Ok(new
                {
                    success = true,
                    message = $"Journal '{journal.Name}' split into 3 secure storage folders and saved successfully!",
                    data = journal
                });
            }
            catch (Exception ex)
            {
                var msg = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return StatusCode(500, new { success = false, message = "Error creating journal: " + msg });
            }
        }

        // PUT / POST: api/journal/update/{id}
        [HttpPut("update/{id:guid}")]
        [HttpPost("update/{id:guid}")]
        public async Task<IActionResult> UpdateJournal(Guid id, [FromForm] JournalFormDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest(new { success = false, message = "Journal Name is required." });

            if (string.IsNullOrWhiteSpace(dto.PublisherName))
                return BadRequest(new { success = false, message = "Publisher Name is required." });

            try
            {
                var journal = await _dbContext.Journals.FindAsync(id);
                if (journal == null)
                    return NotFound(new { success = false, message = "Journal record not found." });

                journal.Name = dto.Name.Trim();
                journal.PublisherName = dto.PublisherName.Trim();
                if (dto.PublishDate != default) journal.PublishDate = dto.PublishDate;
                journal.ISSN = string.IsNullOrWhiteSpace(dto.ISSN) ? null : dto.ISSN.Trim().ToUpper();
                journal.VolumeIssue = string.IsNullOrWhiteSpace(dto.VolumeIssue) ? null : dto.VolumeIssue.Trim();
                journal.Frequency = string.IsNullOrWhiteSpace(dto.Frequency) ? journal.Frequency : dto.Frequency.Trim();
                journal.CategoryCode = string.IsNullOrWhiteSpace(dto.CategoryCode) ? journal.CategoryCode : dto.CategoryCode.Trim();
                journal.Language = string.IsNullOrWhiteSpace(dto.Language) ? journal.Language : dto.Language.Trim();
                journal.Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();
                journal.IsActive = dto.IsActive;

                if (Request.Form.TryGetValue("Price", out var editPriceVal) && decimal.TryParse(editPriceVal.ToString(), out decimal updatedPrice))
                {
                    journal.Price = updatedPrice;
                }

                if (Request.Form.TryGetValue("VendorName", out var editVendorVal))
                {
                    string rawV = editVendorVal.ToString().Trim();
                    if (string.IsNullOrWhiteSpace(rawV))
                    {
                        journal.VendorId = null;
                        journal.VendorName = "In-House (B. Jain)";
                    }
                    else
                    {
                        var existingVendor = await _dbContext.Vendors
                            .FirstOrDefaultAsync(v => v.Name.ToLower() == rawV.ToLower() || v.VendorCode.ToLower() == rawV.ToLower());
                        if (existingVendor != null)
                        {
                            journal.VendorId = existingVendor.Id;
                            journal.VendorName = existingVendor.Name;
                        }
                        else
                        {
                            journal.VendorId = null;
                            journal.VendorName = rawV;
                        }
                    }
                }

                journal.ModifiedAt = DateTime.UtcNow;

                if (dto.CoverImage != null && dto.CoverImage.Length > 0)
                {
                    journal.CoverImagePath = await _storageService.SaveCoverImageAsync(dto.CoverImage, journal.JournalCode);
                }

                if (dto.JournalPdf != null && dto.JournalPdf.Length > 0)
                {
                    journal.PdfFilePath = await SaveJournalPdfInterleavedAsync(dto.JournalPdf, journal.JournalCode);
                }

                await _dbContext.SaveChangesAsync();

                return Ok(new
                {
                    success = true,
                    message = $"Journal '{journal.Name}' updated successfully!"
                });
            }
            catch (Exception ex)
            {
                var msg = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return StatusCode(500, new { success = false, message = "Error updating journal: " + msg });
            }
        }

        // POST: api/journal/bulk-upload-grid
        [HttpPost("bulk-upload-grid")]
        public async Task<IActionResult> BulkUploadJournals([FromBody] List<BulkJournalRowDto> journals)
        {
            if (journals == null || !journals.Any())
                return BadRequest(new { success = false, message = "No journal rows provided." });

            int successCount = 0;
            foreach (var row in journals)
            {
                if (string.IsNullOrWhiteSpace(row.Name) || string.IsNullOrWhiteSpace(row.PublisherName))
                    continue;

                string jCode = $"JRN-{Guid.NewGuid().ToString("N").Substring(0, 6).ToUpper()}";

                var journal = new Journal
                {
                    Id = Guid.NewGuid(),
                    JournalCode = jCode,
                    Name = row.Name.Trim(),
                    PublisherName = row.PublisherName.Trim(),
                    PublishDate = row.PublishDate == default ? DateTime.UtcNow : row.PublishDate,
                    ISSN = string.IsNullOrWhiteSpace(row.ISSN) ? null : row.ISSN.Trim().ToUpper(),
                    VolumeIssue = string.IsNullOrWhiteSpace(row.VolumeIssue) ? null : row.VolumeIssue.Trim(),
                    Frequency = string.IsNullOrWhiteSpace(row.Frequency) ? "Quarterly" : row.Frequency.Trim(),
                    CategoryCode = "HOMEO",
                    Language = string.IsNullOrWhiteSpace(row.Language) ? "English" : row.Language.Trim(),
                    CoverImagePath = "/images/default-cover.png",
                    PdfFilePath = null,
                    VendorName = "In-House (B. Jain)",
                    Price = 0,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };

                _dbContext.Journals.Add(journal);
                successCount++;
            }

            await _dbContext.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                message = $"{successCount} Journals successfully added!"
            });
        }

        // DELETE / POST: api/journal/delete/{id}
        [HttpDelete("delete/{id:guid}")]
        [HttpPost("delete/{id:guid}")]
        public async Task<IActionResult> DeleteJournal(Guid id)
        {
            try
            {
                var journal = await _dbContext.Journals.FindAsync(id);
                if (journal == null)
                    return NotFound(new { success = false, message = "Journal not found." });

                
                if (!string.IsNullOrWhiteSpace(journal.JournalCode))
                {
                    string journalFolder = Path.Combine(GetDriveBooksBasePath(), journal.JournalCode.Trim().ToUpper());
                    if (Directory.Exists(journalFolder))
                    {
                        try { Directory.Delete(journalFolder, true); } catch { }
                    }
                }

                _dbContext.Journals.Remove(journal);
                await _dbContext.SaveChangesAsync();

                return Ok(new { success = true, message = $"Journal '{journal.Name}' deleted successfully!" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Delete error: " + ex.Message });
            }
        }

        
        [HttpGet("view-pdf/{identifier}")]
        [HttpGet("stream-pdf/{identifier}")]
        [AllowAnonymous]
        public async Task<IActionResult> ViewJournalPdf(string identifier)
        {
            if (string.IsNullOrWhiteSpace(identifier))
                return BadRequest("Journal identifier is required.");

            string cleanId = Uri.UnescapeDataString(identifier).Trim();
            Journal? journal = null;

            if (Guid.TryParse(cleanId, out Guid parsedGuid))
            {
                journal = await _dbContext.Journals.FirstOrDefaultAsync(j => j.Id == parsedGuid);
            }

            if (journal == null)
            {
                journal = await _dbContext.Journals.FirstOrDefaultAsync(j => j.JournalCode.ToLower() == cleanId.ToLower());
            }

            if (journal == null)
                return NotFound($"Journal '{cleanId}' database mein nahi mila.");

            string jCode = journal.JournalCode.Trim().ToUpper();
            string journalFolder = Path.Combine(GetDriveBooksBasePath(), jCode);
            string manifestPath = Path.Combine(journalFolder, "chunks_manifest.json");

            
            if (System.IO.File.Exists(manifestPath))
            {
                string manifestJson = await System.IO.File.ReadAllTextAsync(manifestPath);
                var chunkInfos = JsonSerializer.Deserialize<List<InterleavedSegmentChunkInfo>>(manifestJson);

                if (chunkInfos != null && chunkInfos.Any())
                {
                    var orderedSegments = new List<InterleavedSegmentChunkInfo>();
                    var current = chunkInfos.FirstOrDefault(s => s.ParentChunkId == null);

                    while (current != null)
                    {
                        orderedSegments.Add(current);
                        current = chunkInfos.FirstOrDefault(s => s.ParentChunkId == current.ChunkId);
                    }

                    if (!orderedSegments.Any()) orderedSegments = chunkInfos;

                    var openedDocuments = new List<PdfDocument>();
                    var extractedPages = new List<PdfPage>();

                    try
                    {
                        using (PdfDocument outputDocument = new PdfDocument())
                        {
                            foreach (var seg in orderedSegments)
                            {
                                string physicalPath = seg.StorageRelativePath;

                                if (!System.IO.File.Exists(physicalPath))
                                {
                                    string fileName = Path.GetFileName(seg.StorageRelativePath);
                                    string folderName = seg.TableTarget == "Alpha"
                                        ? "Alpha_Storage"
                                        : (seg.TableTarget == "Beta" ? "Beta_Storage" : "Gamma_Storage");
                                    physicalPath = Path.Combine(journalFolder, folderName, fileName);
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
                                return NotFound("Journal PDF chunks physical disk location par nahi mile.");

                           
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
                        return StatusCode(500, $"Journal PDF Stitching Error: {ex.Message}");
                    }
                    finally
                    {
                        foreach (var doc in openedDocuments) doc.Dispose();
                    }
                }
            }

            
            if (!string.IsNullOrWhiteSpace(journal.PdfFilePath) && !journal.PdfFilePath.StartsWith("SECURE_"))
            {
                string cleanRelPath = journal.PdfFilePath.TrimStart('/', '\\').Replace("/", Path.DirectorySeparatorChar.ToString());
                string webRoot = _environment.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
                string legacyPath = Path.Combine(webRoot, cleanRelPath);

                if (System.IO.File.Exists(legacyPath))
                {
                    byte[] fileBytes = await System.IO.File.ReadAllBytesAsync(legacyPath);
                    return File(fileBytes, "application/pdf");
                }
            }

            return NotFound("Journal PDF file missing on server.");
        }

        private async Task EnsureJournalTablesAsync()
        {
            const string sql = @"
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PurchasedJournalSnapshots')
                BEGIN
                    CREATE TABLE PurchasedJournalSnapshots (
                        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
                        TransactionId NVARCHAR(150) NOT NULL,
                        UserId NVARCHAR(450) NOT NULL,
                        JournalId UNIQUEIDENTIFIER NOT NULL,
                        AccessSource NVARCHAR(100) NOT NULL,
                        ValidTill DATETIME2 NULL,
                        LockedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                    );
                    CREATE INDEX IX_PurchasedJournalSnapshots_UserId ON PurchasedJournalSnapshots(UserId);
                END
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'BundleJournalItems')
                BEGIN
                    CREATE TABLE BundleJournalItems (
                        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
                        BundleId UNIQUEIDENTIFIER NOT NULL,
                        JournalId UNIQUEIDENTIFIER NOT NULL
                    );
                END";
            await _dbContext.Database.ExecuteSqlRawAsync(sql);
        }

        public class JournalPurchaseDto
        {
            public Guid JournalId { get; set; }
            public int ValidityDays { get; set; } = 365;
        }

        // GET: api/journal/check-access/{journalId}
        [HttpGet("check-access/{journalId:guid}")]
        public async Task<IActionResult> CheckJournalAccess(Guid journalId)
        {
            var identityEmail = User?.Identity?.Name;
            if (string.IsNullOrEmpty(identityEmail))
                return Ok(new { hasAccess = false, isLoggedIn = false });

            if (User.IsInRole("Admin"))
                return Ok(new { hasAccess = true, isLoggedIn = true, accessType = "Admin" });

            var appUser = await _dbContext.Users.FirstOrDefaultAsync(u => u.Email == identityEmail || u.UserName == identityEmail);
            if (appUser == null)
                return Ok(new { hasAccess = false, isLoggedIn = false });

            var journal = await _dbContext.Journals.FindAsync(journalId);
            if (journal != null && journal.Price <= 0)
                return Ok(new { hasAccess = true, isLoggedIn = true, accessType = "FreeJournal" });

            await EnsureJournalTablesAsync();

            var validRecords = await _dbContext.Database
                .SqlQueryRaw<DateTime?>(
                    "SELECT ValidTill AS Value FROM PurchasedJournalSnapshots WHERE UserId = {0} AND JournalId = {1}",
                    appUser.Id, journalId)
                .ToListAsync();

            if (validRecords.Any(v => v == null || v >= DateTime.UtcNow))
            {
                return Ok(new { hasAccess = true, isLoggedIn = true, accessType = "Purchased" });
            }

            bool hasActiveSub = await _dbContext.UserSubscriptions
                .AnyAsync(s => s.UserId == appUser.Id && s.Status == "Active" && s.ExpiryDate >= DateTime.UtcNow);

            if (hasActiveSub)
            {
                return Ok(new { hasAccess = true, isLoggedIn = true, accessType = "SubscriptionPlan" });
            }

            return Ok(new { hasAccess = false, isLoggedIn = true });
        }

        // POST: api/journal/purchase
        [HttpPost("purchase")]
        public async Task<IActionResult> PurchaseSingleJournal([FromBody] JournalPurchaseDto dto)
        {
            if (dto == null || dto.JournalId == Guid.Empty)
                return BadRequest(new { success = false, message = "Invalid Journal ID." });

            var identityEmail = User?.Identity?.Name;
            if (string.IsNullOrEmpty(identityEmail))
                return Unauthorized(new { success = false, message = "Please sign in first." });

            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Email == identityEmail || u.UserName == identityEmail);
            if (user == null)
                return Unauthorized(new { success = false, message = "User not found." });

            var journal = await _dbContext.Journals.FindAsync(dto.JournalId);
            if (journal == null)
                return NotFound(new { success = false, message = "Journal not found." });

            await EnsureJournalTablesAsync();

            int validityDays = dto.ValidityDays > 0 ? dto.ValidityDays : 365;
            DateTime nowUtc = DateTime.UtcNow;
            DateTime validTillUtc = nowUtc.AddDays(validityDays);
            string txnId = $"SJRN-{nowUtc:yyyyMMddHHmmss}-{new Random().Next(100, 999)}";

            var fallbackBook = await _dbContext.Books.FirstOrDefaultAsync();
            var existingProfile = await _dbContext.Customers.FirstOrDefaultAsync(c => c.UserId == user.Id);

            if (fallbackBook != null)
            {
                var customerRecord = new Domain.Entities.Customer
                {
                    Id = Guid.NewGuid(),
                    CustId = existingProfile?.CustId ?? ("CUST-" + nowUtc.Ticks.ToString().Substring(10)),
                    CustName = existingProfile?.CustName ?? user.FullName ?? user.Email ?? "Reader Customer",
                    MobileNo = existingProfile?.MobileNo ?? "N/A",
                    EmailId = user.Email ?? existingProfile?.EmailId ?? "reader@bjain.com",
                    Address1 = existingProfile?.Address1 ?? "Single Journal Purchase",
                    Country = existingProfile?.Country ?? "India",
                    State = existingProfile?.State ?? "N/A",
                    PostalCode = existingProfile?.PostalCode ?? "000000",
                    UserId = user.Id,
                    BookId = fallbackBook.Id,
                    PlanType = $"SingleJournal:{journal.Name}|ValidTill:{validTillUtc:O}",
                    AmountPaid = journal.Price,
                    TransactionId = txnId,
                    PurchasedAt = nowUtc,
                    CreatedAt = nowUtc
                };
                _dbContext.Customers.Add(customerRecord);
                await _dbContext.SaveChangesAsync();
            }

            await _dbContext.Database.ExecuteSqlRawAsync(
                "INSERT INTO PurchasedJournalSnapshots (Id, TransactionId, UserId, JournalId, AccessSource, ValidTill, LockedAt) VALUES ({0}, {1}, {2}, {3}, {4}, {5}, {6})",
                Guid.NewGuid(), txnId, user.Id, journal.Id, "SingleJournal", validTillUtc, nowUtc);

            return Ok(new
            {
                success = true,
                message = $"Journal '{journal.Name}' unlocked till {validTillUtc:dd MMM yyyy}!",
                transactionId = txnId,
                journalId = journal.Id,
                validTill = validTillUtc
            });
        }
    }
}