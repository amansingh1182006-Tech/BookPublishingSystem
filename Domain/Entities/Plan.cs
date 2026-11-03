using System;
using System.ComponentModel.DataAnnotations;

namespace BookPublishingSystem.Domain.Entities
{
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
        public int ValidityInDays { get; set; }

        [MaxLength(50)]
        public string TargetUser { get; set; } = "Reader"; 

        public int MaxBookLimit { get; set; } = -1; 
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}