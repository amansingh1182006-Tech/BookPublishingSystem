using System;
using System.ComponentModel.DataAnnotations;

namespace Domain.Entities
{
    public class VendorRoyaltyTransaction
    {
        [Key]
        public Guid Id { get; set; }
        public string OrderReferenceId { get; set; } = string.Empty;
        public string PurchaseType { get; set; } = string.Empty; 
        public Guid VendorId { get; set; }
        public Guid BookId { get; set; }
        public string BookName { get; set; } = string.Empty;
        public decimal TotalOrderAmount { get; set; }
        public decimal RoyaltyPoolAmount { get; set; }
        public decimal BookPoints { get; set; }
        public decimal TotalOrderPoints { get; set; }
        public decimal EarnedRoyaltyAmount { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}