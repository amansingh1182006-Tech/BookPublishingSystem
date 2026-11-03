using BookPublishingSystem.Application.DTOs;
using BookPublishingSystem.Domain.Entities;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BookPublishingSystem.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
public class KeywordController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public KeywordController(ApplicationDbContext context)
    {
        _context = context;
    }

    // GET: api/keyword/all
    [HttpGet("all")]
    public async Task<IActionResult> GetKeywords()
    {
        var keywords = await _context.Keywords
            .Where(k => k.IsActive)
            .Select(k => new
            {
                Id = k.Id,
                KeywordCode = k.KeywordCode,
                KeywordName = k.KeywordName,
                Description = k.Description ?? "Core Search Term"
            })
            .ToListAsync();
        return Ok(keywords);
    }

    // POST: api/keyword/create (Auto System Generated Code)
    [HttpPost("create")]
    public async Task<IActionResult> CreateKeyword([FromBody] KeywordCreateDto dto)
    {
        if (dto == null || string.IsNullOrWhiteSpace(dto.KeywordName))
        {
            return BadRequest(new { message = "Keyword Name is required." });
        }

        // AUTO SYSTEM GENERATED KEYWORD CODE
        string code = $"KW_{Guid.NewGuid().ToString("N").Substring(0, 6).ToUpper()}";

        var newKeyword = new Keyword
        {
            Id = Guid.NewGuid(),
            KeywordCode = code,
            KeywordName = dto.KeywordName.Trim(),
            Description = string.IsNullOrWhiteSpace(dto.Description) ? "Core Search Term" : dto.Description.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Keywords.Add(newKeyword);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Keyword created successfully!",
            id = newKeyword.Id,
            keywordCode = newKeyword.KeywordCode,
            keywordName = newKeyword.KeywordName
        });
    }

    // PUT: api/keyword/update/{id}
    [HttpPut("update/{id}")]
    public async Task<IActionResult> UpdateKeyword(Guid id, [FromBody] KeywordCreateDto dto)
    {
        if (dto == null || string.IsNullOrWhiteSpace(dto.KeywordName))
        {
            return BadRequest(new { message = "Keyword Name is required." });
        }

        var existing = await _context.Keywords.FirstOrDefaultAsync(k => k.Id == id && k.IsActive);
        if (existing == null)
        {
            return NotFound(new { message = "Keyword record not found." });
        }

        existing.KeywordName = dto.KeywordName.Trim();
        existing.Description = string.IsNullOrWhiteSpace(dto.Description) ? "Updated Keyword" : dto.Description.Trim();
        await _context.SaveChangesAsync();

        return Ok(new { message = "Keyword details updated successfully!" });
    }
}