using System;

namespace Application.DTOs
{
    public class SingleBookPurchaseRequestDto
    {
        public Guid BookId { get; set; }
        public int ValidityDays { get; set; } = 365;
        public string? TransactionId { get; set; }
    }

    public class AdminManualSingleBookDto
    {
        public string UserId { get; set; } = string.Empty;
        public Guid BookId { get; set; }
        public decimal? CustomPrice { get; set; }
    }

    public class SingleBookSaleResponseDto
    {
        public Guid Id { get; set; }
        public string CustId { get; set; } = string.Empty;
        public string CustName { get; set; } = string.Empty;
        public string EmailId { get; set; } = string.Empty;
        public string MobileNo { get; set; } = string.Empty;
        public Guid? BookId { get; set; }
        public string BookName { get; set; } = string.Empty;
        public string ItemNo { get; set; } = string.Empty;
        public decimal AmountPaid { get; set; }
        public string TransactionId { get; set; } = string.Empty;
        public DateTime PurchasedAt { get; set; }
    }
}