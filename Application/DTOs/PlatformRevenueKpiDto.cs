using System;
using System.Collections.Generic;

namespace Application.DTOs
{
    public class PlatformRevenueKpiDto
    {
        public int TotalTransactions { get; set; }
        public decimal TotalGrossRevenue { get; set; }
        public decimal TotalVendorRoyalty30 { get; set; }
        public decimal TotalPlatformRevenue70 { get; set; }
        public decimal PlanPlatformRevenue { get; set; }
        public decimal BundlePlatformRevenue { get; set; }
        public decimal SingleBookPlatformRevenue { get; set; }
    }

    public class PlatformRevenueLedgerDto
    {
        public string TransactionId { get; set; } = string.Empty;
        public string PurchaseType { get; set; } = string.Empty; 
        public string ItemTitle { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty;
        public string UserEmail { get; set; } = string.Empty;
        public string VendorNames { get; set; } = string.Empty;
        public DateTime TransactionDate { get; set; }
        public decimal GrossAmount { get; set; }
        public decimal VendorRoyalty30 { get; set; }
        public decimal PlatformShare70 { get; set; }
        public string Status { get; set; } = "Settled";
    }

    public class PlatformRevenueSummaryResponseDto
    {
        public bool Success { get; set; } = true;
        public string? Message { get; set; }
        public PlatformRevenueKpiDto Kpis { get; set; } = new PlatformRevenueKpiDto();
        public List<PlatformRevenueLedgerDto> Transactions { get; set; } = new List<PlatformRevenueLedgerDto>();
    }
}