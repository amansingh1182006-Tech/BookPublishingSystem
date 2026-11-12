using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace BookPublishingSystem.Application.DTOs
{
    public class SaveBundleDto
    {
        public Guid? Id { get; set; }

        [Required(ErrorMessage = "Bundle Name is required.")]
        [MaxLength(200)]
        public string BundleName { get; set; } = string.Empty;

        public string? Description { get; set; }

        public decimal DiscountPercentage { get; set; }

        public decimal FinalPrice { get; set; }

        public bool IsActive { get; set; } = true;

        [Required]
        public List<Guid> SelectedBookIds { get; set; } = new List<Guid>();
    }
}