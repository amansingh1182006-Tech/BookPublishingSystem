using Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Web.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CustomerController : ControllerBase
    {
        private readonly ApplicationDbContext _dbContext;

        public CustomerController(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        // GET: api/customer/all
        [HttpGet("all")]
        public async Task<IActionResult> GetAllCustomers()
        {
            try
            {
                var customers = await _dbContext.Customers
                    .OrderByDescending(c => c.CreatedAt)
                    .Select(c => new
                    {
                        custId = string.IsNullOrEmpty(c.CustId) ? "CUST-000" : c.CustId,
                        custName = string.IsNullOrEmpty(c.CustName) ? "Unknown Customer" : c.CustName,
                        emailId = string.IsNullOrEmpty(c.EmailId) ? "N/A" : c.EmailId,
                        mobileNo = string.IsNullOrEmpty(c.MobileNo) ? "N/A" : c.MobileNo,
                        address1 = string.IsNullOrEmpty(c.Address1) ? "N/A" : c.Address1,
                        state = string.IsNullOrEmpty(c.State) ? "N/A" : c.State,
                        planType = "Active Reader"
                    })
                    .ToListAsync();

                return Ok(customers);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error fetching customers: " + ex.Message });
            }
        }
    }
}