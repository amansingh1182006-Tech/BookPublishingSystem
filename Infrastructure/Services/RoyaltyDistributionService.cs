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

        public async Task DistributeOrderRoyaltyAsync(string orderReferenceId, string purchaseType, decimal totalPaidAmount, List<Guid> includedBookIds)
        {
            if (totalPaidAmount <= 0 || includedBookIds == null || !includedBookIds.Any())
                return;

            var books = await _dbContext.Books
                .Where(b => includedBookIds.Contains(b.Id))
                .ToListAsync();

            if (!books.Any()) return;

            var activeRules = await _dbContext.VendorRoyaltyRules
                .Where(r => includedBookIds.Contains(r.BookId)
                            && r.IsRoyaltyApplicable
                            && (r.LiveStatus == null || r.LiveStatus == "" || r.LiveStatus == "Live" || r.LiveStatus == "Active")
                            && r.RoyaltyPageThreshold > 0)
                .ToListAsync();

            if (!activeRules.Any())
                return; 

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

            decimal royaltyPoolAmount = Math.Round(totalPaidAmount * 0.30m, 2);

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