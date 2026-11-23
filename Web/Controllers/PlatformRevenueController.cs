using Application.DTOs;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Web.Controllers
{
    [Route("PlatformRevenue")]
    public class PlatformRevenueController : Controller
    {
        private readonly ApplicationDbContext _dbContext;

        public PlatformRevenueController(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        [HttpGet("Summary")]
        [HttpGet("/api/platform-revenue/summary")]
        public async Task<IActionResult> Summary([FromQuery] string? type = "ALL", [FromQuery] string? fromDate = null, [FromQuery] string? toDate = null)
        {
            try
            {
                var usersMap = await _dbContext.Users
                    .ToDictionaryAsync(
                        u => u.Id,
                        u => new
                        {
                            Name = !string.IsNullOrWhiteSpace(u.FullName) ? u.FullName : (u.Email ?? "Reader User"),
                            Email = u.Email ?? ""
                        }
                    );

                var booksMap = await _dbContext.Books
                    .ToDictionaryAsync(b => b.Id, b => b.ItemName ?? "Single Book");

                var vendorsMap = await _dbContext.Vendors
                    .ToDictionaryAsync(v => v.Id, v => v.Name ?? "Vendor");

                var allRoyaltyTxns = await _dbContext.VendorRoyaltyTransactions
                    .OrderByDescending(t => t.CreatedAt)
                    .ToListAsync();

                var royaltyByOrderRef = allRoyaltyTxns
                    .Where(t => !string.IsNullOrWhiteSpace(t.OrderReferenceId))
                    .GroupBy(t => t.OrderReferenceId!.Trim(), StringComparer.OrdinalIgnoreCase)
                    .ToDictionary(
                        g => g.Key,
                        g => new
                        {
                            TotalVendor30 = g.Sum(x => x.EarnedRoyaltyAmount),
                            Vendors = string.Join(", ", g.Select(x => vendorsMap.ContainsKey(x.VendorId) ? vendorsMap[x.VendorId] : "Vendor").Distinct())
                        },
                        StringComparer.OrdinalIgnoreCase
                    );

                var ledgerEntries = new List<PlatformRevenueLedgerDto>();
                var processedOrderRefs = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                var customerPurchases = await _dbContext.Customers
                    .Where(c => c.TransactionId != null &&
                                c.TransactionId != "INIT-PROFILE" &&
                                c.AmountPaid > 0 &&
                                c.PlanType != null &&
                                (c.PlanType.StartsWith("SingleBook") || c.PlanType.StartsWith("Bundle:")))
                    .OrderByDescending(c => c.PurchasedAt)
                    .ToListAsync();

                foreach (var cp in customerPurchases)
                {
                    string txnId = cp.TransactionId!.Trim();
                    if (processedOrderRefs.Contains(txnId)) continue;
                    processedOrderRefs.Add(txnId);

                    bool isBundle = cp.PlanType!.StartsWith("Bundle:", StringComparison.OrdinalIgnoreCase);
                    string purchaseType = isBundle ? "Book Bundle" : "Single Book";

                    string itemTitle;
                    if (isBundle)
                    {
                        string rawPart = cp.PlanType.Split("|ValidTill:")[0];
                        itemTitle = rawPart.Replace("Bundle:", "", StringComparison.OrdinalIgnoreCase).Trim();
                        if (string.IsNullOrWhiteSpace(itemTitle)) itemTitle = "Book Bundle";
                    }
                    else
                    {
                        itemTitle = (cp.BookId != Guid.Empty && booksMap.ContainsKey(cp.BookId))
                            ? booksMap[cp.BookId]
                            : "Single Book";
                    }

                    decimal grossAmount = cp.AmountPaid;
                    decimal vendor30;
                    string vendorNames;

                    if (royaltyByOrderRef.TryGetValue(txnId, out var rInfo) && rInfo.TotalVendor30 > 0)
                    {
                        vendor30 = rInfo.TotalVendor30;
                        vendorNames = !string.IsNullOrWhiteSpace(rInfo.Vendors) ? rInfo.Vendors : "Vendor (30%)";
                    }
                    else
                    {
                        // Koi royalty-based book nahi hai -> 0% Vendor, 100% Platform
                        vendor30 = 0m;
                        vendorNames = "No Royalty Book (100% Platform)";
                    }

                    decimal platform70 = Math.Round(grossAmount - vendor30, 2);
                    if (platform70 < 0) platform70 = 0m;

                    string uId = cp.UserId ?? "";
                    string uName = !string.IsNullOrWhiteSpace(cp.CustName)
                        ? cp.CustName
                        : ((!string.IsNullOrEmpty(uId) && usersMap.ContainsKey(uId)) ? usersMap[uId].Name : "Reader Customer");

                    string uEmail = !string.IsNullOrWhiteSpace(cp.EmailId)
                        ? cp.EmailId
                        : ((!string.IsNullOrEmpty(uId) && usersMap.ContainsKey(uId)) ? usersMap[uId].Email : "—");

                    ledgerEntries.Add(new PlatformRevenueLedgerDto
                    {
                        TransactionId = txnId,
                        PurchaseType = purchaseType,
                        ItemTitle = itemTitle,
                        UserName = uName,
                        UserEmail = uEmail,
                        VendorNames = vendorNames,
                        TransactionDate = cp.PurchasedAt,
                        GrossAmount = grossAmount,
                        VendorRoyalty30 = vendor30,
                        PlatformShare70 = platform70,
                        Status = vendor30 > 0 ? "Settled (70/30 Split)" : "Settled (100% Platform)"
                    });
                }
                var subscriptions = await _dbContext.UserSubscriptions
                    .Include(s => s.Plan)
                    .OrderByDescending(s => s.StartDate)
                    .ToListAsync();

                foreach (var sub in subscriptions)
                {
                    decimal grossAmount = sub.AmountPaid;
                    if (grossAmount <= 0) continue;

                    string txnId = !string.IsNullOrWhiteSpace(sub.TransactionId)
                        ? sub.TransactionId.Trim()
                        : $"SUB-{sub.Id.ToString("N").Substring(0, 8).ToUpper()}";

                    if (processedOrderRefs.Contains(txnId)) continue;
                    processedOrderRefs.Add(txnId);

                    decimal vendor30;
                    string vendorNames;

                    if (royaltyByOrderRef.TryGetValue(txnId, out var rInfo) && rInfo.TotalVendor30 > 0)
                    {
                        vendor30 = rInfo.TotalVendor30;
                        vendorNames = !string.IsNullOrWhiteSpace(rInfo.Vendors) ? rInfo.Vendors : "Vendor (30%)";
                    }
                    else
                    {
                        
                        vendor30 = 0m;
                        vendorNames = "No Royalty Book (100% Platform)";
                    }

                    decimal platform70 = Math.Round(grossAmount - vendor30, 2);
                    if (platform70 < 0) platform70 = 0m;

                    string uId = sub.UserId ?? "";
                    string uName = (!string.IsNullOrEmpty(uId) && usersMap.ContainsKey(uId)) ? usersMap[uId].Name : "Subscriber User";
                    string uEmail = (!string.IsNullOrEmpty(uId) && usersMap.ContainsKey(uId)) ? usersMap[uId].Email : "—";

                    bool isPlanActive = sub.ExpiryDate >= DateTime.UtcNow;

                    ledgerEntries.Add(new PlatformRevenueLedgerDto
                    {
                        TransactionId = txnId,
                        PurchaseType = "Subscription Plan",
                        ItemTitle = sub.Plan?.PlanName ?? "Subscription Plan",
                        UserName = uName,
                        UserEmail = uEmail,
                        VendorNames = vendorNames,
                        TransactionDate = sub.StartDate,
                        GrossAmount = grossAmount,
                        VendorRoyalty30 = vendor30,
                        PlatformShare70 = platform70,
                        Status = vendor30 > 0
                            ? (isPlanActive ? "Active • 70/30 Split" : "Settled (70/30 Split)")
                            : (isPlanActive ? "Active • 100% Platform" : "Settled (100% Platform)")
                    });
                }
                IEnumerable<PlatformRevenueLedgerDto> query = ledgerEntries
                    .OrderByDescending(x => x.TransactionDate);

                if (!string.IsNullOrWhiteSpace(type) && !type.Equals("ALL", StringComparison.OrdinalIgnoreCase))
                {
                    query = query.Where(x => x.PurchaseType.Equals(type, StringComparison.OrdinalIgnoreCase));
                }

                if (DateTime.TryParse(fromDate, out var fDate))
                {
                    query = query.Where(x => x.TransactionDate.Date >= fDate.Date);
                }

                if (DateTime.TryParse(toDate, out var tDate))
                {
                    query = query.Where(x => x.TransactionDate.Date <= tDate.Date);
                }

                var filteredList = query.ToList();

                var response = new PlatformRevenueSummaryResponseDto
                {
                    Success = true,
                    Kpis = new PlatformRevenueKpiDto
                    {
                        TotalTransactions = filteredList.Count,
                        TotalGrossRevenue = filteredList.Sum(x => x.GrossAmount),
                        TotalVendorRoyalty30 = filteredList.Sum(x => x.VendorRoyalty30),
                        TotalPlatformRevenue70 = filteredList.Sum(x => x.PlatformShare70),
                        PlanPlatformRevenue = filteredList.Where(x => x.PurchaseType == "Subscription Plan").Sum(x => x.PlatformShare70),
                        BundlePlatformRevenue = filteredList.Where(x => x.PurchaseType == "Book Bundle").Sum(x => x.PlatformShare70),
                        SingleBookPlatformRevenue = filteredList.Where(x => x.PurchaseType == "Single Book").Sum(x => x.PlatformShare70)
                    },
                    Transactions = filteredList
                };

                return Json(response);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new PlatformRevenueSummaryResponseDto
                {
                    Success = false,
                    Message = "Error loading platform revenue: " + ex.Message
                });
            }
        }
    }
}