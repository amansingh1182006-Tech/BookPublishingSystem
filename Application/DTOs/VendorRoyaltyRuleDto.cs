using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Application.DTOs
{
    public class VendorRoyaltyRuleDto
    {
        public Guid? Id { get; set; }
        public Guid VendorId { get; set; }
        public Guid BookId { get; set; }
        public string BookName { get; set; }
        public bool IsRoyaltyApplicable { get; set; }
        public int RoyaltyPageThreshold { get; set; } 
        public decimal RoyaltyPercentage { get; set; }
        public decimal RoyaltyFlatAmount { get; set; }
        public DateTime PublishingStartDate { get; set; }
        public string LiveStatus { get; set; } = "Live"; 
        public string Status { get; set; } = "Active";
    }

    public class VendorProfileCreateDto
    {
        [Required]
        public string VendorCode { get; set; }

        [Required]
        public string Name { get; set; }

        [Required]
        public string Phone { get; set; }

        [Required]
        [EmailAddress]
        public string Email { get; set; }

        public string Address { get; set; }
        public string PostalCode { get; set; }
        public string Gstin { get; set; }

        
        public string BankAccountNo { get; set; }
        public string IFSC { get; set; }

        
        public List<VendorRoyaltyRuleDto> RoyaltyRules { get; set; } = new List<VendorRoyaltyRuleDto>();
    }
}