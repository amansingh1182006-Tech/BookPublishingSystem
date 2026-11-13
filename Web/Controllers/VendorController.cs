using System;
using System.Linq;
using System.Threading.Tasks;
using Application.DTOs;
using Domain.Entities;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Web.Controllers
{
    [ApiController]
    [Route("api/vendor")]
    public class VendorController : ControllerBase
    {
        private readonly ApplicationDbContext _dbContext;

        public VendorController(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        // GET: api/vendor/get-all
        [HttpGet("get-all")]
        public async Task<IActionResult> GetAllVendors()
        {
            try
            {
                var vendors = await _dbContext.Vendors
                    .Include(v => v.RoyaltyRules)
                    .OrderByDescending(v => v.CreatedAt)
                    .ToListAsync();

                return Ok(vendors);
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = "Error fetching vendors: " + ex.Message });
            }
        }

        // POST: api/vendor/save-profile
        [HttpPost("save-profile")]
        [HttpPost("save")]
        public async Task<IActionResult> SaveVendorProfile([FromBody] VendorProfileCreateDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                if (dto == null)
                    return BadRequest(new { success = false, message = "Invalid Vendor Payload Data." });

                string cleanCode = (dto.VendorCode ?? "").Trim().ToUpper();
                string cleanEmail = (dto.Email ?? "").Trim();

                var existingVendor = await _dbContext.Vendors
                    .Include(v => v.RoyaltyRules)
                    .FirstOrDefaultAsync(v => v.VendorCode == cleanCode || v.Email == cleanEmail);

                if (existingVendor == null)
                {
                    
                    existingVendor = new Vendor
                    {
                        Id = Guid.NewGuid(),
                        VendorCode = cleanCode,
                        Name = dto.Name?.Trim() ?? "",
                        Phone = dto.Phone?.Trim() ?? "",
                        Email = cleanEmail,
                        Address = dto.Address?.Trim() ?? "",
                        PostalCode = dto.PostalCode?.Trim() ?? "",
                        Gstin = dto.Gstin?.Trim() ?? "",
                        BankAccountNo = dto.BankAccountNo?.Trim() ?? "",
                        IFSC = dto.IFSC?.Trim() ?? "",
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow
                    };

                    _dbContext.Vendors.Add(existingVendor);
                }
                else
                {
                   
                    existingVendor.Name = dto.Name?.Trim() ?? existingVendor.Name;
                    existingVendor.Phone = dto.Phone?.Trim() ?? existingVendor.Phone;
                    existingVendor.Address = dto.Address?.Trim() ?? existingVendor.Address;
                    existingVendor.PostalCode = dto.PostalCode?.Trim() ?? existingVendor.PostalCode;
                    existingVendor.Gstin = dto.Gstin?.Trim() ?? existingVendor.Gstin;
                    existingVendor.BankAccountNo = dto.BankAccountNo?.Trim() ?? existingVendor.BankAccountNo;
                    existingVendor.IFSC = dto.IFSC?.Trim() ?? existingVendor.IFSC;
                }

               
                if (dto.RoyaltyRules != null && dto.RoyaltyRules.Count > 0)
                {
                    foreach (var r in dto.RoyaltyRules)
                    {
                        if (r.BookId == Guid.Empty) continue;

                        var rule = new VendorRoyaltyRule
                        {
                            Id = Guid.NewGuid(),
                            VendorId = existingVendor.Id,
                            BookId = r.BookId,
                            BookName = r.BookName ?? "",
                            IsRoyaltyApplicable = r.IsRoyaltyApplicable,
                            RoyaltyPageThreshold = r.RoyaltyPageThreshold,
                            RoyaltyPercentage = r.RoyaltyPercentage,
                            RoyaltyFlatAmount = r.RoyaltyFlatAmount,
                            PublishingStartDate = r.PublishingStartDate != default ? r.PublishingStartDate : DateTime.UtcNow,
                            LiveStatus = string.IsNullOrWhiteSpace(r.LiveStatus) ? "Live" : r.LiveStatus,
                            Status = string.IsNullOrWhiteSpace(r.Status) ? "Active" : r.Status
                        };

                        existingVendor.RoyaltyRules.Add(rule);
                    }
                }

                await _dbContext.SaveChangesAsync();

                return Ok(new { success = true, message = "Vendor Profile and Royalty Rules saved successfully!" });
            }
            catch (Exception ex)
            {
                string detailedError = ex.InnerException != null
                    ? (ex.InnerException.InnerException != null ? ex.InnerException.InnerException.Message : ex.InnerException.Message)
                    : ex.Message;

                return BadRequest(new { success = false, message = "Save Error: " + detailedError });
            }
        }

        // DELETE: api/vendor/delete/{id}
        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> DeleteVendor(Guid id)
        {
            try
            {
                var vendor = await _dbContext.Vendors.FindAsync(id);
                if (vendor == null)
                    return NotFound(new { success = false, message = "Vendor not found." });

                _dbContext.Vendors.Remove(vendor);
                await _dbContext.SaveChangesAsync();

                return Ok(new { success = true, message = "Vendor deleted successfully." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = "Delete Error: " + ex.Message });
            }
        }

        // GET: api/vendor/vendor-books/{id}
        [HttpGet("vendor-books/{id}")]
        public async Task<IActionResult> GetVendorBooks(Guid id)
        {
            var vendor = await _dbContext.Vendors.FindAsync(id);
            if (vendor == null)
                return NotFound(new { success = false, message = "Vendor not found." });

            string cleanVendorName = (vendor.Name ?? "").Trim().ToLower();

            var vendorBooks = await _dbContext.Books
                .Where(b => b.VendorId == id || (!string.IsNullOrEmpty(b.VendorName) && b.VendorName.ToLower() == cleanVendorName))
                .OrderByDescending(b => b.CreatedAt)
                .Select(b => new
                {
                    id = b.Id,
                    itemNo = b.ItemNo,
                    itemName = b.ItemName,
                    noOfPages = b.NoOfPages,
                    price = b.Price,
                    vendorId = b.VendorId,
                    vendorName = b.VendorName
                })
                .ToListAsync();

            return Ok(new { success = true, books = vendorBooks });
        }

        // GET: api/vendor/earnings/{vendorId}
        [HttpGet("earnings/{vendorId}")]
        public async Task<IActionResult> GetVendorEarnings(Guid vendorId)
        {
            var transactions = await _dbContext.VendorRoyaltyTransactions
                .Where(t => t.VendorId == vendorId)
                .OrderByDescending(t => t.CreatedAt)
                .ToListAsync();

            return Ok(new
            {
                success = true,
                totalEarned = transactions.Sum(t => t.EarnedRoyaltyAmount),
                singleSalesEarned = transactions.Where(t => t.PurchaseType == "SingleBook").Sum(t => t.EarnedRoyaltyAmount),
                bundleSalesEarned = transactions.Where(t => t.PurchaseType == "Bundle").Sum(t => t.EarnedRoyaltyAmount),
                planSalesEarned = transactions.Where(t => t.PurchaseType == "Plan").Sum(t => t.EarnedRoyaltyAmount),
                transactions = transactions
            });
        }

        // POST: api/vendor/add-royalty-rule
        [HttpPost("add-royalty-rule")]
        public async Task<IActionResult> AddRoyaltyRule([FromBody] VendorRoyaltyRuleDto dto)
        {
            try
            {
                if (dto == null || dto.BookId == Guid.Empty || dto.VendorId == Guid.Empty)
                {
                    return BadRequest(new { success = false, message = "Invalid Rule Data. VendorId and BookId are required." });
                }

                var book = await _dbContext.Books.FindAsync(dto.BookId);
                string resolvedBookName = !string.IsNullOrWhiteSpace(dto.BookName)
                    ? dto.BookName.Trim()
                    : (book?.ItemName ?? "Mapped Book");

                // Agar is book ka rule pehle se bana hai toh update karein, warna naya banayein
                var existingRule = await _dbContext.VendorRoyaltyRules
                    .FirstOrDefaultAsync(r => r.VendorId == dto.VendorId && r.BookId == dto.BookId);

                if (existingRule != null)
                {
                    existingRule.BookName = resolvedBookName;
                    existingRule.IsRoyaltyApplicable = dto.IsRoyaltyApplicable;
                    existingRule.RoyaltyPageThreshold = dto.IsRoyaltyApplicable ? dto.RoyaltyPageThreshold : 0;
                    existingRule.RoyaltyPercentage = dto.IsRoyaltyApplicable ? dto.RoyaltyPercentage : 0;
                    existingRule.RoyaltyFlatAmount = dto.IsRoyaltyApplicable ? dto.RoyaltyFlatAmount : 0;
                    existingRule.PublishingStartDate = dto.PublishingStartDate != default ? dto.PublishingStartDate : existingRule.PublishingStartDate;
                    existingRule.LiveStatus = string.IsNullOrWhiteSpace(dto.LiveStatus) ? "Live" : dto.LiveStatus;
                    existingRule.Status = "Active";
                }
                else
                {
                    var rule = new VendorRoyaltyRule
                    {
                        Id = Guid.NewGuid(),
                        VendorId = dto.VendorId,
                        BookId = dto.BookId,
                        BookName = resolvedBookName,
                        IsRoyaltyApplicable = dto.IsRoyaltyApplicable,
                        RoyaltyPageThreshold = dto.IsRoyaltyApplicable ? dto.RoyaltyPageThreshold : 0,
                        RoyaltyPercentage = dto.IsRoyaltyApplicable ? dto.RoyaltyPercentage : 0,
                        RoyaltyFlatAmount = dto.IsRoyaltyApplicable ? dto.RoyaltyFlatAmount : 0,
                        PublishingStartDate = dto.PublishingStartDate != default ? dto.PublishingStartDate : DateTime.UtcNow,
                        LiveStatus = string.IsNullOrWhiteSpace(dto.LiveStatus) ? "Live" : dto.LiveStatus,
                        Status = string.IsNullOrWhiteSpace(dto.Status) ? "Active" : dto.Status
                    };
                    _dbContext.VendorRoyaltyRules.Add(rule);
                }

                await _dbContext.SaveChangesAsync();

                return Ok(new { success = true, message = "Royalty Rule Saved Successfully!" });
            }
            catch (Exception ex)
            {
                string detailedError = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return BadRequest(new { success = false, message = "Error saving rule: " + detailedError });
            }
        }

        // DELETE: api/vendor/delete-royalty-rule/{id}
        [HttpDelete("delete-royalty-rule/{id}")]
        public async Task<IActionResult> DeleteRoyaltyRule(Guid id)
        {
            try
            {
                var rule = await _dbContext.VendorRoyaltyRules.FindAsync(id);
                if (rule == null) return NotFound(new { success = false, message = "Rule not found." });

                _dbContext.VendorRoyaltyRules.Remove(rule);
                await _dbContext.SaveChangesAsync();

                return Ok(new { success = true, message = "Royalty Rule deleted." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = "Delete Error: " + ex.Message });
            }
        }


    }
}