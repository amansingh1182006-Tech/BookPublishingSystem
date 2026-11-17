using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using Application.DTOs;
using Application.Interfaces;
using BookPublishingSystem.Domain.Entities;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Web.Controllers
{
    [Route("api/single-book")]
    [ApiController]
    public class SingleBookPurchaseController : ControllerBase
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IRoyaltyDistributionService _royaltyService;

        public SingleBookPurchaseController(
            ApplicationDbContext dbContext,
            UserManager<ApplicationUser> userManager,
            IRoyaltyDistributionService royaltyService)
        {
            _dbContext = dbContext;
            _userManager = userManager;
            _royaltyService = royaltyService;
        }

        // Auto-create PurchasedBundleSnapshots table from code if not already created
        private async Task EnsureSnapshotTableAsync()
        {
            const string sql = @"
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PurchasedBundleSnapshots')
                BEGIN
                    CREATE TABLE PurchasedBundleSnapshots (
                        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
                        TransactionId NVARCHAR(150) NOT NULL,
                        UserId NVARCHAR(450) NOT NULL,
                        BundleName NVARCHAR(250) NOT NULL,
                        BookId UNIQUEIDENTIFIER NOT NULL,
                        LockedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                    );
                    CREATE INDEX IX_PurchasedBundleSnapshots_TxnId ON PurchasedBundleSnapshots(TransactionId);
                END";
            await _dbContext.Database.ExecuteSqlRawAsync(sql);
            const string metaSql = @"
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PurchasedBookMetadataSnapshots')
                BEGIN
                    CREATE TABLE PurchasedBookMetadataSnapshots (
                        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
                        TransactionId NVARCHAR(150) NOT NULL,
                        BookId UNIQUEIDENTIFIER NOT NULL,
                        ItemName NVARCHAR(300) NOT NULL,
                        AuthorName NVARCHAR(200) NOT NULL,
                        CoverImage NVARCHAR(500) NOT NULL,
                        CategoryCode NVARCHAR(100) NOT NULL,
                        NoOfPages INT NOT NULL DEFAULT 0,
                        PriceAtPurchase DECIMAL(18,2) NOT NULL DEFAULT 0,
                        LockedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                    );
                END";
            await _dbContext.Database.ExecuteSqlRawAsync(metaSql);
        }

        private static DateTime? ParseSingleBookExpiry(string? planType, DateTime purchasedAt)
        {
            if (string.IsNullOrWhiteSpace(planType)) return null;
            if (planType.Contains("|ValidTill:"))
            {
                var parts = planType.Split("|ValidTill:");
                if (parts.Length == 2 && DateTime.TryParse(parts[1], null, DateTimeStyles.RoundtripKind, out var parsedDate))
                {
                    return parsedDate;
                }
            }
            return purchasedAt.AddDays(365);
        }

        [HttpGet("check-access/{bookId:guid}")]
        public async Task<IActionResult> CheckBookAccess(Guid bookId)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null)
                return Ok(new { hasAccess = false, isLoggedIn = false });

            var singlePurchases = await _dbContext.Customers
                .Where(c => c.UserId == user.Id &&
                            c.BookId == bookId &&
                            c.PlanType != null &&
                            c.PlanType.StartsWith("SingleBook") &&
                            c.TransactionId != "INIT-PROFILE")
                .OrderByDescending(c => c.PurchasedAt)
                .ToListAsync();

            foreach (var sp in singlePurchases)
            {
                var expiry = ParseSingleBookExpiry(sp.PlanType, sp.PurchasedAt);
                if (expiry == null || expiry >= DateTime.UtcNow)
                {
                    return Ok(new
                    {
                        hasAccess = true,
                        isLoggedIn = true,
                        accessType = "SingleBook",
                        validTill = expiry
                    });
                }
            }

            bool hasActivePlan = await _dbContext.UserSubscriptions.AnyAsync(s =>
                s.UserId == user.Id &&
                s.Status == "Active" &&
                s.ExpiryDate >= DateTime.UtcNow);

            if (hasActivePlan)
                return Ok(new { hasAccess = true, isLoggedIn = true, accessType = "SubscriptionPlan" });

            await EnsureSnapshotTableAsync();

            var userBundleRecords = await _dbContext.Customers
                .Where(c => c.UserId == user.Id &&
                            c.PlanType != null &&
                            c.PlanType.StartsWith("Bundle:") &&
                            c.TransactionId != "INIT-PROFILE")
                .OrderByDescending(c => c.PurchasedAt)
                .ToListAsync();

            foreach (var br in userBundleRecords)
            {
                var expiry = ParseSingleBookExpiry(br.PlanType, br.PurchasedAt);
                if (expiry != null && expiry < DateTime.UtcNow)
                    continue; 

                string cleanBundleName = br.PlanType!.Split('|')[0].Replace("Bundle:", "").Trim();

                var lockedBooksForTxn = await _dbContext.Database
                    .SqlQueryRaw<Guid>("SELECT BookId AS Value FROM PurchasedBundleSnapshots WHERE TransactionId = {0}", br.TransactionId)
                    .ToListAsync();

                if (lockedBooksForTxn.Any())
                {
                    if (lockedBooksForTxn.Contains(bookId))
                    {
                        return Ok(new
                        {
                            hasAccess = true,
                            isLoggedIn = true,
                            accessType = "Bundle",
                            bundleName = cleanBundleName,
                            validTill = expiry
                        });
                    }
                    continue;
                }

                bool inBundle = await _dbContext.BundleItems
                    .Include(bi => bi.Bundle)
                    .AnyAsync(bi => bi.BookId == bookId &&
                                    bi.Bundle != null &&
                                    bi.Bundle.BundleName == cleanBundleName);

                if (inBundle)
                {
                    return Ok(new
                    {
                        hasAccess = true,
                        isLoggedIn = true,
                        accessType = "Bundle",
                        bundleName = cleanBundleName,
                        validTill = expiry
                    });
                }
            }

            return Ok(new { hasAccess = false, isLoggedIn = true });
        }

        [HttpGet("book-preview/{bookId:guid}")]
        public async Task<IActionResult> GetSingleBookPreviewDetails(Guid bookId)
        {
            var book = await _dbContext.Books
                .Include(b => b.AuthorMaster)
                .Include(b => b.LanguageMaster)
                .FirstOrDefaultAsync(b => b.Id == bookId);

            if (book == null)
                return NotFound(new { success = false, message = "Book not found." });

            var royaltyRule = await _dbContext.VendorRoyaltyRules
                .FirstOrDefaultAsync(r => r.BookId == book.Id && r.IsRoyaltyApplicable && r.LiveStatus == "Live");

            var matchingBundles = await _dbContext.BundleItems
                .Include(bi => bi.Bundle)
                    .ThenInclude(b => b!.BundleItems)
                        .ThenInclude(item => item.Book)
                            .ThenInclude(bk => bk!.AuthorMaster)
                .Where(bi => bi.BookId == book.Id && bi.Bundle != null && bi.Bundle.IsActive)
                .Select(bi => bi.Bundle!)
                .Distinct()
                .Select(bnd => new
                {
                    bundleId = bnd.Id,
                    bundleName = bnd.BundleName,
                    description = bnd.Description,
                    totalPrice = bnd.TotalPrice,
                    discountPercentage = bnd.DiscountPercentage,
                    bundlePrice = bnd.FinalPrice,
                    totalBooksCount = bnd.BundleItems.Count,
                    booksInBundle = bnd.BundleItems
                        .Where(item => item.Book != null)
                        .Select(item => new
                        {
                            bookId = item.Book!.Id,
                            itemName = item.Book.ItemName,
                            authorName = item.Book.AuthorMaster != null ? item.Book.AuthorMaster.AuthorName : "B. Jain Author",
                            price = item.Book.Price,
                            coverImage = item.Book.CoverImagePath ?? "/images/default-cover.png",
                            isCurrentBook = item.Book.Id == book.Id
                        })
                        .ToList()
                })
                .ToListAsync();

            var isbnProp = book.GetType().GetProperty("ISBN") ?? book.GetType().GetProperty("Isbn") ?? book.GetType().GetProperty("ISBNNumber");
            string isbnVal = isbnProp?.GetValue(book)?.ToString() ?? "";

            string langVal = book.LanguageMaster != null
                ? book.LanguageMaster.LanguageName
                : (book.GetType().GetProperty("Language")?.GetValue(book)?.ToString() ?? "English");

            return Ok(new
            {
                bookId = book.Id,
                isbn = isbnVal,
                itemNo = book.ItemNo,
                itemName = book.ItemName,
                authorName = book.AuthorMaster != null ? book.AuthorMaster.AuthorName : "B. Jain Author",
                categoryCode = book.CategoryCode,
                language = langVal,
                noOfPages = book.NoOfPages,
                price = book.Price,
                coverImage = book.CoverImagePath ?? "/images/default-cover.png",
                isRoyalty = royaltyRule != null,
                matchingBundles = matchingBundles
            });
        }

        [HttpPost("purchase")]
        [Authorize]
        public async Task<IActionResult> PurchaseSingleBook([FromBody] SingleBookPurchaseRequestDto dto)
        {
            if (dto == null || dto.BookId == Guid.Empty)
                return BadRequest(new { success = false, message = "Invalid Book ID." });

            var user = await _userManager.GetUserAsync(User);
            if (user == null)
                return Unauthorized(new { success = false, message = "Please sign in first." });

            var book = await _dbContext.Books.FirstOrDefaultAsync(b => b.Id == dto.BookId);
            if (book == null)
                return NotFound(new { success = false, message = "Book not found." });

            int validityDays = dto.ValidityDays > 0 ? dto.ValidityDays : 365;
            DateTime nowUtc = DateTime.UtcNow;
            DateTime validTillUtc = nowUtc.AddDays(validityDays);

            var existingPurchases = await _dbContext.Customers
                .Where(c => c.UserId == user.Id &&
                            c.BookId == book.Id &&
                            c.PlanType != null &&
                            c.PlanType.StartsWith("SingleBook") &&
                            c.TransactionId != "INIT-PROFILE")
                .ToListAsync();

            foreach (var ep in existingPurchases)
            {
                var exp = ParseSingleBookExpiry(ep.PlanType, ep.PurchasedAt);
                if (exp != null && exp >= nowUtc)
                {
                    return Ok(new
                    {
                        success = true,
                        message = $"Aapke paas yeh book pehle se {exp.Value:dd MMM yyyy} tak active hai!",
                        bookId = book.Id,
                        validTill = exp
                    });
                }
            }

            var existingProfile = await _dbContext.Customers.FirstOrDefaultAsync(c => c.UserId == user.Id);
            string txnId = $"SBK-{nowUtc:yyyyMMddHHmmss}-{new Random().Next(100, 999)}";
            decimal totalPaid = book.Price;

            decimal totalVendorShare = 0m;
            if (totalPaid > 0)
            {
                await _royaltyService.DistributeOrderRoyaltyAsync(
                    txnId,
                    "SingleBook",
                    totalPaid,
                    new List<Guid> { book.Id }
                );

                var vendorCredits = await _dbContext.VendorRoyaltyTransactions
                    .Where(t => t.OrderReferenceId == txnId)
                    .ToListAsync();

                totalVendorShare = vendorCredits.Sum(t => t.EarnedRoyaltyAmount);
            }

            decimal platformShare = totalPaid - totalVendorShare;

            var purchaseRecord = new Customer
            {
                Id = Guid.NewGuid(),
                CustId = existingProfile?.CustId ?? ("CUST-" + nowUtc.Ticks.ToString().Substring(10)),
                CustName = existingProfile?.CustName ?? user.FullName ?? user.Email ?? "Reader Customer",
                MobileNo = existingProfile?.MobileNo ?? "N/A",
                EmailId = user.Email ?? existingProfile?.EmailId ?? "reader@bjain.com",
                Address1 = existingProfile?.Address1 ?? "Single Book Purchase",
                Address2 = existingProfile?.Address2,
                Country = existingProfile?.Country ?? "India",
                State = existingProfile?.State ?? "N/A",
                PostalCode = existingProfile?.PostalCode ?? "000000",
                Landmark = existingProfile?.Landmark,
                UserId = user.Id,
                BookId = book.Id,
                PlanType = $"SingleBook|ValidTill:{validTillUtc:O}",
                AmountPaid = totalPaid,
                TransactionId = txnId,
                PurchasedAt = nowUtc,
                CreatedAt = nowUtc
            };

            _dbContext.Customers.Add(purchaseRecord);
            await _dbContext.SaveChangesAsync();
            await EnsureSnapshotTableAsync();
            var authorEntity = book.AuthorMasterId.HasValue
                ? await _dbContext.Authors.FindAsync(book.AuthorMasterId.Value)
                : null;

            await _dbContext.Database.ExecuteSqlRawAsync(
                @"INSERT INTO PurchasedBookMetadataSnapshots 
                  (Id, TransactionId, BookId, ItemName, AuthorName, CoverImage, CategoryCode, NoOfPages, PriceAtPurchase, LockedAt) 
                  VALUES ({0}, {1}, {2}, {3}, {4}, {5}, {6}, {7}, {8}, {9})",
                Guid.NewGuid(), txnId, book.Id, book.ItemName ?? "Book",
                authorEntity?.AuthorName ?? "B. Jain Author",
                book.CoverImagePath ?? "/images/default-cover.png",
                book.CategoryCode ?? "HOMEO", book.NoOfPages, book.Price, nowUtc);

            return Ok(new
            {
                success = true,
                message = totalVendorShare > 0
                    ? $"Book '{book.ItemName}' unlocked till {validTillUtc:dd MMM yyyy}! (Platform: ₹{platformShare:0.00} | Vendor Royalty: ₹{totalVendorShare:0.00})"
                    : $"Book '{book.ItemName}' unlock ho gayi hai! Valid till: {validTillUtc:dd MMM yyyy}",
                transactionId = txnId,
                bookId = book.Id,
                validFrom = nowUtc,
                validTill = validTillUtc,
                platformShare = platformShare,
                vendorRoyalty = totalVendorShare
            });
        }

        [HttpPost("purchase-bundle")]
        [Authorize]
        public async Task<IActionResult> PurchaseSuggestedBundle([FromBody] BundlePurchaseFromBookDto dto)
        {
            if (dto == null || dto.BundleId == Guid.Empty)
                return BadRequest(new { success = false, message = "Invalid Bundle ID." });

            var user = await _userManager.GetUserAsync(User);
            if (user == null)
                return Unauthorized(new { success = false, message = "Please sign in first." });

            var bundle = await _dbContext.Bundles
                .Include(b => b.BundleItems)
                .FirstOrDefaultAsync(b => b.Id == dto.BundleId && b.IsActive);

            if (bundle == null)
                return NotFound(new { success = false, message = "Bundle not found or inactive." });

            int validityDays = dto.ValidityDays > 0 ? dto.ValidityDays : 365;
            DateTime nowUtc = DateTime.UtcNow;
            DateTime validTillUtc = nowUtc.AddDays(validityDays);

            var existingProfile = await _dbContext.Customers.FirstOrDefaultAsync(c => c.UserId == user.Id);
            string txnId = $"BND-{nowUtc:yyyyMMddHHmmss}-{new Random().Next(100, 999)}";
            decimal totalPaid = bundle.FinalPrice;

            var bundleBookIds = bundle.BundleItems
                .Select(bi => bi.BookId)
                .Where(id => id != Guid.Empty)
                .Distinct()
                .ToList();

            decimal totalVendorShare = 0m;
            if (bundleBookIds.Any() && totalPaid > 0)
            {
                await _royaltyService.DistributeOrderRoyaltyAsync(
                    txnId,
                    "Bundle",
                    totalPaid,
                    bundleBookIds
                );

                var vendorCredits = await _dbContext.VendorRoyaltyTransactions
                    .Where(t => t.OrderReferenceId == txnId)
                    .ToListAsync();

                totalVendorShare = vendorCredits.Sum(t => t.EarnedRoyaltyAmount);
            }

            decimal platformShare = totalPaid - totalVendorShare;

            Guid targetBookId = (dto.CurrentBookId.HasValue && dto.CurrentBookId.Value != Guid.Empty)
                ? dto.CurrentBookId.Value
                : (bundle.BundleItems.FirstOrDefault()?.BookId ?? Guid.Empty);

            var bundlePurchaseRecord = new Customer
            {
                Id = Guid.NewGuid(),
                CustId = existingProfile?.CustId ?? ("CUST-" + nowUtc.Ticks.ToString().Substring(10)),
                CustName = existingProfile?.CustName ?? user.FullName ?? user.Email ?? "Reader Customer",
                MobileNo = existingProfile?.MobileNo ?? "N/A",
                EmailId = user.Email ?? existingProfile?.EmailId ?? "reader@bjain.com",
                Address1 = existingProfile?.Address1 ?? "Combo Bundle Purchase",
                Address2 = existingProfile?.Address2,
                Country = existingProfile?.Country ?? "India",
                State = existingProfile?.State ?? "N/A",
                PostalCode = existingProfile?.PostalCode ?? "000000",
                Landmark = existingProfile?.Landmark,
                UserId = user.Id,
                BookId = targetBookId,
                PlanType = $"Bundle:{bundle.BundleName}|ValidTill:{validTillUtc:O}",
                AmountPaid = totalPaid,
                TransactionId = txnId,
                PurchasedAt = nowUtc,
                CreatedAt = nowUtc
            };

            _dbContext.Customers.Add(bundlePurchaseRecord);
            await _dbContext.SaveChangesAsync();

            await EnsureSnapshotTableAsync();
            foreach (var bId in bundleBookIds)
            {
                await _dbContext.Database.ExecuteSqlRawAsync(
                    "INSERT INTO PurchasedBundleSnapshots (Id, TransactionId, UserId, BundleName, BookId, LockedAt) VALUES ({0}, {1}, {2}, {3}, {4}, {5})",
                    Guid.NewGuid(), txnId, user.Id, bundle.BundleName, bId, nowUtc);
            }
            var bundleBooksMeta = await _dbContext.Books
                .Include(b => b.AuthorMaster)
                .Where(b => bundleBookIds.Contains(b.Id))
                .ToDictionaryAsync(b => b.Id);

            foreach (var bId in bundleBookIds)
            {
                if (bundleBooksMeta.TryGetValue(bId, out var bk))
                {
                    await _dbContext.Database.ExecuteSqlRawAsync(
                        @"INSERT INTO PurchasedBookMetadataSnapshots 
                          (Id, TransactionId, BookId, ItemName, AuthorName, CoverImage, CategoryCode, NoOfPages, PriceAtPurchase, LockedAt) 
                          VALUES ({0}, {1}, {2}, {3}, {4}, {5}, {6}, {7}, {8}, {9})",
                        Guid.NewGuid(), txnId, bk.Id, bk.ItemName ?? "Book",
                        bk.AuthorMaster?.AuthorName ?? "B. Jain Author",
                        bk.CoverImagePath ?? "/images/default-cover.png",
                        bk.CategoryCode ?? "HOMEO", bk.NoOfPages, bk.Price, nowUtc);
                }
            }

            return Ok(new
            {
                success = true,
                message = totalVendorShare > 0
                    ? $"Bundle '{bundle.BundleName}' ({bundleBookIds.Count} Books) unlocked till {validTillUtc:dd MMM yyyy}! (Platform: ₹{platformShare:0.00} | Vendor Royalty: ₹{totalVendorShare:0.00})"
                    : $"Bundle '{bundle.BundleName}' ({bundleBookIds.Count} Books) unlocked! Valid till: {validTillUtc:dd MMM yyyy}",
                transactionId = txnId,
                bundleId = bundle.Id,
                validTill = validTillUtc,
                platformShare = platformShare,
                vendorRoyalty = totalVendorShare
            });
        }
    }
}