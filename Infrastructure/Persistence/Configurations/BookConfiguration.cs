using BookPublishingSystem.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BookPublishingSystem.Infrastructure.Persistence.Configurations;

public class BookConfiguration : IEntityTypeConfiguration<Book>
{
    public void Configure(EntityTypeBuilder<Book> builder)
    {
        builder.HasKey(b => b.Id);

        // Replaced Title with ItemName Configuration
        builder.Property(b => b.ItemName).IsRequired().HasMaxLength(250);
        builder.Property(b => b.ItemNo).IsRequired().HasMaxLength(50);
        builder.Property(b => b.CategoryCode).IsRequired().HasMaxLength(50);
        builder.Property(b => b.ISBN).HasMaxLength(50);
        builder.Property(b => b.Language).HasMaxLength(50);

        // SQL Server Decimal Precision Fix
        builder.Property(b => b.Price).HasPrecision(18, 2);

        // Identity User (Author) Relationship
        builder.HasOne(b => b.Author)
               .WithMany(u => u.AuthoredBooks)
               .HasForeignKey(b => b.AuthorId)
               .OnDelete(DeleteBehavior.Cascade);

        // Author Master Entity Relationship
        builder.HasOne(b => b.AuthorMaster)
               .WithMany(a => a.Books)
               .HasForeignKey(b => b.AuthorMasterId)
               .OnDelete(DeleteBehavior.SetNull);

        // Language Master Entity Relationship
        builder.HasOne(b => b.LanguageMaster)
               .WithMany()
               .HasForeignKey(b => b.LanguageMasterId)
               .OnDelete(DeleteBehavior.SetNull);
    }
}