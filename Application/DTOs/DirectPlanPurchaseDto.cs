using System;
using System.Collections.Generic;

namespace Application.DTOs
{
    public class DirectPlanPurchaseDto
    {
        public Guid PlanId { get; set; }
        public string UserEmail { get; set; }
        public List<Guid>? SelectedBookIds { get; set; }
    }
}