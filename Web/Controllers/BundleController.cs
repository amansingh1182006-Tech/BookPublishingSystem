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
                var bundles = await _dbContext.Bundles
                    .Include(b => b.BundleItems)
                        .ThenInclude(bi => bi.Book)
                    .OrderByDescending(b => b.CreatedAt)
                    .Select(b => new
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
                        BookTitles = b.BundleItems.Select(bi => new
                        {
                            bi.BookId,
                            BookName = bi.Book != null ? bi.Book.ItemName : "N/A",
                            Price = bi.Book != null ? bi.Book.Price : 0m
                        }).ToList()
                    })
                    .ToListAsync();

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
                SelectedBookIds = bundle.BundleItems.Select(bi => bi.BookId).ToList()
            });
        }

       
        [HttpPost("save")]
        public async Task<IActionResult> SaveBundle([FromBody] SaveBundleDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            if (dto.SelectedBookIds == null || dto.SelectedBookIds.Count == 0)
                return BadRequest(new { message = "Please select at least 1 book title for the bundle." });

            try
            {
                
                var selectedBooks = await _dbContext.Books
                    .Where(b => dto.SelectedBookIds.Contains(b.Id))
                    .ToListAsync();

                decimal calculatedMRP = selectedBooks.Sum(b => b.Price);
                int titlesCount = selectedBooks.Count;

                Bundle bundle;

                
                if (dto.Id.HasValue && dto.Id.Value != Guid.Empty)
                {
                    bundle = await _dbContext.Bundles
                        .Include(b => b.BundleItems)
                        .FirstOrDefaultAsync(b => b.Id == dto.Id.Value);

                    if (bundle == null)
                        return NotFound(new { message = "Bundle not found." });

                    bundle.BundleName = dto.BundleName.Trim();
                    bundle.Description = dto.Description;
                    bundle.NumberOfTitles = titlesCount;
                    bundle.TotalPrice = calculatedMRP;
                    bundle.DiscountPercentage = dto.DiscountPercentage;
                    bundle.FinalPrice = dto.FinalPrice;
                    bundle.IsActive = dto.IsActive;

                   
                    _dbContext.BundleItems.RemoveRange(bundle.BundleItems);
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

                
                foreach (var bookId in dto.SelectedBookIds)
                {
                    bundle.BundleItems.Add(new BundleItem
                    {
                        Id = Guid.NewGuid(),
                        BundleId = bundle.Id,
                        BookId = bookId
                    });
                }

                await _dbContext.SaveChangesAsync();

                return Ok(new
                {
                    success = true,
                    message = "Bundle Master saved successfully!",
                    bundleId = bundle.Id
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error saving bundle: " + ex.Message });
            }
        }

        
        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> DeleteBundle(Guid id)
        {
            try
            {
                var bundle = await _dbContext.Bundles
                    .Include(b => b.BundleItems)
                    .FirstOrDefaultAsync(b => b.Id == id);

                if (bundle == null)
                    return NotFound(new { message = "Bundle not found." });

                _dbContext.BundleItems.RemoveRange(bundle.BundleItems);
                _dbContext.Bundles.Remove(bundle);

                await _dbContext.SaveChangesAsync();

                return Ok(new { success = true, message = "Bundle deleted successfully." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error deleting bundle: " + ex.Message });
            }
        }
    }
}