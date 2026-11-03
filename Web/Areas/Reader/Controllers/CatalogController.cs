using BookPublishingSystem.Domain.Entities;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace Web.Areas.Reader.Controllers
{
    [Area("Reader")]
    [Route("api/reader/[controller]")]
    [ApiController]
    public class CatalogController : ControllerBase
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly UserManager<ApplicationUser> _userManager;

        public CatalogController(ApplicationDbContext dbContext, UserManager<ApplicationUser> userManager)
        {
            _dbContext = dbContext;
            _userManager = userManager;
        }

        // GET ALL PUBLISHED BOOKS FOR CATALOG
        [HttpGet("all-books")]
        public async Task<IActionResult> GetAllBooks()
        {
            var books = await _dbContext.Books
                .Where(b => b.IsPublished)
                .Select(b => new
                {
                    id = b.Id,
                    itemNo = b.ItemNo,
                    itemName = b.ItemName,
                    price = b.Price,
                    noOfPages = b.NoOfPages,
                    categoryCode = b.CategoryCode,
                    image = b.CoverImagePath,
                    author = b.AuthorMaster != null ? b.AuthorMaster.AuthorName : (b.Author != null ? b.Author.FullName : "B. Jain Author"),
                    chunkCount = _dbContext.BookSegmentsAlpha.Count(s => s.BookId == b.Id) +
                                 _dbContext.BookSegmentsBeta.Count(s => s.BookId == b.Id) +
                                 _dbContext.BookSegmentsGamma.Count(s => s.BookId == b.Id),
                    createdAt = b.CreatedAt
                })
                .ToListAsync();

            return Ok(books);
        }

        //  GET ONLY LOGGED-IN READER'S PURCHASED BOOKS
        [HttpGet("my-library")]
        [Authorize]
        public async Task<IActionResult> GetMyLibrary()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            try
            {
               
                var rawPurchases = await _dbContext.Customers
                    .Include(p => p.Book)
                        .ThenInclude(b => b.AuthorMaster)
                    .Include(p => p.Book)
                        .ThenInclude(b => b.Author)
                    .Where(p => p.UserId == user.Id)
                    .ToListAsync();

                var bookIds = rawPurchases.Select(p => p.BookId).Distinct().ToList();

               
                var alphaCounts = await _dbContext.BookSegmentsAlpha
                    .Where(s => bookIds.Contains(s.BookId))
                    .GroupBy(s => s.BookId)
                    .Select(g => new { BookId = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.BookId, x => x.Count);

                var betaCounts = await _dbContext.BookSegmentsBeta
                    .Where(s => bookIds.Contains(s.BookId))
                    .GroupBy(s => s.BookId)
                    .Select(g => new { BookId = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.BookId, x => x.Count);

                var gammaCounts = await _dbContext.BookSegmentsGamma
                    .Where(s => bookIds.Contains(s.BookId))
                    .GroupBy(s => s.BookId)
                    .Select(g => new { BookId = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.BookId, x => x.Count);

                var myPurchases = rawPurchases.Select(p =>
                {
                    int total = 0;
                    if (alphaCounts.TryGetValue(p.BookId, out int a)) total += a;
                    if (betaCounts.TryGetValue(p.BookId, out int b)) total += b;
                    if (gammaCounts.TryGetValue(p.BookId, out int g)) total += g;

                    return new
                    {
                        PurchaseId = p.Id,
                        BookId = p.BookId,
                        Title = p.Book != null ? p.Book.ItemName : "Unknown Book",
                        AuthorName = (p.Book != null && p.Book.AuthorMaster != null)
                            ? p.Book.AuthorMaster.AuthorName
                            : ((p.Book != null && p.Book.Author != null) ? p.Book.Author.FullName : "B. Jain Author"),
                        CoverImagePath = p.Book != null ? p.Book.CoverImagePath : null,
                        PricePaid = p.AmountPaid,
                        TotalChunks = total
                    };
                }).ToList();

                return Ok(myPurchases);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Error loading library: {ex.Message}" });
            }
        }
    }
}