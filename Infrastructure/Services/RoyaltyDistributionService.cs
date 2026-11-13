using Application.Interfaces;
using BookPublishingSystem.Domain.Entities;
using Domain.Entities;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Infrastructure.Services
{
    public class RoyaltyDistributionService : IRoyaltyDistributionService
    {
        private readonly ApplicationDbContext _dbContext;

        public RoyaltyDistributionService(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task DistributeOrderRoyaltyAsync(
            string orderReferenceId,
            string purchaseType, // "SingleBook", "Bundle", "Plan"
            decimal totalPaidAmount,
            List<Guid> includedBookIds)
        {
            if (totalPaidAmount <= 0 || includedBookIds == null || !includedBookIds.Any())
                return;

            // 1. Order mein shamil sabhi books fetch karein
            var books = await _dbContext.Books
                .Where(b => includedBookIds.Contains(b.Id))
                .ToListAsync();

            if (!books.Any()) return;

            // 2. Sirf un books ke active Royalty Rules uthayein jahan IsRoyaltyApplicable == true hai
            var activeRules = await _dbContext.VendorRoyaltyRules
                .Where(r => includedBookIds.Contains(r.BookId)
                            && r.IsRoyaltyApplicable
                            && r.LiveStatus == "Live"
                            && r.RoyaltyPageThreshold > 0)
                .ToListAsync();

            if (!activeRules.Any())
                return; // Sabhi Basic books hain -> 100% revenue Publisher ke paas rahega

            // 3. Har Royalty Book ke Points calculate karein: Pages / Threshold
            var bookPointEntries = new List<(VendorRoyaltyRule Rule, Book Book, decimal Points)>();
            decimal totalOrderPoints = 0m;

            foreach (var rule in activeRules)
            {
                var book = books.FirstOrDefault(b => b.Id == rule.BookId);
                if (book == null) continue;

                decimal points = Math.Round((decimal)book.NoOfPages / rule.RoyaltyPageThreshold, 4);
                if (points <= 0) continue;

                bookPointEntries.Add((rule, book, points));
                totalOrderPoints += points;
            }

            if (totalOrderPoints <= 0) return;

            // 4. Total Revenue ka 30% Royalty Pool calculate karein
            decimal royaltyPoolAmount = Math.Round(totalPaidAmount * 0.30m, 2);

            // 5. Har Vendor ko uske Book Points ke ratio mein 30% Pool se share credit karein
            foreach (var entry in bookPointEntries)
            {
                decimal shareRatio = entry.Points / totalOrderPoints;
                decimal earnedAmount = Math.Round(royaltyPoolAmount * shareRatio, 2);

                var ledgerEntry = new VendorRoyaltyTransaction
                {
                    Id = Guid.NewGuid(),
                    OrderReferenceId = orderReferenceId,
                    PurchaseType = purchaseType,
                    VendorId = entry.Rule.VendorId,
                    BookId = entry.Book.Id,
                    BookName = entry.Book.ItemName,
                    TotalOrderAmount = totalPaidAmount,
                    RoyaltyPoolAmount = royaltyPoolAmount,
                    BookPoints = entry.Points,
                    TotalOrderPoints = totalOrderPoints,
                    EarnedRoyaltyAmount = earnedAmount,
                    CreatedAt = DateTime.UtcNow
                };

                _dbContext.VendorRoyaltyTransactions.Add(ledgerEntry);
            }

            await _dbContext.SaveChangesAsync();
        }
    }
}