namespace Application.DTOs;

public class AuthorDto
{
    public Guid Id { get; set; }
    public string AuthorName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? ModifiedAt { get; set; }
}

public class CustomerDto
{
    public Guid Id { get; set; }
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
    public Guid BookId { get; set; }
    public string BookItemName { get; set; } = string.Empty; 
    public string PlanType { get; set; } = string.Empty;
    public decimal AmountPaid { get; set; }
    public string? TransactionId { get; set; }
    public DateTime PurchasedAt { get; set; }
}

public class CreateCustomerDto
{
    public string CustName { get; set; } = string.Empty;
    public string MobileNo { get; set; } = string.Empty;
    public string EmailId { get; set; } = string.Empty;
    public string Address1 { get; set; } = string.Empty;
    public string? Address2 { get; set; }
    public string Country { get; set; } = "India";
    public string State { get; set; } = string.Empty;
    public string PostalCode { get; set; } = string.Empty;
    public string? Landmark { get; set; }
}