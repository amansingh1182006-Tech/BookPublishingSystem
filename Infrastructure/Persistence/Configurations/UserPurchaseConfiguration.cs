using BookPublishingSystem.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BookPublishingSystem.Infrastructure.Persistence.Configurations;

public class UserPurchaseConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> builder)
    {
        builder.HasKey(p => p.Id);

        builder.Property(p => p.AmountPaid)
               .HasPrecision(18, 2);

        // User relationship (Strict mapping)
        builder.HasOne(p => p.User)
               .WithMany()
               .HasForeignKey(p => p.UserId)
               .OnDelete(DeleteBehavior.Restrict);

        // Book relationship (Strict mapping)
        builder.HasOne(p => p.Book)
               .WithMany()
               .HasForeignKey(p => p.BookId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}