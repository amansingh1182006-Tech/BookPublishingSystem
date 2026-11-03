using System.Linq;
using System.Threading.Tasks;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BookPublishingSystem.Domain.Entities;

namespace Web.Areas.Admin.Controllers
{
    [Area("Admin")]
    [Authorize(Roles = "Admin")] 
    [Route("api/admin/[controller]")]
    [ApiController]
    public class AdminController : ControllerBase
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly UserManager<ApplicationUser> _userManager;

        public AdminController(ApplicationDbContext dbContext, UserManager<ApplicationUser> userManager)
        {
            _dbContext = dbContext;
            _userManager = userManager;
        }

        
        [HttpGet("all-users")]
        public async Task<IActionResult> GetAllUserProfiles()
        {
            var users = await _dbContext.Users.ToListAsync();
            var result = new System.Collections.Generic.List<object>();

            foreach (var user in users)
            {
                var roles = await _userManager.GetRolesAsync(user);
                result.Add(new
                {
                    user.Id,
                    user.FullName,
                    user.Email,
                    user.Bio,
                    user.ProfilePicturePath,
                    Roles = roles
                });
            }

            return Ok(result);
        }

        
        [HttpGet("all-purchases")]
        public async Task<IActionResult> GetAllPurchases()
        {
            var purchases = await _dbContext.Customers
                .Include(p => p.User)
                .Include(p => p.Book)
                .OrderByDescending(p => p.PurchasedAt)
                .Select(p => new
                {
                    p.Id,
                    p.TransactionId,
                    p.AmountPaid,
                    p.PurchasedAt,
                    User = new
                    {
                        p.User!.Id,
                        p.User.FullName,
                        p.User.Email
                    },
                    Book = new
                    {
                        p.Book!.Id,
                        p.Book.ItemNo,
                        p.Book.ISBN,
                        p.Book.ItemName,
                        p.Book.AuthorMaster,
                        p.Book.Price
                    }
                })
                .ToListAsync();

            return Ok(purchases);
        }

        
        [HttpGet("dashboard-summary")]
        public async Task<IActionResult> GetDashboardSummary()
        {
            var totalUsers = await _dbContext.Users.CountAsync();
            var totalBooks = await _dbContext.Books.CountAsync();
            var totalPurchases = await _dbContext.Customers.CountAsync();
            var totalRevenue = await _dbContext.Customers.SumAsync(p => (decimal?)p.AmountPaid) ?? 0;

            return Ok(new
            {
                totalUsers,
                totalBooks,
                totalPurchases,
                totalRevenue
            });
        }
    }
}