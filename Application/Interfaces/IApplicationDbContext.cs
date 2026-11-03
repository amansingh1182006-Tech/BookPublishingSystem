using BookPublishingSystem.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using System.Threading;
using System.Threading.Tasks;

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
         DbSet<Plan> Plans { get; set; }
         DbSet<UserSubscription> UserSubscriptions { get; set; }

        Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
    }
}