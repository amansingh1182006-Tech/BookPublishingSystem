using Application.DTOs;
using Application.Interfaces;
using BookPublishingSystem.Domain.Entities;
using Infrastructure.Persistence;
using Infrastructure.Storage;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace BookPublishingSystem.Web.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class JournalController : ControllerBase
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly LocalSecureStorageService _storageService;

        public JournalController(ApplicationDbContext dbContext, IStorageService storageService)
        {
            _dbContext = dbContext;
            _storageService = (LocalSecureStorageService)storageService;
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
                    var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "journals");
                    if (!Directory.Exists(uploadsFolder))
                        Directory.CreateDirectory(uploadsFolder);

                    var ext = Path.GetExtension(dto.JournalPdf.FileName);
                    if (string.IsNullOrWhiteSpace(ext)) ext = ".pdf";

                    var uniquePdfName = $"{jCode}_{Guid.NewGuid():N}{ext}";
                    var fullFilePath = Path.Combine(uploadsFolder, uniquePdfName);

                    using (var stream = new FileStream(fullFilePath, FileMode.Create))
                    {
                        await dto.JournalPdf.CopyToAsync(stream);
                    }

                    pdfPath = "/uploads/journals/" + uniquePdfName;
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
                    IsActive = dto.IsActive,
                    CreatedAt = DateTime.UtcNow
                };

                _dbContext.Journals.Add(journal);
                await _dbContext.SaveChangesAsync();

                return Ok(new
                {
                    success = true,
                    message = $"Journal '{journal.Name}' created successfully!",
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
                journal.ModifiedAt = DateTime.UtcNow;

                
                if (dto.CoverImage != null && dto.CoverImage.Length > 0)
                {
                    journal.CoverImagePath = await _storageService.SaveCoverImageAsync(dto.CoverImage, journal.JournalCode);
                }

                
                if (dto.JournalPdf != null && dto.JournalPdf.Length > 0)
                {
                    var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "journals");
                    if (!Directory.Exists(uploadsFolder))
                        Directory.CreateDirectory(uploadsFolder);

                    var ext = Path.GetExtension(dto.JournalPdf.FileName);
                    if (string.IsNullOrWhiteSpace(ext)) ext = ".pdf";

                    var uniquePdfName = $"{journal.JournalCode}_{Guid.NewGuid():N}{ext}";
                    var fullFilePath = Path.Combine(uploadsFolder, uniquePdfName);

                    using (var stream = new FileStream(fullFilePath, FileMode.Create))
                    {
                        await dto.JournalPdf.CopyToAsync(stream);
                    }

                    journal.PdfFilePath = "/uploads/journals/" + uniquePdfName;
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

                _dbContext.Journals.Remove(journal);
                await _dbContext.SaveChangesAsync();

                return Ok(new { success = true, message = $"Journal '{journal.Name}' deleted successfully!" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Delete error: " + ex.Message });
            }
        }
    }
}