using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace BookPublishingSystem.Application.DTOs
{
    public class PlanFeatureDto
    {
        public Guid? Id { get; set; }

        [Required(ErrorMessage = "Feature Name is required")]
        public string FeatureName { get; set; } = string.Empty;

        public string Limitation { get; set; } = "Included";
        public bool IsEnabled { get; set; } = true;
    }

    public class CreatePlanDto
    {
        
        public Guid? Id { get; set; }

        [Required(ErrorMessage = "Plan Name is required")]
        public string PlanName { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        [Range(0, 1000000, ErrorMessage = "Price must be valid")]
        public decimal PriceIncludingTax { get; set; }

        public decimal TaxPercentage { get; set; } = 18.0m;

        [Required]
        public string BillingPeriod { get; set; } = "Monthly";
        [Range(1, 3650, ErrorMessage = "Validity in days must be at least 1 day")]
        public int ValidityInDays { get; set; } = 30;

        public string TargetUser { get; set; } = "Reader";

       
        public int BasicBookLimit { get; set; } = 0;   
        public int RoyaltyBookLimit { get; set; } = 0; 
        public int MaxBookLimit { get; set; } = -1;    

       
        public bool IsActive { get; set; } = true;

        
        public List<PlanFeatureDto> Features { get; set; } = new List<PlanFeatureDto>();
    }

    public class PlanResponseDto : CreatePlanDto
    {
        public DateTime CreatedAt { get; set; }
    }
}