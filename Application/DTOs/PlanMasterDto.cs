using System;
using System.ComponentModel.DataAnnotations;

namespace BookPublishingSystem.Application.DTOs
{
    public class CreatePlanDto
    {
        [Required(ErrorMessage = "Plan Name is required")]
        public string PlanName { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        [Range(0.01, 1000000, ErrorMessage = "Price must be greater than 0")]
        public decimal PriceIncludingTax { get; set; }

        public decimal TaxPercentage { get; set; } = 18.0m;

        [Range(1, 3650, ErrorMessage = "Validity in days must be at least 1 day")]
        public int ValidityInDays { get; set; }

        public string TargetUser { get; set; } = "Reader"; 

        public int MaxBookLimit { get; set; } = -1; 
    }

    public class PlanResponseDto : CreatePlanDto
    {
        public Guid Id { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}