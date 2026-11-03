using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BookPublishingSystem.Domain.Entities
{
    public class UserSubscription
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public string UserId { get; set; } = string.Empty;

        [Required]
        public Guid PlanId { get; set; }

        [ForeignKey("PlanId")]
        public Plan? Plan { get; set; }

        public decimal AmountPaid { get; set; }
        public decimal TaxAmount { get; set; }
        public DateTime StartDate { get; set; } = DateTime.UtcNow;
        public DateTime ExpiryDate { get; set; }

        [MaxLength(50)]
        public string Status { get; set; } = "Active"; 

        public string? TransactionId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}