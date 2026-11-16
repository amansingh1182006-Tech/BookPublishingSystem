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


        [HttpGet("customers-list")]
        public async Task<IActionResult> GetCustomersList()
        {
            var allCustomers = await _dbContext.Customers
                .OrderBy(c => c.CreatedAt)
                .ToListAsync();

            var uniqueCustomers = allCustomers
                .GroupBy(c => !string.IsNullOrWhiteSpace(c.UserId)
                    ? c.UserId.Trim().ToLower()
                    : (c.EmailId ?? c.Id.ToString()).Trim().ToLower())
                .Select(g =>
                {
                    var master = g.FirstOrDefault(x => x.TransactionId == "INIT-PROFILE")
                              ?? g.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x.MobileNo) && x.MobileNo != "N/A")
                              ?? g.First();

                    return new CustomerDto
                    {
                        Id = master.Id,
                        CustId = master.CustId,
                        CustName = master.CustName,
                        MobileNo = master.MobileNo == "N/A" ? "" : master.MobileNo,
                        EmailId = master.EmailId,
                        Address1 = master.Address1 == "Pending Profile Update" ? "" : master.Address1,
                        Address2 = master.Address2,
                        Country = string.IsNullOrWhiteSpace(master.Country) ? "India" : master.Country,
                        State = master.State == "N/A" ? "" : master.State,
                        PostalCode = master.PostalCode == "000000" ? "" : master.PostalCode,
                        Landmark = master.Landmark,
                        UserId = master.UserId
                    };
                })
                .ToList();

            return Ok(uniqueCustomers);
        }


        [HttpDelete("delete-customer/{id}")]
        public async Task<IActionResult> DeleteCustomer(Guid id)
        {
            var customer = await _dbContext.Customers.FindAsync(id);
            if (customer == null) return NotFound(new { message = "Customer not found." });

            _dbContext.Customers.Remove(customer);
            await _dbContext.SaveChangesAsync();

            return Ok(new { success = true, message = "Customer deleted successfully." });
        }

        
        [HttpGet("customer-full-profile/{id}")]
        public async Task<IActionResult> GetCustomerFullProfile(Guid id)
        {
            var customer = await _dbContext.Customers.FirstOrDefaultAsync(c => c.Id == id);
            if (customer == null)
                return NotFound(new { message = "Customer record not found." });

            string userId = customer.UserId;

            
            var rawSubs = await _dbContext.UserSubscriptions
                .Include(s => s.Plan)
                .ThenInclude(p => p!.Features)
                .Where(s => s.UserId == userId)
                .OrderByDescending(s => s.StartDate)
                .ToListAsync();

            var royaltyBookIds = await _dbContext.VendorRoyaltyRules
                .Where(r => r.IsRoyaltyApplicable && r.LiveStatus == "Live")
                .Select(r => r.BookId)
                .ToListAsync();

            var allPublishedBooks = await _dbContext.Books
                .Include(b => b.AuthorMaster)
                .Where(b => b.IsPublished)
                .OrderByDescending(b => b.CreatedAt)
                .ToListAsync();

            var plansList = new System.Collections.Generic.List<object>();
            foreach (var s in rawSubs)
            {
                var planBooks = new System.Collections.Generic.List<object>();
                if (s.Plan != null)
                {
                    var basicBooks = allPublishedBooks.Where(b => !royaltyBookIds.Contains(b.Id)).ToList();
                    var royaltyBooks = allPublishedBooks.Where(b => royaltyBookIds.Contains(b.Id)).ToList();

                    var selectedBooks = new System.Collections.Generic.List<Book>();
                    if (s.Plan.MaxBookLimit == -1)
                    {
                        selectedBooks.AddRange(allPublishedBooks);
                    }
                    else
                    {
                        if (s.Plan.BasicBookLimit > 0)
                            selectedBooks.AddRange(basicBooks.Take(s.Plan.BasicBookLimit));
                        if (s.Plan.RoyaltyBookLimit > 0)
                            selectedBooks.AddRange(royaltyBooks.Take(s.Plan.RoyaltyBookLimit));
                        if (!selectedBooks.Any() && s.Plan.MaxBookLimit > 0)
                            selectedBooks.AddRange(allPublishedBooks.Take(s.Plan.MaxBookLimit));
                    }

                    planBooks = selectedBooks.Select(b => (object)new
                    {
                        bookId = b.Id,
                        itemName = b.ItemName,
                        authorName = b.AuthorMaster != null ? b.AuthorMaster.AuthorName : "B. Jain Author",
                        coverImage = b.CoverImagePath ?? "/images/default-cover.png",
                        pages = b.NoOfPages
                    }).ToList();
                }

                plansList.Add(new
                {
                    planName = s.Plan != null ? s.Plan.PlanName : "Subscription Plan",
                    startDate = s.StartDate,
                    endDate = s.ExpiryDate,
                    amountPaid = s.AmountPaid,
                    billingPeriod = s.Plan != null ? s.Plan.BillingPeriod : "Standard",
                    transactionId = s.TransactionId,
                    isActive = s.ExpiryDate >= DateTime.UtcNow && s.Status == "Active",
                    remainingDays = s.ExpiryDate >= DateTime.UtcNow ? (int)(s.ExpiryDate - DateTime.UtcNow).TotalDays : 0,
                    books = planBooks
                });
            }

            
            var bundlesList = new System.Collections.Generic.List<object>();
            var bundlePurchases = await _dbContext.Customers
                .Where(c => c.UserId == userId && c.PlanType != null && c.PlanType.StartsWith("Bundle:"))
                .OrderByDescending(c => c.PurchasedAt)
                .ToListAsync();

            foreach (var bp in bundlePurchases)
            {
                string bundleName = bp.PlanType!.Replace("Bundle:", "").Trim();
                var matchedBundle = await _dbContext.Bundles
                    .FirstOrDefaultAsync(b => b.BundleName == bundleName);

                var bundleBooks = new System.Collections.Generic.List<object>();
                if (matchedBundle != null)
                {
                    var booksInBundle = await _dbContext.BundleItems
                        .Include(bi => bi.Book)
                        .ThenInclude(bk => bk!.AuthorMaster)
                        .Where(bi => bi.BundleId == matchedBundle.Id && bi.Book != null)
                        .Select(bi => (object)new
                        {
                            bookId = bi.BookId,
                            itemName = bi.Book!.ItemName,
                            authorName = bi.Book.AuthorMaster != null ? bi.Book.AuthorMaster.AuthorName : "B. Jain Author",
                            coverImage = bi.Book.CoverImagePath ?? "/images/default-cover.png"
                        })
                        .ToListAsync();

                    bundleBooks.AddRange(booksInBundle);
                }

                bundlesList.Add(new
                {
                    bundleName = bundleName,
                    purchasedDate = bp.PurchasedAt,
                    amountPaid = bp.AmountPaid,
                    books = bundleBooks
                });
            }

            
            var libraryList = await _dbContext.UserReadingProgress
                .Where(p => p.UserId == userId)
                .OrderByDescending(p => p.LastReadAt)
                .Select(p => new
                {
                    bookId = p.BookId,
                    itemName = p.Book != null ? p.Book.ItemName : "eBook Document",
                    authorName = p.Book != null && p.Book.AuthorMaster != null ? p.Book.AuthorMaster.AuthorName : "B. Jain Author",
                    categoryCode = p.Book != null ? p.Book.CategoryCode : "HOMEO",
                    coverImage = p.Book != null ? p.Book.CoverImagePath : "/images/default-cover.png",
                    lastReadPage = p.LastReadPage,
                    totalPages = p.TotalPages,
                    lastReadAt = p.LastReadAt
                })
                .ToListAsync();

            return Ok(new
            {
                profile = new
                {
                    id = customer.Id,
                    custId = customer.CustId,
                    custName = customer.CustName,
                    mobileNo = customer.MobileNo == "N/A" ? "" : customer.MobileNo,
                    emailId = customer.EmailId,
                    address1 = customer.Address1 == "Pending Profile Update" ? "" : customer.Address1,
                    address2 = customer.Address2,
                    country = string.IsNullOrWhiteSpace(customer.Country) ? "India" : customer.Country,
                    state = customer.State == "N/A" ? "" : customer.State,
                    postalCode = customer.PostalCode == "000000" ? "" : customer.PostalCode,
                    landmark = customer.Landmark
                },
                plans = plansList,
                bundles = bundlesList,
                library = libraryList
            });
        }
    }
}