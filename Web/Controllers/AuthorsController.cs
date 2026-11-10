using Application.DTOs; 
using BookPublishingSystem.Domain.Entities;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Web.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthorsController : ControllerBase
    {
        private readonly ApplicationDbContext _dbContext;

        public AuthorsController(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

       
        [HttpGet("all")]
        public async Task<IActionResult> GetAllAuthors()
        {
            var authors = await _dbContext.Authors
                .OrderByDescending(a => a.CreatedAt)
                .Select(a => new AuthorDto
                {
                    Id = a.Id,
                    AuthorName = a.AuthorName,
                    CreatedAt = a.CreatedAt,
                    ModifiedAt = a.ModifiedAt
                })
                .ToListAsync();

            return Ok(authors);
        }

       
        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetAuthorById(Guid id)
        {
            var author = await _dbContext.Authors.FindAsync(id);
            if (author == null)
            {
                return NotFound(new { message = "Author not found." });
            }

            var authorDto = new AuthorDto
            {
                Id = author.Id,
                AuthorName = author.AuthorName,
                CreatedAt = author.CreatedAt,
                ModifiedAt = author.ModifiedAt
            };

            return Ok(authorDto);
        }

        
        [HttpPost("create")]
        public async Task<IActionResult> CreateAuthor([FromBody] AuthorDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.AuthorName))
            {
                return BadRequest(new { message = "Author Name is required." });
            }

            var author = new Author
            {
                Id = Guid.NewGuid(),
                AuthorName = dto.AuthorName.Trim(),
                CreatedAt = DateTime.UtcNow
            };

            _dbContext.Authors.Add(author);
            await _dbContext.SaveChangesAsync();

            return Ok(new
            {
                message = $"Author '{author.AuthorName}' created successfully!",
                data = new AuthorDto
                {
                    Id = author.Id,
                    AuthorName = author.AuthorName,
                    CreatedAt = author.CreatedAt,
                    ModifiedAt = author.ModifiedAt
                }
            });
        }

        [HttpPost("bulk-upload-grid")]
        public async Task<IActionResult> BulkUploadAuthors([FromBody] List<BulkAuthorRowDto> authors)
        {
            if (authors == null || !authors.Any())
            {
                return BadRequest(new { success = false, message = "Not Provide Author Name" });
            }

            int successCount = 0;

            foreach (var item in authors)
            {
                if (string.IsNullOrWhiteSpace(item.AuthorName)) continue;

                string trimmedName = item.AuthorName.Trim();

                bool exists = await _dbContext.Authors
                    .AnyAsync(a => a.AuthorName.ToLower() == trimmedName.ToLower());

                if (!exists)
                {
                    var author = new Author
                    {
                        Id = Guid.NewGuid(),
                        AuthorName = trimmedName,
                        CreatedAt = DateTime.UtcNow
                    };

                    _dbContext.Authors.Add(author);
                    successCount++;
                }
            }

            await _dbContext.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                message = $"{successCount} Authors successfully bulk aaded"
            });
        }


        [HttpPut("update/{id:guid}")]
        public async Task<IActionResult> UpdateAuthor(Guid id, [FromBody] AuthorDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.AuthorName))
            {
                return BadRequest(new { message = "Author Name is required." });
            }

            var author = await _dbContext.Authors.FindAsync(id);
            if (author == null)
            {
                return NotFound(new { message = "Author not found." });
            }

            author.AuthorName = dto.AuthorName.Trim();
            author.ModifiedAt = DateTime.UtcNow;

            _dbContext.Authors.Update(author);
            await _dbContext.SaveChangesAsync();

            return Ok(new
            {
                message = "Author updated successfully!",
                data = new AuthorDto
                {
                    Id = author.Id,
                    AuthorName = author.AuthorName,
                    CreatedAt = author.CreatedAt,
                    ModifiedAt = author.ModifiedAt
                }
            });
        }

       
        [HttpDelete("delete/{id:guid}")]
        public async Task<IActionResult> DeleteAuthor(Guid id)
        {
            var author = await _dbContext.Authors
                .Include(a => a.Books)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (author == null)
            {
                return NotFound(new { message = "Author not found." });
            }

           
            if (author.Books != null && author.Books.Any())
            {
                return BadRequest(new { message = "Cannot delete author because they have active books assigned." });
            }

            _dbContext.Authors.Remove(author);
            await _dbContext.SaveChangesAsync();

            return Ok(new { message = $"Author '{author.AuthorName}' deleted successfully!" });
        }
    }
}