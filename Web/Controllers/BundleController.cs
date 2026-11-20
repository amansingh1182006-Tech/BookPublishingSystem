using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BookPublishingSystem.Application.DTOs;
using BookPublishingSystem.Domain.Entities;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Web.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class BundleController : ControllerBase
    {
        private readonly ApplicationDbContext _dbContext;

        public BundleController(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        [HttpGet("get-all")]
        public async Task<IActionResult> GetAllBundles()
        {
            try
            {
                await _dbContext.Database.ExecuteSqlRawAsync(@"
                    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'BundleJournalItems')
                    BEGIN
                        CREATE TABLE BundleJournalItems (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
                            BundleId UNIQUEIDENTIFIER NOT NULL,
                            JournalId UNIQUEIDENTIFIER NOT NULL
                        );
                    END");

                var royaltyBookIds = await _dbContext.VendorRoyaltyRules
                    .Where(r => r.IsRoyaltyApplicable && (r.LiveStatus == null || r.LiveStatus == "" || r.LiveStatus == "Live" || r.LiveStatus == "Active"))
                    .Select(r => r.BookId)
                    .Distinct()
                    .ToListAsync();

                var royaltySet = new HashSet<Guid>(royaltyBookIds);

                var rawBundles = await _dbContext.Bundles
                    .Include(b => b.BundleItems)
                        .ThenInclude(bi => bi.Book)
                            .ThenInclude(bk => bk!.AuthorMaster)
                    .OrderByDescending(b => b.CreatedAt)
                    .ToListAsync();

                var allJournalsMap = await _dbContext.Journals
                    .ToDictionaryAsync(j => j.Id, j => j);

                var bundles = new List<object>();

                foreach (var b in rawBundles)
                {
                    var jrnIds = await _dbContext.Database
                        .SqlQueryRaw<Guid>("SELECT JournalId AS Value FROM BundleJournalItems WHERE BundleId = {0}", b.Id)
                        .ToListAsync();

                    var bookTitlesList = b.BundleItems.Select(bi => new
                    {
                        bi.BookId,
                        BookName = bi.Book != null ? bi.Book.ItemName : "N/A",
                        AuthorName = bi.Book != null && bi.Book.AuthorMaster != null ? bi.Book.AuthorMaster.AuthorName : "B. Jain Author",
                        CoverImage = bi.Book != null ? (bi.Book.CoverImagePath ?? "/images/default-cover.png") : "/images/default-cover.png",
                        Price = bi.Book != null ? bi.Book.Price : 0m,
                        IsRoyalty = royaltySet.Contains(bi.BookId),
                        ItemType = "Book"
                    }).ToList();

                    foreach (var jId in jrnIds)
                    {
                        if (allJournalsMap.TryGetValue(jId, out var jrn))
                        {
                            bookTitlesList.Add(new
                            {
                                BookId = jrn.Id,
                                BookName = $"[Journal] {jrn.Name}",
                                AuthorName = jrn.PublisherName ?? "B. Jain Publishers",
                                CoverImage = string.IsNullOrWhiteSpace(jrn.CoverImagePath) ? "/images/default-cover.png" : jrn.CoverImagePath,
                                Price = jrn.Price,
                                IsRoyalty = royaltySet.Contains(jrn.Id),
                                ItemType = "Journal"
                            });
                        }
                    }

                    bundles.Add(new
                    {
                        b.Id,
                        b.BundleName,
                        b.Description,
                        b.NumberOfTitles,
                        b.TotalPrice,
                        b.DiscountPercentage,
                        b.FinalPrice,
                        b.IsActive,
                        b.CreatedAt,
                        BookTitles = bookTitlesList
                    });
                }

                return Ok(bundles);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error fetching bundles: " + ex.Message });
            }
        }

        [HttpGet("get/{id}")]
        public async Task<IActionResult> GetBundleById(Guid id)
        {
            var bundle = await _dbContext.Bundles
                .Include(b => b.BundleItems)
                    .ThenInclude(bi => bi.Book)
                .FirstOrDefaultAsync(b => b.Id == id);

            if (bundle == null)
                return NotFound(new { message = "Bundle not found." });

            var jrnIds = await _dbContext.Database
                .SqlQueryRaw<Guid>("SELECT JournalId AS Value FROM BundleJournalItems WHERE BundleId = {0}", bundle.Id)
                .ToListAsync();

            var combinedSelectedIds = bundle.BundleItems
                .Select(bi => bi.BookId)
                .Concat(jrnIds)
                .Distinct()
                .ToList();

            return Ok(new
            {
                bundle.Id,
                bundle.BundleName,
                bundle.Description,
                bundle.NumberOfTitles,
                bundle.TotalPrice,
                bundle.DiscountPercentage,
                bundle.FinalPrice,
                bundle.IsActive,
                SelectedBookIds = combinedSelectedIds
            });
        }

        [HttpPost("save")]
        public async Task<IActionResult> SaveBundle([FromBody] SaveBundleDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var journalIdsFromHeader = new List<Guid>();
            if (Request.Headers.TryGetValue("X-Selected-Journals", out var jHeader) && !string.IsNullOrWhiteSpace(jHeader))
            {
                foreach (var part in jHeader.ToString().Split(',', StringSplitOptions.RemoveEmptyEntries))
                {
                    if (Guid.TryParse(part.Trim(), out var jGuid) && jGuid != Guid.Empty)
                        journalIdsFromHeader.Add(jGuid);
                }
            }

            if ((dto.SelectedBookIds == null || dto.SelectedBookIds.Count == 0) && journalIdsFromHeader.Count == 0)
                return BadRequest(new { message = "Please select at least 1 book or journal title for the bundle." });
            

            try
            {
                var incomingIds = (dto.SelectedBookIds ?? new List<Guid>())
                     .Where(id => id != Guid.Empty)
                     .Distinct()
                     .ToList();

                
                var selectedBooks = await _dbContext.Books
                    .Where(b => incomingIds.Contains(b.Id))
                    .ToListAsync();

                var actualBookIds = selectedBooks.Select(b => b.Id).ToList();

                
                var allCandidateJournalIds = incomingIds
                    .Except(actualBookIds)
                    .Concat(journalIdsFromHeader)
                    .Distinct()
                    .ToList();

                var selectedJournals = allCandidateJournalIds.Any()
                    ? await _dbContext.Journals.Where(j => allCandidateJournalIds.Contains(j.Id)).ToListAsync()
                    : new List<Journal>();

                var actualJournalIds = selectedJournals.Select(j => j.Id).ToList();

                decimal calculatedMRP = selectedBooks.Sum(b => b.Price) + selectedJournals.Sum(j => j.Price);
                int titlesCount = selectedBooks.Count + selectedJournals.Count;

                Bundle bundle;

                if (dto.Id.HasValue && dto.Id.Value != Guid.Empty)
                {
                    bundle = await _dbContext.Bundles.FirstOrDefaultAsync(b => b.Id == dto.Id.Value);

                    if (bundle == null)
                        return NotFound(new { message = "Bundle not found." });

                    bundle.BundleName = dto.BundleName.Trim();
                    bundle.Description = dto.Description;
                    bundle.NumberOfTitles = titlesCount;
                    bundle.TotalPrice = calculatedMRP;
                    bundle.DiscountPercentage = dto.DiscountPercentage;
                    bundle.FinalPrice = dto.FinalPrice;
                    bundle.IsActive = dto.IsActive;

                    var existingItems = await _dbContext.BundleItems
                        .Where(bi => bi.BundleId == bundle.Id)
                        .ToListAsync();

                    if (existingItems.Any())
                    {
                        _dbContext.BundleItems.RemoveRange(existingItems);
                    }
                }
                else
                {
                    bundle = new Bundle
                    {
                        Id = Guid.NewGuid(),
                        BundleName = dto.BundleName.Trim(),
                        Description = dto.Description,
                        NumberOfTitles = titlesCount,
                        TotalPrice = calculatedMRP,
                        DiscountPercentage = dto.DiscountPercentage,
                        FinalPrice = dto.FinalPrice,
                        IsActive = dto.IsActive,
                        CreatedAt = DateTime.UtcNow
                    };
                    _dbContext.Bundles.Add(bundle);
                }
                foreach (var bookId in actualBookIds)
                {
                    _dbContext.BundleItems.Add(new BundleItem
                    {
                        Id = Guid.NewGuid(),
                        BundleId = bundle.Id,
                        BookId = bookId
                    });
                }

                await _dbContext.SaveChangesAsync();

                await _dbContext.Database.ExecuteSqlRawAsync(@"
                    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'BundleJournalItems')
                    BEGIN
                        CREATE TABLE BundleJournalItems (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
                            BundleId UNIQUEIDENTIFIER NOT NULL,
                            JournalId UNIQUEIDENTIFIER NOT NULL
                        );
                    END");

                await _dbContext.Database.ExecuteSqlRawAsync("DELETE FROM BundleJournalItems WHERE BundleId = {0}", bundle.Id);
                foreach (var jId in actualJournalIds)
                {
                    await _dbContext.Database.ExecuteSqlRawAsync(
                        "INSERT INTO BundleJournalItems (Id, BundleId, JournalId) VALUES ({0}, {1}, {2})",
                        Guid.NewGuid(), bundle.Id, jId);
                }

                return Ok(new
                {
                    success = true,
                    message = "Bundle Master saved successfully!",
                    bundleId = bundle.Id
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error saving bundle: " + (ex.InnerException?.Message ?? ex.Message) });
            }
        }

        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> DeleteBundle(Guid id)
        {
            try
            {
                var bundle = await _dbContext.Bundles
                    .FirstOrDefaultAsync(b => b.Id == id);

                if (bundle == null)
                    return NotFound(new { message = "Bundle not found." });

                var existingItems = await _dbContext.BundleItems
                    .Where(bi => bi.BundleId == id)
                    .ToListAsync();

                if (existingItems.Any())
                {
                    _dbContext.BundleItems.RemoveRange(existingItems);
                }
                await _dbContext.Database.ExecuteSqlRawAsync("DELETE FROM BundleJournalItems WHERE BundleId = {0}", id);
                _dbContext.Bundles.Remove(bundle);

                await _dbContext.SaveChangesAsync();

                return Ok(new { success = true, message = "Bundle deleted successfully." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error deleting bundle: " + (ex.InnerException?.Message ?? ex.Message) });
            }
        }
    }
}