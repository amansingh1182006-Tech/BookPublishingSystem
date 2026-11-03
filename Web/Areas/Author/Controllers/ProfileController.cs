using System.Linq;
using System.Threading.Tasks;
using BookPublishingSystem.Domain.Entities;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Web.Areas.Author.Controllers
{
    [Area("Author")]
    [Authorize(Roles = "Author,Publisher")]
    [Route("api/author/[controller]")]
    [ApiController]
    public class ProfileController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ApplicationDbContext _dbContext;

        public ProfileController(UserManager<ApplicationUser> userManager, ApplicationDbContext dbContext)
        {
            _userManager = userManager;
            _dbContext = dbContext;
        }

        [HttpGet]
        public async Task<IActionResult> GetProfile()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var authorBooks = await _dbContext.Books
                .Where(b => b.AuthorId == user.Id)
                .Select(b => new
                {
                    b.Id,
                    b.ItemNo,
                    b.ISBN,
                    b.ItemName,
                    b.CategoryCode,
                    b.NoOfPages,
                    b.Language,
                    b.Price,
                    b.IsPublished,
                    b.CreatedAt
                })
                .ToListAsync();

            var publishedCount = authorBooks.Count(b => b.IsPublished);
            var draftCount = authorBooks.Count(b => !b.IsPublished);

            return Ok(new
            {
                user.Id,
                user.FullName,
                user.Email,
                user.Bio,
                user.ProfilePicturePath,
                stats = new
                {
                    publishedBooks = publishedCount,
                    draftBooks = draftCount
                },
                myBooks = authorBooks 
            });
        }

        [HttpPut("update-bio")]
        public async Task<IActionResult> UpdateBio([FromBody] string bio)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            user.Bio = bio;
            await _userManager.UpdateAsync(user);

            return Ok(new { message = "Bio updated successfully" });
        }
    }
}