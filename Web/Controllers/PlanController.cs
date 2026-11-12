using System;
using System.Linq;
using System.Threading.Tasks;
using Application.Interfaces;
using BookPublishingSystem.Application.DTOs;
using BookPublishingSystem.Domain.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Web.Controllers
{
    [ApiController]
    [Route("api/plan")]
    public class PlanController : ControllerBase
    {
        private readonly IApplicationDbContext _dbContext;

        public PlanController(IApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        // GET: api/plan/get-all
        [HttpGet("get-all")]
        public async Task<IActionResult> GetAllPlans()
        {
            try
            {
                var plans = await _dbContext.Plans
                    .Include(p => p.Features)
                    .OrderBy(p => p.PriceIncludingTax)
                    .ToListAsync();

                return Ok(plans);
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = "Error fetching plans: " + ex.Message });
            }
        }

        // POST: api/plan/save
        [HttpPost("save")]
        public async Task<IActionResult> SavePlan([FromBody] CreatePlanDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            try
            {
                Plan? plan = null;
                if (dto.Id.HasValue && dto.Id.Value != Guid.Empty)
                {
                    plan = await _dbContext.Plans
                        .Include(p => p.Features)
                        .FirstOrDefaultAsync(p => p.Id == dto.Id.Value);
                }

                if (plan == null)
                {
                    plan = new Plan { Id = Guid.NewGuid() };
                    _dbContext.Plans.Add(plan);
                }
                else
                {
                    
                    var existingFeatures = plan.Features.ToList();
                    foreach (var feat in existingFeatures)
                    {
                        _dbContext.PlanFeatures.Remove(feat);
                    }
                }

                
                int validityDays = dto.ValidityInDays;
                if (dto.BillingPeriod == "Monthly") validityDays = 30;
                else if (dto.BillingPeriod == "Yearly") validityDays = 365;
                else if (dto.BillingPeriod == "2 Years") validityDays = 730;
                else if (dto.BillingPeriod == "3 Years") validityDays = 1095;
                else if (dto.BillingPeriod == "5 Years") validityDays = 1825;

                plan.PlanName = dto.PlanName.Trim();
                plan.Description = dto.Description;
                plan.PriceIncludingTax = dto.PriceIncludingTax;
                plan.TaxPercentage = dto.TaxPercentage;
                plan.BillingPeriod = string.IsNullOrWhiteSpace(dto.BillingPeriod) ? "Monthly" : dto.BillingPeriod;
                plan.ValidityInDays = validityDays > 0 ? validityDays : 30;
                plan.TargetUser = dto.TargetUser;
                plan.BasicBookLimit = dto.BasicBookLimit;
                plan.RoyaltyBookLimit = dto.RoyaltyBookLimit;
                plan.MaxBookLimit = dto.BasicBookLimit + dto.RoyaltyBookLimit;
                plan.IsActive = dto.IsActive;

                
                if (dto.Features != null && dto.Features.Any())
                {
                    foreach (var f in dto.Features)
                    {
                        if (string.IsNullOrWhiteSpace(f.FeatureName)) continue;

                        plan.Features.Add(new PlanFeature
                        {
                            Id = Guid.NewGuid(),
                            PlanId = plan.Id,
                            FeatureName = f.FeatureName.Trim(),
                            Limitation = string.IsNullOrWhiteSpace(f.Limitation) ? "Included" : f.Limitation.Trim(),
                            IsEnabled = f.IsEnabled
                        });
                    }
                }

                await _dbContext.SaveChangesAsync(default);
                return Ok(new { success = true, message = "Subscription Plan Saved Successfully!", planId = plan.Id });
            }
            catch (Exception ex)
            {
                string detailedError = ex.InnerException != null
                    ? (ex.InnerException.InnerException != null ? ex.InnerException.InnerException.Message : ex.InnerException.Message)
                    : ex.Message;

                return BadRequest(new { success = false, message = "Save Error: " + detailedError });
            }
        }

        // DELETE: api/plan/delete/{id}
        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> DeletePlan(Guid id)
        {
            try
            {
                var plan = await _dbContext.Plans.FindAsync(id);
                if (plan == null) return NotFound(new { success = false, message = "Plan not found." });

                _dbContext.Plans.Remove(plan);
                await _dbContext.SaveChangesAsync(default);

                return Ok(new { success = true, message = "Plan deleted successfully." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = "Delete Error: " + ex.Message });
            }
        }
    }
}