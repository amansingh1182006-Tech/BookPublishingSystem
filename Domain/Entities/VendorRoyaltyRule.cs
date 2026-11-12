using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Domain.Entities
{
    [Table("VendorRoyaltyRules")]
    public class VendorRoyaltyRule
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid VendorId { get; set; }
        [ForeignKey("VendorId")]
        public virtual Vendor Vendor { get; set; }
        [Required]
        public Guid BookId { get; set; }
        [Required]
        [StringLength(250)]
        public string BookName { get; set; }
        public bool IsRoyaltyApplicable { get; set; } = true; 
        public int RoyaltyPageThreshold { get; set; } = 0;
        [Column(TypeName = "decimal(18,2)")]
        public decimal RoyaltyPercentage { get; set; } = 0.00m;
        [Column(TypeName = "decimal(18,2)")]
        public decimal RoyaltyFlatAmount { get; set; } = 0.00m;
        public DateTime PublishingStartDate { get; set; } = DateTime.UtcNow;        
        [StringLength(50)]
        public string LiveStatus { get; set; } = "Live";       
        [StringLength(50)]
        public string Status { get; set; } = "Active";
    }
}