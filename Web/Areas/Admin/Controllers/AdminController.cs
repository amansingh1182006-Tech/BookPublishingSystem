using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Application.DTOs;
using BookPublishingSystem.Domain.Entities;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Web.Areas.Admin.Controllers
{
    [Area("Admin")]
    [Authorize(Roles = "Admin")]
    [Route("api/admin/[controller]")]
    [ApiController]
    [IgnoreAntiforgeryToken]
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
            try
            {
                var users = await _dbContext.Users
                    .AsNoTracking()
                    .Select(u => new
                    {
                        u.Id,
                        u.FullName,
                        u.Email,
                        u.Bio,
                        u.ProfilePicturePath
                    })
                    .ToListAsync();

                var userRolesLookup = await (from ur in _dbContext.UserRoles.AsNoTracking()
                                             join r in _dbContext.Roles.AsNoTracking() on ur.RoleId equals r.Id
                                             select new { ur.UserId, RoleName = r.Name })
                                             .ToListAsync();

                var rolesByUser = userRolesLookup
                    .GroupBy(x => x.UserId)
                    .ToDictionary(g => g.Key, g => g.Select(x => x.RoleName!).Where(n => !string.IsNullOrEmpty(n)).ToList());

                var result = users.Select(u => new
                {
                    u.Id,
                    u.FullName,
                    u.Email,
                    u.Bio,
                    u.ProfilePicturePath,
                    Roles = rolesByUser.TryGetValue(u.Id, out var rList) ? rList : new List<string>()
                }).ToList();

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error fetching users.", detail = ex.InnerException?.Message ?? ex.Message });
            }
        }

        [HttpGet("all-purchases")]
        public async Task<IActionResult> GetAllPurchases()
        {
            try
            {
                var purchases = await _dbContext.Customers
                    .AsNoTracking()
                    .Where(p => p.AmountPaid > 0 || (p.TransactionId != "INIT-PROFILE" && p.TransactionId != "REGISTER-INIT"))
                    .OrderByDescending(p => p.PurchasedAt)
                    .Select(p => new
                    {
                        p.Id,
                        p.TransactionId,
                        p.AmountPaid,
                        p.PurchasedAt,
                        User = p.User != null ? new
                        {
                            p.User.Id,
                            p.User.FullName,
                            p.User.Email
                        } : new
                        {
                            Id = p.UserId ?? string.Empty,
                            FullName = p.CustName ?? "Customer",
                            Email = p.EmailId ?? string.Empty
                        },
                        Book = p.Book != null ? new
                        {
                            p.Book.Id,
                            p.Book.ItemNo,
                            p.Book.ISBN,
                            p.Book.ItemName,
                            AuthorName = p.Book.AuthorMaster != null ? p.Book.AuthorMaster.AuthorName : "B. Jain Author",
                            p.Book.Price
                        } : null
                    })
                    .ToListAsync();

                return Ok(purchases);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error fetching purchases.", detail = ex.InnerException?.Message ?? ex.Message });
            }
        }

        [HttpGet("dashboard-summary")]
        public async Task<IActionResult> GetDashboardSummary()
        {
            try
            {
                var totalUsers = await _dbContext.Users.AsNoTracking().CountAsync();
                var totalBooks = await _dbContext.Books.AsNoTracking().CountAsync();
                var totalPurchases = await _dbContext.Customers.AsNoTracking().CountAsync(p => p.AmountPaid > 0);
                var totalRevenue = await _dbContext.Customers.AsNoTracking().SumAsync(p => (decimal?)p.AmountPaid) ?? 0m;

                return Ok(new
                {
                    totalUsers,
                    totalBooks,
                    totalPurchases,
                    totalRevenue
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error fetching dashboard summary.", detail = ex.InnerException?.Message ?? ex.Message });
            }
        }

        [HttpGet("customers-list")]
        public async Task<IActionResult> GetCustomersList()
        {
            try
            {
                var allCustomers = await _dbContext.Customers
                    .AsNoTracking()
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
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error fetching customers list.", detail = ex.InnerException?.Message ?? ex.Message });
            }
        }

        [HttpDelete("delete-customer/{id}")]
        [HttpPost("delete-customer/{id}")]
        public async Task<IActionResult> DeleteCustomer(Guid id)
        {
            try
            {
                var customer = await _dbContext.Customers.FindAsync(id);
                if (customer == null) return NotFound(new { success = false, message = "Customer not found." });

                _dbContext.Customers.Remove(customer);
                await _dbContext.SaveChangesAsync();

                return Ok(new { success = true, message = "Customer deleted successfully." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error deleting customer.", detail = ex.InnerException?.Message ?? ex.Message });
            }
        }

        [HttpGet("customer-full-profile/{id}")]
        public async Task<IActionResult> GetCustomerFullProfile(Guid id)
        {
            try
            {
                var customer = await _dbContext.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id);
                if (customer == null)
                    return NotFound(new { success = false, message = "Customer record not found." });

                string userId = customer.UserId ?? string.Empty;

                var rawSubs = await _dbContext.UserSubscriptions
                    .AsNoTracking()
                    .Include(s => s.Plan)
                    .Where(s => s.UserId == userId)
                    .OrderByDescending(s => s.StartDate)
                    .ToListAsync();

                var royaltyBookIds = (await _dbContext.VendorRoyaltyRules
                    .AsNoTracking()
                    .Where(r => r.IsRoyaltyApplicable && r.LiveStatus == "Live")
                    .Select(r => r.BookId)
                    .ToListAsync()).ToHashSet();

                var allPublishedBooks = await _dbContext.Books
                    .AsNoTracking()
                    .Include(b => b.AuthorMaster)
                    .Where(b => b.IsPublished)
                    .OrderByDescending(b => b.CreatedAt)
                    .ToListAsync();

                var basicBooks = allPublishedBooks.Where(b => !royaltyBookIds.Contains(b.Id)).ToList();
                var royaltyBooks = allPublishedBooks.Where(b => royaltyBookIds.Contains(b.Id)).ToList();

                var plansList = new List<object>();
                foreach (var s in rawSubs)
                {
                    var planBooks = new List<object>();
                    if (s.Plan != null)
                    {
                        var selectedBooks = new List<Book>();
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

                var bundlePurchases = await _dbContext.Customers
                    .AsNoTracking()
                    .Where(c => c.UserId == userId && c.PlanType != null && c.PlanType.StartsWith("Bundle:"))
                    .OrderByDescending(c => c.PurchasedAt)
                    .ToListAsync();

                var bundleNames = bundlePurchases
                    .Select(bp => bp.PlanType!.Replace("Bundle:", "").Trim())
                    .Distinct()
                    .ToList();

                var matchedBundles = await _dbContext.Bundles
                    .AsNoTracking()
                    .Where(b => bundleNames.Contains(b.BundleName))
                    .ToListAsync();

                var matchedBundleIds = matchedBundles.Select(b => b.Id).ToList();
                var allBundleItems = await _dbContext.BundleItems
                    .AsNoTracking()
                    .Include(bi => bi.Book)
                    .ThenInclude(bk => bk!.AuthorMaster)
                    .Where(bi => matchedBundleIds.Contains(bi.BundleId) && bi.Book != null)
                    .ToListAsync();

                var bundlesList = bundlePurchases.Select(bp =>
                {
                    string bName = bp.PlanType!.Replace("Bundle:", "").Trim();
                    var mBundle = matchedBundles.FirstOrDefault(b => b.BundleName == bName);
                    var bBooks = mBundle == null
                        ? new List<object>()
                        : allBundleItems
                            .Where(bi => bi.BundleId == mBundle.Id)
                            .Select(bi => (object)new
                            {
                                bookId = bi.BookId,
                                itemName = bi.Book!.ItemName,
                                authorName = bi.Book.AuthorMaster != null ? bi.Book.AuthorMaster.AuthorName : "B. Jain Author",
                                coverImage = bi.Book.CoverImagePath ?? "/images/default-cover.png"
                            })
                            .ToList();

                    return (object)new
                    {
                        bundleName = bName,
                        purchasedDate = bp.PurchasedAt,
                        amountPaid = bp.AmountPaid,
                        books = bBooks
                    };
                }).ToList();

                var libraryList = await _dbContext.UserReadingProgress
                    .AsNoTracking()
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
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error fetching customer profile.", detail = ex.InnerException?.Message ?? ex.Message });
            }
        }
    }
}