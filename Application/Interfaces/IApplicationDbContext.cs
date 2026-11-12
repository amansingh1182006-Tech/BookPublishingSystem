using System.Threading;
using System.Threading.Tasks;
using BookPublishingSystem.Domain.Entities;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.Interfaces
{
    public interface IApplicationDbContext
    {
        DbSet<Book> Books { get; }
        DbSet<BookSegmentAlpha> BookSegmentsAlpha { get; set; }
        DbSet<BookSegmentBeta> BookSegmentsBeta { get; set; }
        DbSet<BookSegmentGamma> BookSegmentsGamma { get; set; }
        DbSet<Category> Categories { get; set; }
        DbSet<Author> Authors { get; set; }
        DbSet<Language> Languages { get; set; }
        DbSet<Keyword> Keywords { get; set; }
        DbSet<Customer> Customers { get; set; }

        // Plans & Features
        DbSet<BookPublishingSystem.Domain.Entities.Plan> Plans { get; set; }
        DbSet<BookPublishingSystem.Domain.Entities.PlanFeature> PlanFeatures { get; set; }

        DbSet<UserSubscription> UserSubscriptions { get; set; }
        DbSet<UserReadingProgress> UserReadingProgress { get; set; }
        DbSet<UserSession> UserSessions { get; set; }

        // Vendor & Royalty
        DbSet<Vendor> Vendors { get; set; }
        DbSet<VendorRoyaltyRule> VendorRoyaltyRules { get; set; }

         DbSet<Bundle> Bundles { get; set; }
         DbSet<BundleItem> BundleItems { get; set; }

        Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
    }
}