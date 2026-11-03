using Application.DTOs;
using BookPublishingSystem.Application.DTOs;
using BookPublishingSystem.Domain.Entities;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace BookPublishingSystem.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PlanController : ControllerBase
    {
        private readonly ApplicationDbContext _dbContext;

        public PlanController(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        // GET: api/plan/all
        [HttpGet("all")]
        public async Task<IActionResult> GetAllPlans()
        {
            try
            {
                var plans = await _dbContext.Plans
                    .OrderByDescending(p => p.CreatedAt)
                    .ToListAsync();
                return Ok(plans);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error fetching plans: " + ex.Message });
            }
        }

        // POST: api/plan/create
        [HttpPost("create")]
        public async Task<IActionResult> CreatePlan([FromBody] CreatePlanDto model)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            try
            {
                var plan = new Plan
                {
                    Id = Guid.NewGuid(),
                    PlanName = model.PlanName.Trim(),
                    Description = model.Description?.Trim() ?? "",
                    PriceIncludingTax = model.PriceIncludingTax,
                    TaxPercentage = model.TaxPercentage,
                    ValidityInDays = model.ValidityInDays,
                    TargetUser = string.IsNullOrWhiteSpace(model.TargetUser) ? "Reader" : model.TargetUser.Trim(),
                    MaxBookLimit = model.MaxBookLimit,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };

                _dbContext.Plans.Add(plan);
                await _dbContext.SaveChangesAsync();

                return Ok(new { message = $"Plan '{plan.PlanName}' successfully create ho gaya hai!", planId = plan.Id });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error creating plan: " + ex.Message });
            }
        }

        // PUT: api/plan/update/{id}
        [HttpPut("update/{id}")]
        public async Task<IActionResult> UpdatePlan(Guid id, [FromBody] CreatePlanDto model)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            try
            {
                var plan = await _dbContext.Plans.FindAsync(id);
                if (plan == null)
                    return NotFound(new { message = "Plan nahi mila." });

                plan.PlanName = model.PlanName.Trim();
                plan.Description = model.Description?.Trim() ?? "";
                plan.PriceIncludingTax = model.PriceIncludingTax;
                plan.TaxPercentage = model.TaxPercentage;
                plan.ValidityInDays = model.ValidityInDays;
                plan.TargetUser = model.TargetUser;
                plan.MaxBookLimit = model.MaxBookLimit;

                await _dbContext.SaveChangesAsync();
                return Ok(new { message = "Plan successfully update ho gaya hai!" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error updating plan: " + ex.Message });
            }
        }

        // DELETE: api/plan/delete/{id}
        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> DeletePlan(Guid id)
        {
            try
            {
                var plan = await _dbContext.Plans.FindAsync(id);
                if (plan == null)
                    return NotFound(new { message = "Plan nahi mila." });

                _dbContext.Plans.Remove(plan);
                await _dbContext.SaveChangesAsync();
                return Ok(new { message = "Plan delete ho gaya hai!" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error deleting plan: " + ex.Message });
            }
        }
    }
}