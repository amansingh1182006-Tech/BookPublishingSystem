using BookPublishingSystem.Application.DTOs;
using BookPublishingSystem.Domain.Entities;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BookPublishingSystem.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CategoryController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public CategoryController(ApplicationDbContext context)
    {
        _context = context;
    }

    // GET: api/category/all
    [HttpGet("all")]
    public async Task<IActionResult> GetCategories()
    {
        var categories = await _context.Categories
            .Where(c => c.IsActive)
            .Select(c => new
            {
                CategoryCode = c.CategoryCode,
                CategoryName = c.CategoryName,
                Description = c.Description ?? "System Category"
            })
            .ToListAsync();
        return Ok(categories);
    }

    // POST: api/category/create 
    [HttpPost("create")]
    public async Task<IActionResult> CreateCategory([FromBody] CategoryCreateDto dto)
    {
        if (dto == null || string.IsNullOrWhiteSpace(dto.CategoryName))
        {
            return BadRequest(new { message = "Category Name is required." });
        }

       
        string code = $"CAT_{Guid.NewGuid().ToString("N").Substring(0, 6).ToUpper()}";

        var newCategory = new Category
        {
            CategoryCode = code,
            CategoryName = dto.CategoryName.Trim(),
            Description = string.IsNullOrWhiteSpace(dto.Description) ? "Manually Added Category" : dto.Description.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Categories.Add(newCategory);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Category created successfully!",
            categoryCode = newCategory.CategoryCode,
            categoryName = newCategory.CategoryName
        });
    }

    [HttpPost("bulk-upload-grid")]
    public async Task<IActionResult> BulkUploadCategories([FromBody] List<BulkCategoryRowDto> categories)
    {
        if (categories == null || !categories.Any())
        {
            return BadRequest(new { success = false, message = "Not Provide Any Catories Name." });
        }

        int successCount = 0;
        foreach (var item in categories)
        {
            if (string.IsNullOrWhiteSpace(item.CategoryName)) continue;

            string trimmedName = item.CategoryName.Trim();

            bool exists = await _context.Categories
                .AnyAsync(c => c.CategoryName.ToLower() == trimmedName.ToLower());

            if (!exists)
            {
                string code = $"CAT_{Guid.NewGuid().ToString("N").Substring(0, 6).ToUpper()}";

                var newCategory = new Category
                {
                    CategoryCode = code,
                    CategoryName = trimmedName,
                    Description = string.IsNullOrWhiteSpace(item.Description) ? "Bulk Uploaded Category" : item.Description.Trim(),
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Categories.Add(newCategory);
                successCount++;
            }
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = $"{successCount} Categories successfully Aaded!"
        });
    }

    // PUT: api/category/update/{code} 
    [HttpPut("update/{code}")]
    public async Task<IActionResult> UpdateCategory(string code, [FromBody] CategoryCreateDto dto)
    {
        if (string.IsNullOrWhiteSpace(code) || dto == null || string.IsNullOrWhiteSpace(dto.CategoryName))
        {
            return BadRequest(new { message = "Category Name is required." });
        }

        var existing = await _context.Categories.FirstOrDefaultAsync(c => c.CategoryCode == code && c.IsActive);
        if (existing == null)
        {
            return NotFound(new { message = "Category not found." });
        }

        existing.CategoryName = dto.CategoryName.Trim();
        existing.Description = string.IsNullOrWhiteSpace(dto.Description) ? "Updated Category" : dto.Description.Trim();

        await _context.SaveChangesAsync();

        return Ok(new { message = "Category updated successfully!" });
    }

    [HttpDelete("delete/{code}")]
    [HttpDelete("{code}")]
    [HttpPost("delete/{code}")]
    public async Task<IActionResult> DeleteCategory(string code)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return BadRequest(new { message = "Category Code is required." });
        }

        string cleanCode = Uri.UnescapeDataString(code).Trim();

        var category = await _context.Categories.FirstOrDefaultAsync(c =>
            c.CategoryCode.ToLower() == cleanCode.ToLower() ||
            c.CategoryName.ToLower() == cleanCode.ToLower());

        if (category == null)
        {
            return NotFound(new { message = $"Category '{cleanCode}' not found." });
        }

        _context.Categories.Remove(category);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Category deleted successfully!" });
    }
}