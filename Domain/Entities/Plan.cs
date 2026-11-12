using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BookPublishingSystem.Domain.Entities
{
    [Table("Plans")]
    public class Plan
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [MaxLength(100)]
        public string PlanName { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        public decimal PriceIncludingTax { get; set; }
        public decimal TaxPercentage { get; set; } = 18.0m;

        [Required]
        [MaxLength(50)]
        public string BillingPeriod { get; set; } = "Monthly"; 

        public int ValidityInDays { get; set; } = 30; 

        [MaxLength(50)]
        public string TargetUser { get; set; } = "Reader";
        public int BasicBookLimit { get; set; } = 0;   
        public int RoyaltyBookLimit { get; set; } = 0; 
        public int MaxBookLimit { get; set; } = -1;

        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public virtual ICollection<PlanFeature> Features { get; set; } = new List<PlanFeature>();
    }

    [Table("PlanFeatures")] 
    public class PlanFeature
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid PlanId { get; set; }

        [Required]
        [MaxLength(150)]
        public string FeatureName { get; set; } = string.Empty;

        [MaxLength(100)]
        public string Limitation { get; set; } = "Included";

        public bool IsEnabled { get; set; } = true;

        [ForeignKey("PlanId")]
        public virtual Plan? Plan { get; set; }
    }
}