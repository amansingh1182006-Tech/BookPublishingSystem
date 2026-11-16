using System;

namespace Application.DTOs
{
    public class BundlePurchaseFromBookDto
    {
        public Guid BundleId { get; set; }
        public Guid? CurrentBookId { get; set; }
        public int ValidityDays { get; set; } = 365;
    }
}