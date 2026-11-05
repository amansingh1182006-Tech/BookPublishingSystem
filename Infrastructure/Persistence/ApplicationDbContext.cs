using Application.Interfaces;
using BookPublishingSystem.Domain.Entities;
using Domain.Entities;
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
        public DbSet<UserReadingProgress> UserReadingProgress { get; set; }
        public DbSet<UserSession> UserSessions { get; set; }

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

            builder.Entity<Customer>(entity =>
            {
                entity.ToTable("Customers");

                entity.HasOne(c => c.User)
                      .WithMany()
                      .HasForeignKey(c => c.UserId)
                      .OnDelete(DeleteBehavior.Restrict); 

                entity.HasOne(c => c.Book)
                      .WithMany()
                      .HasForeignKey(c => c.BookId)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            builder.Entity<UserReadingProgress>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.HasOne(e => e.Book)
                      .WithMany()
                      .HasForeignKey(e => e.BookId)
                      .OnDelete(DeleteBehavior.NoAction);
            });
        }
    }
}
