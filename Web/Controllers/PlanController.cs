using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Application.DTOs;
using Application.Interfaces;
using BookPublishingSystem.Application.DTOs;
using BookPublishingSystem.Domain.Entities;
using Domain.Entities;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Web.Controllers
{
    [ApiController]
    [Route("api/plan")]
    public class PlanController : ControllerBase
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly IRoyaltyDistributionService _royaltyService;

        public PlanController(ApplicationDbContext dbContext, IRoyaltyDistributionService royaltyService)
        {
            _dbContext = dbContext;
            _royaltyService = royaltyService;
        }

        private async Task EnsurePlanSnapshotTableAsync()
        {
            const string sql = @"
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PurchasedPlanSnapshots')
                BEGIN
                    CREATE TABLE PurchasedPlanSnapshots (
                        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
                        TransactionId NVARCHAR(150) NOT NULL,
                        UserId NVARCHAR(450) NOT NULL,
                        PlanName NVARCHAR(250) NOT NULL,
                        BookId UNIQUEIDENTIFIER NOT NULL,
                        IsRoyaltyBook BIT NOT NULL DEFAULT 0,
                        LockedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                    );
                    CREATE INDEX IX_PurchasedPlanSnapshots_TxnId ON PurchasedPlanSnapshots(TransactionId);
                END";
            await _dbContext.Database.ExecuteSqlRawAsync(sql);
        }

        // GET: api/plan/get-all
        [HttpGet("get-all")]
        public async Task<IActionResult> GetAllPlans()
        {
            try
            {
                var plans = await _dbContext.Plans
                    .Include(p => p.Features)
                    .OrderBy(p => p.PriceIncludingTax)
                    .ToListAsync();

                return Ok(plans);
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = "Error fetching plans: " + ex.Message });
            }
        }

        // POST: api/plan/save
        [HttpPost("save")]
        public async Task<IActionResult> SavePlan([FromBody] CreatePlanDto dto)
        {
            if (dto == null)
                return BadRequest(new { success = false, message = "Invalid plan payload." });

            if (!ModelState.IsValid)
            {
                var errors = string.Join("; ", ModelState.Values
                    .SelectMany(v => v.Errors)
                    .Select(e => e.ErrorMessage));
                return BadRequest(new { success = false, message = "Validation Error: " + errors });
            }

            try
            {
                bool isNewPlan = false;
                Plan? plan = null;

                if (dto.Id.HasValue && dto.Id.Value != Guid.Empty)
                {
                    plan = await _dbContext.Plans
                        .FirstOrDefaultAsync(p => p.Id == dto.Id.Value);
                }

                if (plan == null)
                {
                    isNewPlan = true;
                    plan = new Plan
                    {
                        Id = Guid.NewGuid(),
                        Features = new List<PlanFeature>()
                    };
                    _dbContext.Plans.Add(plan);
                }
                else
                {
                    var oldFeatures = await _dbContext.PlanFeatures
                        .Where(f => f.PlanId == plan.Id)
                        .ToListAsync();

                    if (oldFeatures.Any())
                    {
                        _dbContext.PlanFeatures.RemoveRange(oldFeatures);
                    }
                }

                int validityDays = dto.ValidityInDays;
                if (dto.BillingPeriod == "Monthly") validityDays = 30;
                else if (dto.BillingPeriod == "Yearly") validityDays = 365;
                else if (dto.BillingPeriod == "2 Years") validityDays = 730;
                else if (dto.BillingPeriod == "3 Years") validityDays = 1095;
                else if (dto.BillingPeriod == "5 Years") validityDays = 1825;

                plan.PlanName = dto.PlanName.Trim();
                plan.Description = dto.Description;
                plan.PriceIncludingTax = dto.PriceIncludingTax;
                plan.TaxPercentage = dto.TaxPercentage;
                plan.BillingPeriod = string.IsNullOrWhiteSpace(dto.BillingPeriod) ? "Monthly" : dto.BillingPeriod;
                plan.ValidityInDays = validityDays > 0 ? validityDays : 30;
                plan.TargetUser = dto.TargetUser;
                plan.BasicBookLimit = dto.BasicBookLimit;
                plan.RoyaltyBookLimit = dto.RoyaltyBookLimit;
                plan.MaxBookLimit = dto.BasicBookLimit + dto.RoyaltyBookLimit;
                plan.IsActive = dto.IsActive;

                if (dto.Features != null && dto.Features.Any())
                {
                    foreach (var f in dto.Features)
                    {
                        if (string.IsNullOrWhiteSpace(f.FeatureName)) continue;

                        _dbContext.PlanFeatures.Add(new PlanFeature
                        {
                            Id = Guid.NewGuid(),
                            PlanId = plan.Id,
                            FeatureName = f.FeatureName.Trim(),
                            Limitation = string.IsNullOrWhiteSpace(f.Limitation) ? "Included" : f.Limitation.Trim(),
                            IsEnabled = f.IsEnabled
                        });
                    }
                }

                await _dbContext.SaveChangesAsync();
                return Ok(new
                {
                    success = true,
                    message = isNewPlan ? "Subscription Plan Created Successfully!" : "Subscription Plan Updated Successfully!",
                    planId = plan.Id
                });
            }
            catch (Exception ex)
            {
                string detailedError = ex.InnerException != null
                    ? (ex.InnerException.InnerException != null ? ex.InnerException.InnerException.Message : ex.InnerException.Message)
                    : ex.Message;

                return BadRequest(new { success = false, message = "Save Error: " + detailedError });
            }
        }

        // DELETE: api/plan/delete/{id}
        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> DeletePlan(Guid id)
        {
            try
            {
                var plan = await _dbContext.Plans.FindAsync(id);
                if (plan == null) return NotFound(new { success = false, message = "Plan not found." });

                _dbContext.Plans.Remove(plan);
                await _dbContext.SaveChangesAsync();

                return Ok(new { success = true, message = "Plan deleted successfully." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = "Delete Error: " + ex.Message });
            }
        }

        // POST: api/plan/subscribe-direct
        [HttpPost("subscribe-direct")]
        public async Task<IActionResult> SubscribePlanDirect([FromBody] DirectPlanPurchaseDto dto)
        {
            try
            {
                if (dto == null || dto.PlanId == Guid.Empty)
                    return BadRequest(new { success = false, message = "Valid PlanId is required." });

                var plan = await _dbContext.Plans
                    .FirstOrDefaultAsync(p => p.Id == dto.PlanId && p.IsActive);

                if (plan == null)
                    return NotFound(new { success = false, message = "Subscription Plan not found or inactive." });

                var royaltyBookIds = await _dbContext.VendorRoyaltyRules
                    .Where(r => r.IsRoyaltyApplicable && (r.LiveStatus == null || r.LiveStatus == "" || r.LiveStatus == "Live" || r.LiveStatus == "Active"))
                    .Select(r => r.BookId)
                    .Distinct()
                    .ToListAsync();

                var royaltySet = new HashSet<Guid>(royaltyBookIds);
                var snapshotItems = new List<(Guid BookId, bool IsRoyalty)>();

                if (dto.SelectedBookIds != null && dto.SelectedBookIds.Any())
                {
                    foreach (var bId in dto.SelectedBookIds.Distinct())
                    {
                        snapshotItems.Add((bId, royaltySet.Contains(bId)));
                    }
                }
                else
                {
                    if (plan.RoyaltyBookLimit != 0 && royaltyBookIds.Any())
                    {
                        var pickedRoyalty = plan.RoyaltyBookLimit < 0
                            ? royaltyBookIds
                            : royaltyBookIds.Take(plan.RoyaltyBookLimit).ToList();

                        foreach (var bId in pickedRoyalty)
                            snapshotItems.Add((bId, true));
                    }

                    if (plan.BasicBookLimit != 0)
                    {
                        var basicQuery = _dbContext.Books
                            .Where(b => b.IsPublished && !royaltyBookIds.Contains(b.Id))
                            .Select(b => b.Id);

                        var pickedBasic = plan.BasicBookLimit < 0
                            ? await basicQuery.ToListAsync()
                            : await basicQuery.Take(plan.BasicBookLimit).ToListAsync();

                        foreach (var bId in pickedBasic)
                            snapshotItems.Add((bId, false));
                    }
                }

                var includedBookIds = snapshotItems.Select(x => x.BookId).Distinct().ToList();

                string orderRef = $"PLAN-ORD-{DateTime.UtcNow:yyyyMMddHHmmss}";
                decimal totalPaid = plan.PriceIncludingTax;

                decimal basePrice = plan.TaxPercentage > 0
                    ? Math.Round(totalPaid / (1 + (plan.TaxPercentage / 100m)), 2)
                    : totalPaid;
                decimal taxAmount = Math.Max(0, totalPaid - basePrice);

                if (includedBookIds.Any() && totalPaid > 0)
                {
                    await _royaltyService.DistributeOrderRoyaltyAsync(
                        orderRef,
                        "Plan",
                        totalPaid,
                        includedBookIds
                    );
                }

                var vendorCredits = await _dbContext.VendorRoyaltyTransactions
                    .Where(t => t.OrderReferenceId == orderRef)
                    .ToListAsync();

                decimal totalVendorShare = vendorCredits.Sum(t => t.EarnedRoyaltyAmount);
                decimal platformShare = totalPaid - totalVendorShare;

                string targetEmail = !string.IsNullOrWhiteSpace(dto.UserEmail)
                    ? dto.UserEmail.Trim()
                    : (User?.Identity?.Name ?? "");

                if (!string.IsNullOrWhiteSpace(targetEmail))
                {
                    var appUser = await _dbContext.Users.FirstOrDefaultAsync(u =>
                        u.Email == targetEmail || u.UserName == targetEmail);

                    if (appUser != null)
                    {
                        DateTime nowUtc = DateTime.UtcNow;
                        int validityDays = plan.ValidityInDays > 0 ? plan.ValidityInDays : 30;
                        DateTime expiryUtc = nowUtc.AddDays(validityDays);

                        var newSub = new UserSubscription
                        {
                            Id = Guid.NewGuid(),
                            UserId = appUser.Id,
                            PlanId = plan.Id,
                            AmountPaid = totalPaid,
                            TaxAmount = taxAmount,
                            StartDate = nowUtc,
                            ExpiryDate = expiryUtc,
                            Status = "Active",
                            TransactionId = orderRef,
                            CreatedAt = nowUtc
                        };
                        _dbContext.UserSubscriptions.Add(newSub);

                        var customer = await _dbContext.Customers.FirstOrDefaultAsync(c =>
                            c.UserId == appUser.Id || c.EmailId == targetEmail);

                        if (customer == null)
                        {
                            var defaultBook = await _dbContext.Books.FirstOrDefaultAsync();
                            customer = new Customer
                            {
                                Id = Guid.NewGuid(),
                                CustId = "CUST-" + nowUtc.Ticks.ToString().Substring(10),
                                CustName = !string.IsNullOrWhiteSpace(appUser.FullName) ? appUser.FullName : targetEmail.Split('@')[0],
                                MobileNo = "N/A",
                                EmailId = appUser.Email ?? targetEmail,
                                Address1 = "Pending Profile Update",
                                Country = "India",
                                State = "N/A",
                                PostalCode = "000000",
                                UserId = appUser.Id,
                                BookId = includedBookIds.FirstOrDefault() != Guid.Empty
                                    ? includedBookIds.First()
                                    : (defaultBook?.Id ?? Guid.Empty),
                                PlanType = plan.PlanName,
                                AmountPaid = totalPaid,
                                TransactionId = orderRef,
                                PurchasedAt = nowUtc,
                                CreatedAt = nowUtc
                            };
                            _dbContext.Customers.Add(customer);
                        }
                        else
                        {
                            customer.UserId = appUser.Id;
                            customer.PlanType = plan.PlanName;
                            customer.AmountPaid = totalPaid;
                            customer.TransactionId = orderRef;
                            customer.PurchasedAt = nowUtc;
                        }

                        await _dbContext.SaveChangesAsync();

                        await EnsurePlanSnapshotTableAsync();
                        foreach (var item in snapshotItems.Distinct())
                        {
                            await _dbContext.Database.ExecuteSqlRawAsync(
                                "INSERT INTO PurchasedPlanSnapshots (Id, TransactionId, UserId, PlanName, BookId, IsRoyaltyBook, LockedAt) VALUES ({0}, {1}, {2}, {3}, {4}, {5}, {6})",
                                Guid.NewGuid(), orderRef, appUser.Id, plan.PlanName, item.BookId, item.IsRoyalty, nowUtc);
                        }
                    }
                }

                return Ok(new
                {
                    success = true,
                    message = $"'{plan.PlanName}' Activated! Platform Share: ₹{platformShare:0.00} | Vendors Royalty: ₹{totalVendorShare:0.00}",
                    orderReferenceId = orderRef,
                    planName = plan.PlanName,
                    totalPaid = totalPaid,
                    platformShare70Percent = platformShare,
                    vendorRoyalty30Percent = totalVendorShare,
                    creditedVendorsCount = vendorCredits.Count
                });
            }
            catch (Exception ex)
            {
                string detailedError = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return BadRequest(new { success = false, message = "Subscription Error: " + detailedError });
            }
        }

        // GET: api/plan/my-subscription-status
        [HttpGet("my-subscription-status")]
        public async Task<IActionResult> GetMySubscriptionStatus()
        {
            var email = User?.Identity?.Name;
            if (string.IsNullOrEmpty(email))
                return Ok(new { hasActivePlan = false, hasProfile = false });

            var appUser = await _dbContext.Users.FirstOrDefaultAsync(u => u.Email == email || u.UserName == email);
            if (appUser == null)
                return Ok(new { hasActivePlan = false, hasProfile = false });

            var activeSub = await _dbContext.UserSubscriptions
                .Where(s => s.UserId == appUser.Id && s.Status == "Active" && s.ExpiryDate >= DateTime.UtcNow)
                .OrderByDescending(s => s.CreatedAt)
                .FirstOrDefaultAsync();

            var customer = await _dbContext.Customers.FirstOrDefaultAsync(c =>
                c.UserId == appUser.Id || c.EmailId == email);

            bool hasActivePlan = activeSub != null || (customer != null
                && !string.IsNullOrWhiteSpace(customer.PlanType)
                && customer.PlanType != "ProfileOnly"
                && customer.AmountPaid > 0);

            bool hasProfile = customer != null
                && !string.IsNullOrWhiteSpace(customer.MobileNo)
                && customer.MobileNo != "N/A"
                && !string.IsNullOrWhiteSpace(customer.Address1)
                && customer.Address1 != "Pending Profile Update";

            string activePlanName = "";
            if (activeSub != null)
            {
                var p = await _dbContext.Plans.FindAsync(activeSub.PlanId);
                activePlanName = p?.PlanName ?? customer?.PlanType ?? "Active Plan";
            }
            else
            {
                activePlanName = customer?.PlanType ?? "";
            }

            return Ok(new
            {
                hasActivePlan,
                hasProfile,
                planName = activePlanName,
                profile = customer
            });
        }

        // GET: api/plan/my-profile-membership
        [HttpGet("my-profile-membership")]
        public async Task<IActionResult> GetMyProfileMembership([FromQuery] string? userId = null)
        {
            try
            {
                ApplicationUser? appUser = null;
                if (!string.IsNullOrWhiteSpace(userId) && User.IsInRole("Admin"))
                {
                    appUser = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId);
                }
                else
                {
                    var identityEmail = User?.Identity?.Name;
                    if (string.IsNullOrEmpty(identityEmail))
                        return Ok(new { plans = new List<object>(), bundles = new List<object>() });

                    appUser = await _dbContext.Users.FirstOrDefaultAsync(u => u.Email == identityEmail || u.UserName == identityEmail);
                }

                if (appUser == null)
                    return Ok(new { plans = new List<object>(), bundles = new List<object>() });

                await EnsurePlanSnapshotTableAsync();
                string email = appUser.Email ?? appUser.UserName ?? "";

                object MapBookSafe(Book b, bool isRoyalty = false)
                {
                    var t = b.GetType();
                    string title = (t.GetProperty("ItemName")?.GetValue(b)
                                 ?? t.GetProperty("Title")?.GetValue(b)
                                 ?? t.GetProperty("Name")?.GetValue(b))?.ToString() ?? "Book";

                    var authorVal = t.GetProperty("AuthorName")?.GetValue(b);
                    if (authorVal == null || string.IsNullOrWhiteSpace(authorVal.ToString()))
                    {
                        var authorNav = t.GetProperty("Author")?.GetValue(b);
                        if (authorNav != null)
                        {
                            authorVal = authorNav.GetType().GetProperty("Name")?.GetValue(authorNav)
                                     ?? authorNav.GetType().GetProperty("FullName")?.GetValue(authorNav)
                                     ?? authorNav.GetType().GetProperty("AuthorName")?.GetValue(authorNav);
                        }
                    }
                    string author = !string.IsNullOrWhiteSpace(authorVal?.ToString()) ? authorVal.ToString()! : "B. Jain Author";

                    string cover = (t.GetProperty("CoverImage")?.GetValue(b)
                                 ?? t.GetProperty("CoverImagePath")?.GetValue(b)
                                 ?? t.GetProperty("ImagePath")?.GetValue(b)
                                 ?? t.GetProperty("Thumbnail")?.GetValue(b))?.ToString() ?? "/images/default-cover.png";

                    string category = (t.GetProperty("CategoryCode")?.GetValue(b)
                                    ?? t.GetProperty("Category")?.GetValue(b))?.ToString() ?? "HOMEO";

                    int pages = 0;
                    var pagesObj = t.GetProperty("TotalPages")?.GetValue(b)
                                ?? t.GetProperty("Pages")?.GetValue(b)
                                ?? t.GetProperty("PageCount")?.GetValue(b);
                    if (pagesObj != null) int.TryParse(pagesObj.ToString(), out pages);

                    return new
                    {
                        id = b.Id,
                        itemName = title,
                        authorName = author,
                        coverImage = cover,
                        categoryCode = category,
                        pages = pages,
                        isRoyalty = isRoyalty
                    };
                }

                var allPlans = await _dbContext.Plans.ToListAsync();
                var allBundles = await _dbContext.Bundles
                    .Include(b => b.BundleItems)
                    .ThenInclude(bi => bi.Book)
                    .ToListAsync();

                var royaltyBookIdList = await _dbContext.VendorRoyaltyRules
                    .Where(r => r.IsRoyaltyApplicable && (r.LiveStatus == null || r.LiveStatus == "" || r.LiveStatus == "Live" || r.LiveStatus == "Active"))
                    .Select(r => r.BookId.ToString())
                    .Distinct()
                    .ToListAsync();

                var royaltyBookIds = new HashSet<string>(royaltyBookIdList, StringComparer.OrdinalIgnoreCase);

                var rawBooks = await _dbContext.Books
                    .Include(b => b.Author)
                    .Where(b => b.IsPublished)
                    .ToListAsync();

                var booksByIdMap = rawBooks.ToDictionary(b => b.Id);

                var allPublishedBooks = rawBooks
                    .Select(b =>
                    {
                        var bType = b.GetType();
                        bool bookFlagRoyalty = false;
                        var isRoyProp = bType.GetProperty("IsRoyalty")?.GetValue(b) ?? bType.GetProperty("IsRoyaltyBook")?.GetValue(b);
                        if (isRoyProp is bool bBool && bBool) bookFlagRoyalty = true;

                        var vendorProp = bType.GetProperty("VendorId")?.GetValue(b);
                        if (vendorProp != null && vendorProp.ToString() != Guid.Empty.ToString()) bookFlagRoyalty = true;

                        bool isRoy = royaltyBookIds.Contains(b.Id.ToString()) || bookFlagRoyalty;
                        return new
                        {
                            BookEntity = b,
                            IsRoyalty = isRoy,
                            Mapped = MapBookSafe(b, isRoy)
                        };
                    })
                    .ToList();
                async Task<List<object>> ResolvePlanBooksWithSnapshotAsync(string txnId, string planName, Plan? matchedPlan)
                {
                    var lockedBookIds = await _dbContext.Database
                        .SqlQueryRaw<Guid>("SELECT BookId AS Value FROM PurchasedPlanSnapshots WHERE TransactionId = {0}", txnId)
                        .ToListAsync();

                    if (lockedBookIds.Any())
                    {
                        return lockedBookIds
                            .Where(id => booksByIdMap.ContainsKey(id))
                            .Select(id =>
                            {
                                var bk = booksByIdMap[id];
                                bool isRoy = royaltyBookIds.Contains(bk.Id.ToString());
                                return MapBookSafe(bk, isRoy);
                            })
                            .ToList();
                    }
                    var result = new List<object>();
                    var toFreeze = new List<(Guid BookId, bool IsRoyalty)>();

                    if (matchedPlan != null)
                    {
                        if (matchedPlan.RoyaltyBookLimit != 0)
                        {
                            var rItems = allPublishedBooks.Where(x => x.IsRoyalty).ToList();
                            var pickedR = matchedPlan.RoyaltyBookLimit < 0 ? rItems : rItems.Take(matchedPlan.RoyaltyBookLimit).ToList();
                            result.AddRange(pickedR.Select(x => x.Mapped));
                            toFreeze.AddRange(pickedR.Select(x => (x.BookEntity.Id, true)));
                        }

                        if (matchedPlan.BasicBookLimit != 0)
                        {
                            var bItems = allPublishedBooks.Where(x => !x.IsRoyalty).ToList();
                            var pickedB = matchedPlan.BasicBookLimit < 0 ? bItems : bItems.Take(matchedPlan.BasicBookLimit).ToList();
                            result.AddRange(pickedB.Select(x => x.Mapped));
                            toFreeze.AddRange(pickedB.Select(x => (x.BookEntity.Id, false)));
                        }
                    }

                    if (!string.IsNullOrWhiteSpace(txnId) && toFreeze.Any())
                    {
                        DateTime nowUtc = DateTime.UtcNow;
                        foreach (var item in toFreeze.Distinct())
                        {
                            await _dbContext.Database.ExecuteSqlRawAsync(
                                "INSERT INTO PurchasedPlanSnapshots (Id, TransactionId, UserId, PlanName, BookId, IsRoyaltyBook, LockedAt) VALUES ({0}, {1}, {2}, {3}, {4}, {5}, {6})",
                                Guid.NewGuid(), txnId, appUser.Id, planName, item.BookId, item.IsRoyalty, nowUtc);
                        }
                    }

                    return result;
                }

                var activePlansList = new List<object>();
                var purchasedBundlesList = new List<object>();
                var addedTxnIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                var userSubs = await _dbContext.UserSubscriptions
                    .Where(s => s.UserId == appUser.Id)
                    .OrderByDescending(s => s.CreatedAt)
                    .ToListAsync();

                foreach (var sub in userSubs)
                {
                    var matchedPlan = allPlans.FirstOrDefault(p => p.Id == sub.PlanId);
                    string pName = matchedPlan?.PlanName ?? "Subscription Plan";
                    string txnId = !string.IsNullOrWhiteSpace(sub.TransactionId)
                        ? sub.TransactionId
                        : $"SUB-{sub.Id.ToString("N").Substring(0, 8).ToUpper()}";

                    int validityDays = matchedPlan?.ValidityInDays ?? Math.Max(1, (int)(sub.ExpiryDate - sub.StartDate).TotalDays);
                    int remainingDays = Math.Max(0, (int)Math.Ceiling((sub.ExpiryDate - DateTime.UtcNow).TotalDays));
                    bool isCurrentlyActive = (sub.Status == "Active") && (DateTime.UtcNow <= sub.ExpiryDate);

                    addedTxnIds.Add(txnId);

                    var planBooks = await ResolvePlanBooksWithSnapshotAsync(txnId, pName, matchedPlan);

                    activePlansList.Add(new
                    {
                        planName = pName,
                        billingPeriod = matchedPlan?.BillingPeriod ?? $"{validityDays} Days",
                        validityDays = validityDays,
                        startDate = sub.StartDate,
                        endDate = sub.ExpiryDate,
                        remainingDays = remainingDays,
                        isActive = isCurrentlyActive,
                        amountPaid = sub.AmountPaid,
                        transactionId = txnId,
                        books = planBooks
                    });
                }
                var customerRecords = await _dbContext.Customers
                    .Where(c => c.UserId == appUser.Id || (!string.IsNullOrEmpty(email) && c.EmailId.ToLower() == email.ToLower()))
                    .OrderByDescending(c => c.PurchasedAt)
                    .ToListAsync();

                foreach (var rec in customerRecords)
                {
                    if (string.IsNullOrWhiteSpace(rec.PlanType) || rec.PlanType == "ProfileOnly")
                        continue;

                    if (!string.IsNullOrWhiteSpace(rec.TransactionId) && addedTxnIds.Contains(rec.TransactionId))
                        continue;

                    var matchedBundle = allBundles.FirstOrDefault(b =>
                    {
                        var bNameObj = b.GetType().GetProperty("BundleName")?.GetValue(b)
                                    ?? b.GetType().GetProperty("Name")?.GetValue(b)
                                    ?? b.GetType().GetProperty("Title")?.GetValue(b);
                        string bName = bNameObj?.ToString() ?? "";

                        return !string.IsNullOrWhiteSpace(bName) &&
                               (rec.PlanType.Equals(bName, StringComparison.OrdinalIgnoreCase) ||
                                rec.PlanType.Contains(bName, StringComparison.OrdinalIgnoreCase));
                    });

                    if (matchedBundle != null)
                    {
                        string resolvedBundleName = (matchedBundle.GetType().GetProperty("BundleName")?.GetValue(matchedBundle)
                                                  ?? matchedBundle.GetType().GetProperty("Name")?.GetValue(matchedBundle)
                                                  ?? matchedBundle.GetType().GetProperty("Title")?.GetValue(matchedBundle))?.ToString()
                                                  ?? rec.PlanType.Split('|')[0].Replace("Bundle:", "").Trim();

                   
                        List<object> bundleBooks;
                        var lockedBundleIds = new List<Guid>();
                        try
                        {
                            lockedBundleIds = await _dbContext.Database
                                .SqlQueryRaw<Guid>("SELECT BookId AS Value FROM PurchasedBundleSnapshots WHERE TransactionId = {0}", rec.TransactionId)
                                .ToListAsync();
                        }
                        catch { /* Ignore if table not yet initialized */ }

                        if (lockedBundleIds.Any())
                        {
                            bundleBooks = lockedBundleIds
                                .Where(id => booksByIdMap.ContainsKey(id))
                                .Select(id => MapBookSafe(booksByIdMap[id], royaltyBookIds.Contains(id.ToString())))
                                .ToList();
                        }
                        else
                        {
                            bundleBooks = matchedBundle.BundleItems
                                .Where(bi => bi.Book != null)
                                .Select(bi => MapBookSafe(bi.Book!, royaltyBookIds.Contains(bi.Book!.Id.ToString())))
                                .ToList();
                        }

                        purchasedBundlesList.Add(new
                        {
                            bundleId = matchedBundle.Id,
                            bundleName = resolvedBundleName,
                            purchasedDate = rec.PurchasedAt != default ? rec.PurchasedAt : rec.CreatedAt,
                            amountPaid = rec.AmountPaid,
                            transactionId = rec.TransactionId,
                            books = bundleBooks
                        });
                        continue;
                    }
                    if (userSubs.Any()) continue;

                    var matchedPlan = allPlans.FirstOrDefault(p =>
                        p.PlanName.Equals(rec.PlanType, StringComparison.OrdinalIgnoreCase));

                    int validityDays = matchedPlan?.ValidityInDays ?? 30;
                    DateTime startDate = rec.PurchasedAt != default ? rec.PurchasedAt : rec.CreatedAt;
                    if (startDate == default) startDate = DateTime.UtcNow;
                    DateTime endDate = startDate.AddDays(validityDays);
                    string legacyTxn = !string.IsNullOrWhiteSpace(rec.TransactionId) ? rec.TransactionId : $"LEG-{rec.Id:N}";

                    var legacyPlanBooks = await ResolvePlanBooksWithSnapshotAsync(legacyTxn, rec.PlanType, matchedPlan);

                    activePlansList.Add(new
                    {
                        planName = rec.PlanType,
                        billingPeriod = matchedPlan?.BillingPeriod ?? $"{validityDays} Days",
                        validityDays = validityDays,
                        startDate = startDate,
                        endDate = endDate,
                        remainingDays = Math.Max(0, (int)Math.Ceiling((endDate - DateTime.UtcNow).TotalDays)),
                        isActive = DateTime.UtcNow <= endDate,
                        amountPaid = rec.AmountPaid,
                        transactionId = legacyTxn,
                        books = legacyPlanBooks
                    });
                }

                return Ok(new
                {
                    plans = activePlansList,
                    bundles = purchasedBundlesList
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }
    }
}