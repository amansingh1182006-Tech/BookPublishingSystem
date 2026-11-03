namespace Application.DTOs
{
    public class UpsertCustomerProfileDto
    {
        public string CustName { get; set; } = string.Empty;
        public string MobileNo { get; set; } = string.Empty;
        public string Address1 { get; set; } = string.Empty;
        public string? Address2 { get; set; }
        public string Country { get; set; } = "India";
        public string State { get; set; } = string.Empty;
        public string PostalCode { get; set; } = string.Empty;
        public string? Landmark { get; set; }
    }
}