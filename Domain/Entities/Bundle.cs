using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace BookPublishingSystem.Domain.Entities
{
    [Table("Bundles")]
    public class Bundle
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [MaxLength(200)]
        public string BundleName { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        public int NumberOfTitles { get; set; } = 0; // Calculated dynamically from Items count

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalPrice { get; set; } = 0.00m; // Sum of individual book prices

        [Column(TypeName = "decimal(18,2)")]
        public decimal DiscountPercentage { get; set; } = 0.00m;

        [Column(TypeName = "decimal(18,2)")]
        public decimal FinalPrice { get; set; } = 0.00m; // Offer Selling Price

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation property for mapped books inside bundle
        public virtual ICollection<BundleItem> BundleItems { get; set; } = new List<BundleItem>();
    }

    [Table("BundleItems")]
    public class BundleItem
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid BundleId { get; set; }

        [Required]
        public Guid BookId { get; set; }

        [ForeignKey("BundleId")]
        [JsonIgnore]
        public virtual Bundle? Bundle { get; set; }

        [ForeignKey("BookId")]
        public virtual Book? Book { get; set; }
    }
}