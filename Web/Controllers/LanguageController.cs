using BookPublishingSystem.Application.DTOs;
using BookPublishingSystem.Domain.Entities;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BookPublishingSystem.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LanguageController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public LanguageController(ApplicationDbContext context)
    {
        _context = context;
    }

    // GET: api/language/all
    [HttpGet("all")]
    public async Task<IActionResult> GetLanguages()
    {
        var languages = await _context.Languages
            .Where(l => l.IsActive)
            .Select(l => new
            {
                Id = l.Id,
                LanguageCode = l.LanguageCode,
                LanguageName = l.LanguageName
            })
            .ToListAsync();
        return Ok(languages);
    }

    // POST: api/language/create 
    [HttpPost("create")]
    public async Task<IActionResult> CreateLanguage([FromBody] LanguageCreateDto dto)
    {
        if (dto == null || string.IsNullOrWhiteSpace(dto.LanguageName))
        {
            return BadRequest(new { message = "Language Name is required." });
        }

        
        string code = $"LANG_{Guid.NewGuid().ToString("N").Substring(0, 6).ToUpper()}";

        var newLanguage = new Language
        {
            Id = Guid.NewGuid(),
            LanguageCode = code,
            LanguageName = dto.LanguageName.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Languages.Add(newLanguage);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Language created successfully!",
            id = newLanguage.Id,
            languageCode = newLanguage.LanguageCode,
            languageName = newLanguage.LanguageName
        });
    }

    // PUT: api/language/update/{id}
    [HttpPut("update/{id}")]
    public async Task<IActionResult> UpdateLanguage(Guid id, [FromBody] LanguageCreateDto dto)
    {
        if (dto == null || string.IsNullOrWhiteSpace(dto.LanguageName))
        {
            return BadRequest(new { message = "Language Name is required." });
        }

        var existing = await _context.Languages.FirstOrDefaultAsync(l => l.Id == id && l.IsActive);
        if (existing == null)
        {
            return NotFound(new { message = "Language record not found." });
        }

        existing.LanguageName = dto.LanguageName.Trim();
        await _context.SaveChangesAsync();

        return Ok(new { message = "Language details updated successfully!" });
    }

    [HttpDelete("delete/{identifier}")]
    [HttpDelete("{identifier}")]
    [HttpPost("delete/{identifier}")]
    public async Task<IActionResult> DeleteLanguage(string identifier)
    {
        if (string.IsNullOrWhiteSpace(identifier))
        {
            return BadRequest(new { message = "Language Identifier is required." });
        }

        string cleanId = Uri.UnescapeDataString(identifier).Trim();
        Language language = null;

        if (Guid.TryParse(cleanId, out Guid parsedGuid))
        {
            language = await _context.Languages.FindAsync(parsedGuid);
        }

        if (language == null)
        {
            language = await _context.Languages.FirstOrDefaultAsync(l =>
                l.LanguageCode.ToLower() == cleanId.ToLower() ||
                l.LanguageName.ToLower() == cleanId.ToLower());
        }

        if (language == null)
        {
            return NotFound(new { message = $"Language '{cleanId}' not found." });
        }

        _context.Languages.Remove(language);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Language deleted successfully!" });
    }
}