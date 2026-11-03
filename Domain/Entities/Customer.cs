using System;

namespace BookPublishingSystem.Domain.Entities;

public class Customer
{
   
    public Guid Id { get; set; } = Guid.NewGuid();
    public string CustId { get; set; } = string.Empty;       
    public string CustName { get; set; } = string.Empty;     
    public string MobileNo { get; set; } = string.Empty;     
    public string EmailId { get; set; } = string.Empty;      
    public string Address1 { get; set; } = string.Empty;     
    public string? Address2 { get; set; }                   
    public string Country { get; set; } = "India";           
    public string State { get; set; } = string.Empty;        
    public string PostalCode { get; set; } = string.Empty;   
    public string? Landmark { get; set; }                    
    public string UserId { get; set; } = string.Empty;
    public ApplicationUser User { get; set; } = null!;
    public Guid BookId { get; set; }
    public Book Book { get; set; } = null!;
    public string PlanType { get; set; } = "SingleBook";    
    public decimal AmountPaid { get; set; }
    public string? TransactionId { get; set; }               
    public DateTime PurchasedAt { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}