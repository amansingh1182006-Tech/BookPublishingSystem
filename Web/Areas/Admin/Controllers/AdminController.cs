using System;
using System.Linq;
using System.Threading.Tasks;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BookPublishingSystem.Domain.Entities;
using Application.DTOs;

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

        // NEW ENDPOINT: FETCH ALL CUSTOMER COLUMNS FOR ADMIN LIST
        [HttpGet("customers-list")]
        public async Task<IActionResult> GetCustomersList()
        {
            var customers = await _dbContext.Customers
                .OrderByDescending(c => c.CreatedAt)
                .Select(c => new CustomerDto
                {
                    Id = c.Id,
                    CustId = c.CustId,
                    CustName = c.CustName,
                    MobileNo = c.MobileNo == "N/A" ? "" : c.MobileNo,
                    EmailId = c.EmailId,
                    Address1 = c.Address1 == "Pending Profile Update" ? "" : c.Address1,
                    Address2 = c.Address2,
                    Country = string.IsNullOrWhiteSpace(c.Country) ? "India" : c.Country,
                    State = c.State == "N/A" ? "" : c.State,
                    PostalCode = c.PostalCode == "000000" ? "" : c.PostalCode,
                    Landmark = c.Landmark,
                    UserId = c.UserId
                })
                .ToListAsync();

            return Ok(customers);
        }

        // NEW ENDPOINT: DELETE CUSTOMER RECORD
        [HttpDelete("delete-customer/{id}")]
        public async Task<IActionResult> DeleteCustomer(Guid id)
        {
            var customer = await _dbContext.Customers.FindAsync(id);
            if (customer == null) return NotFound(new { message = "Customer not found." });

            _dbContext.Customers.Remove(customer);
            await _dbContext.SaveChangesAsync();

            return Ok(new { success = true, message = "Customer deleted successfully." });
        }
    }
}