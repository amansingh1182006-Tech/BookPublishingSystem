using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Application.Interfaces
{
    public interface IRoyaltyDistributionService
    {
        Task DistributeOrderRoyaltyAsync(
            string orderReferenceId,
            string purchaseType,
            decimal totalPaidAmount,
            List<Guid> includedBookIds);
    }
}