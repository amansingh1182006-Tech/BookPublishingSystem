using Application.Interfaces;
using BookPublishingSystem.Domain.Entities;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistence
{
    public class ApplicationDbContext : IdentityDbContext<ApplicationUser, ApplicationRole, string>, IApplicationDbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<Book> Books => Set<Book>();
        
       
        public DbSet<Category> Categories { get; set; }
        public DbSet<Author> Authors { get; set; }
        public DbSet<Language> Languages { get; set; }
        public DbSet<Keyword> Keywords { get; set; }
        public DbSet<Customer> Customers { get; set; }
        public DbSet<BookSegmentAlpha> BookSegmentsAlpha { get; set; }
        public DbSet<BookSegmentBeta> BookSegmentsBeta { get; set; }
        public DbSet<BookSegmentGamma> BookSegmentsGamma { get; set; }
        public DbSet<Plan> Plans { get; set; }
        public DbSet<UserSubscription> UserSubscriptions { get; set; }

        protected override void OnModelCreating(ModelBuilder builder)
        {
           
            base.OnModelCreating(builder);

            builder.Entity<ApplicationUser>(entity =>
            {
                entity.ToTable("AspNetUsers");
            });

            builder.Entity<ApplicationRole>(entity =>
            {
                entity.ToTable("AspNetRoles");
            });

            builder.Entity<BookSegmentAlpha>().ToTable("BookSegmentAlpha");
            builder.Entity<BookSegmentBeta>().ToTable("BookSegmentBeta");
            builder.Entity<BookSegmentGamma>().ToTable("BookSegmentGamma");
        }
    }
}
