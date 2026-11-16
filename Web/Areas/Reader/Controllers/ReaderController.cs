using Application.DTOs;
using BookPublishingSystem.Domain.Entities;
using Domain.Entities;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PdfSharpCore.Drawing;
using PdfSharpCore.Pdf;
using PdfSharpCore.Pdf.IO;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace Web.Areas.Reader.Controllers
{
    [Area("Reader")]
    [Route("Reader")] 
    public class ReaderController : Controller 
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly SignInManager<ApplicationUser> _signInManager;
        private readonly IWebHostEnvironment _environment;

        public ReaderController(
            ApplicationDbContext dbContext,
            UserManager<ApplicationUser> userManager,
            SignInManager<ApplicationUser> signInManager,
            IWebHostEnvironment environment)
        {
            _dbContext = dbContext;
            _userManager = userManager;
            _signInManager = signInManager;
            _environment = environment;
        }
        private static DateTime ParseValidTill(string? planType, DateTime startDate)
        {
            if (!string.IsNullOrWhiteSpace(planType) && planType.Contains("|ValidTill:"))
            {
                var parts = planType.Split("|ValidTill:");
                if (parts.Length == 2 && DateTime.TryParse(parts[1], null, DateTimeStyles.RoundtripKind, out var parsedDate))
                {
                    return parsedDate;
                }
            }
            return startDate.AddDays(365);
        }

        // GET: /Reader/Watch
        [HttpGet("Watch")]
        public IActionResult Watch()
        {
            return View();
        }

        // GET: /Reader/profile-status
        [HttpGet("profile-status")]
        public async Task<IActionResult> GetProfileStatus([FromQuery] string? userId = null)
        {
            ApplicationUser? user = null;
            bool isAdminViewing = !string.IsNullOrWhiteSpace(userId) && User.IsInRole("Admin");

            if (isAdminViewing)
                user = await _userManager.FindByIdAsync(userId!);
            else
                user = await _userManager.GetUserAsync(User);

            if (user == null) return Unauthorized(new { message = "User session invalid." });

            var customer = await _dbContext.Customers
                .Where(c => c.UserId == user.Id)
                .OrderBy(c => c.TransactionId == "INIT-PROFILE" ? 0 : 1)
                .FirstOrDefaultAsync();

            bool isProfileComplete = customer != null
                && !string.IsNullOrWhiteSpace(customer.MobileNo)
                && customer.MobileNo != "N/A"
                && !string.IsNullOrWhiteSpace(customer.Address1)
                && customer.Address1 != "Pending Profile Update";

            if (!isProfileComplete)
            {
                return Ok(new
                {
                    hasProfile = false,
                    isAdminViewing = isAdminViewing,
                    email = user.Email,
                    fullName = user.FullName ?? string.Empty,
                    profile = customer != null ? new CustomerDto
                    {
                        Id = customer.Id,
                        CustId = customer.CustId,
                        CustName = customer.CustName,
                        MobileNo = customer.MobileNo == "N/A" ? "" : customer.MobileNo,
                        EmailId = customer.EmailId,
                        Address1 = customer.Address1 == "Pending Profile Update" ? "" : customer.Address1,
                        Address2 = customer.Address2,
                        Country = customer.Country,
                        State = customer.State == "N/A" ? "" : customer.State,
                        PostalCode = customer.PostalCode == "000000" ? "" : customer.PostalCode,
                        Landmark = customer.Landmark,
                        UserId = customer.UserId
                    } : null
                });
            }

            return Ok(new
            {
                hasProfile = true,
                isAdminViewing = isAdminViewing,
                profile = new CustomerDto
                {
                    Id = customer!.Id,
                    CustId = customer.CustId,
                    CustName = customer.CustName,
                    MobileNo = customer.MobileNo,
                    EmailId = customer.EmailId,
                    Address1 = customer.Address1,
                    Address2 = customer.Address2,
                    Country = customer.Country,
                    State = customer.State,
                    PostalCode = customer.PostalCode,
                    Landmark = customer.Landmark,
                    UserId = customer.UserId
                }
            });
        }
        // GET: /Reader/Profile
        [HttpGet("Profile")]
        public IActionResult Profile()
        {
            return View(); 
        }

        [HttpGet("api/my-purchases")]
        public async Task<IActionResult> GetMyPurchasesWithValidity([FromQuery] string? userId = null)
        {
            ApplicationUser? user = (!string.IsNullOrWhiteSpace(userId) && User.IsInRole("Admin"))
                ? await _userManager.FindByIdAsync(userId!)
                : await _userManager.GetUserAsync(User);

            if (user == null) return Unauthorized(new { message = "User session invalid." });

            var customerRecords = await _dbContext.Customers
                .Include(c => c.Book)
                    .ThenInclude(b => b!.AuthorMaster)
                .Where(c => c.UserId == user.Id && c.TransactionId != "INIT-PROFILE")
                .OrderByDescending(c => c.PurchasedAt)
                .ToListAsync();

            var allBundles = await _dbContext.Bundles
                .Include(b => b.BundleItems)
                    .ThenInclude(bi => bi.Book)
                        .ThenInclude(bk => bk!.AuthorMaster)
                .ToListAsync();

            var nowUtc = DateTime.UtcNow;

            var bundles = customerRecords
                .Where(c => c.PlanType != null && c.PlanType.StartsWith("Bundle:"))
                .Select(br =>
                {
                    string cleanBundleName = br.PlanType!.Split("|ValidTill:")[0].Replace("Bundle:", "").Trim();
                    DateTime validTill = ParseValidTill(br.PlanType, br.PurchasedAt);
                    int daysLeft = Math.Max(0, (int)Math.Ceiling((validTill - nowUtc).TotalDays));
                    var matchedBundle = allBundles.FirstOrDefault(b => b.BundleName.Equals(cleanBundleName, StringComparison.OrdinalIgnoreCase));

                    return new
                    {
                        transactionId = br.TransactionId,
                        bundleName = cleanBundleName,
                        amountPaid = br.AmountPaid,
                        purchasedDate = br.PurchasedAt,
                        validFrom = br.PurchasedAt,
                        validTill = validTill,
                        isExpired = validTill < nowUtc,
                        remainingDays = daysLeft,
                        books = matchedBundle == null
                            ? new List<object>()
                            : matchedBundle.BundleItems
                                .Where(i => i.Book != null)
                                .Select(i => (object)new
                                {
                                    bookId = i.Book!.Id,
                                    itemName = i.Book.ItemName,
                                    authorName = i.Book.AuthorMaster != null ? i.Book.AuthorMaster.AuthorName : "B. Jain Author",
                                    coverImage = i.Book.CoverImagePath ?? "/images/default-cover.png",
                                    pages = i.Book.NoOfPages
                                })
                                .ToList()
                    };
                })
                .ToList();

            var singleBooks = customerRecords
                .Where(c => c.PlanType != null && c.PlanType.StartsWith("SingleBook") && c.Book != null)
                .Select(sr =>
                {
                    DateTime validTill = ParseValidTill(sr.PlanType, sr.PurchasedAt);
                    int daysLeft = Math.Max(0, (int)Math.Ceiling((validTill - nowUtc).TotalDays));

                    return new
                    {
                        transactionId = sr.TransactionId,
                        bookId = sr.BookId,
                        itemName = sr.Book!.ItemName,
                        authorName = sr.Book.AuthorMaster != null ? sr.Book.AuthorMaster.AuthorName : "B. Jain Author",
                        categoryCode = sr.Book.CategoryCode,
                        coverImage = sr.Book.CoverImagePath ?? "/images/default-cover.png",
                        pages = sr.Book.NoOfPages,
                        amountPaid = sr.AmountPaid,
                        validFrom = sr.PurchasedAt,
                        validTill = validTill,
                        isExpired = validTill < nowUtc,
                        remainingDays = daysLeft
                    };
                })
                .ToList();

            return Ok(new { bundles, singleBooks });
        }

        // POST: /Reader/upsert-profile
        [HttpPost("upsert-profile")]
        public async Task<IActionResult> UpsertProfile([FromBody] UpsertCustomerProfileDto dto)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized(new { message = "User session invalid." });

            var customer = await _dbContext.Customers.FirstOrDefaultAsync(c => c.UserId == user.Id);

            if (customer == null)
            {
               
                var defaultBook = await _dbContext.Books.FirstOrDefaultAsync();
                Guid assignedBookId = defaultBook != null ? defaultBook.Id : Guid.NewGuid();

                customer = new Customer
                {
                    Id = Guid.NewGuid(),
                    CustId = "CUST-" + DateTime.UtcNow.Ticks.ToString().Substring(10),
                    CustName = dto.CustName,
                    MobileNo = dto.MobileNo,
                    EmailId = user.Email ?? (dto.MobileNo + "@customer.com"),
                    Address1 = dto.Address1,
                    Address2 = dto.Address2,
                    Country = string.IsNullOrWhiteSpace(dto.Country) ? "India" : dto.Country,
                    State = dto.State,
                    PostalCode = dto.PostalCode,
                    Landmark = dto.Landmark,
                    UserId = user.Id,
                    BookId = assignedBookId,
                    PlanType = "ProfileOnly",
                    AmountPaid = 0,
                    TransactionId = "INIT-PROFILE",
                    PurchasedAt = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow
                };

                _dbContext.Customers.Add(customer);
            }
            else
            {
                customer.CustName = dto.CustName;
                customer.MobileNo = dto.MobileNo;
                customer.Address1 = dto.Address1;
                customer.Address2 = dto.Address2;
                customer.Country = dto.Country;
                customer.State = dto.State;
                customer.PostalCode = dto.PostalCode;
                customer.Landmark = dto.Landmark;

                _dbContext.Customers.Update(customer);
            }

            await _dbContext.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                message = "Customer profile saved successfully!",
                profile = new CustomerDto
                {
                    Id = customer.Id,
                    CustId = customer.CustId,
                    CustName = customer.CustName,
                    MobileNo = customer.MobileNo,
                    EmailId = customer.EmailId,
                    Address1 = customer.Address1,
                    Address2 = customer.Address2,
                    Country = customer.Country,
                    State = customer.State,
                    PostalCode = customer.PostalCode,
                    Landmark = customer.Landmark,
                    UserId = customer.UserId
                }
            });
        }
        // GET: /Reader/stream-book/{bookId}
        [HttpGet("stream-book/{bookId:guid}")]
        [AllowAnonymous]
        public async Task<IActionResult> StreamBook(Guid bookId)
        {
            var book = await _dbContext.Books.FirstOrDefaultAsync(b => b.Id == bookId);
            if (book == null)
            {
                return NotFound(new { message = "Book record not found in database." });
            }

            
            var user = await _userManager.GetUserAsync(User);
            if (user != null)
            {
                var customer = await _dbContext.Customers.FirstOrDefaultAsync(c => c.UserId == user.Id);
                if (customer != null)
                {
                    customer.BookId = bookId;
                    customer.PlanType = "SingleBook";
                    _dbContext.Customers.Update(customer);
                    await _dbContext.SaveChangesAsync();
                }
            }

            
            var alphaSegments = await _dbContext.BookSegmentsAlpha.Where(s => s.BookId == bookId).ToListAsync();
            var betaSegments = await _dbContext.BookSegmentsBeta.Where(s => s.BookId == bookId).ToListAsync();
            var gammaSegments = await _dbContext.BookSegmentsGamma.Where(s => s.BookId == bookId).ToListAsync();

            var combinedList = new List<SegmentNode>();
            combinedList.AddRange(alphaSegments.Select(a => new SegmentNode { Id = a.Id, ParentId = a.ParentChunkId, Path = a.StorageRelativePath }));
            combinedList.AddRange(betaSegments.Select(b => new SegmentNode { Id = b.Id, ParentId = b.ParentChunkId, Path = b.StorageRelativePath }));
            combinedList.AddRange(gammaSegments.Select(g => new SegmentNode { Id = g.Id, ParentId = g.ParentChunkId, Path = g.StorageRelativePath }));

            
            if (!combinedList.Any())
            {
                string uploadsFolder = Path.Combine(_environment.WebRootPath, "uploads", "books");
                string physicalFilePath = Path.Combine(uploadsFolder, $"{bookId}.pdf");

                if (System.IO.File.Exists(physicalFilePath))
                {
                    byte[] fileBytes = await System.IO.File.ReadAllBytesAsync(physicalFilePath);
                    return File(fileBytes, "application/pdf");
                }

                
                using (MemoryStream ms = new MemoryStream())
                {
                    PdfDocument tempDoc = new PdfDocument();
                    PdfPage page = tempDoc.AddPage();
                    XGraphics gfx = XGraphics.FromPdfPage(page);

                    XFont titleFont = new XFont("Arial", 16, XFontStyle.Bold);
                    XFont bodyFont = new XFont("Arial", 11, XFontStyle.Regular);

                    gfx.DrawString("B. Jain Group eBook Reader", titleFont, XBrushes.Navy, new XPoint(40, 50));
                    gfx.DrawString("Protected Reader Mode Active", titleFont, XBrushes.DarkRed, new XPoint(40, 90));
                    gfx.DrawString("Price: Rs. " + book.Price, bodyFont, XBrushes.Black, new XPoint(40, 130));
                    gfx.DrawString("Is book ke DRM Segments update process me hain. Reader mode active hai.", bodyFont, XBrushes.DarkGray, new XPoint(40, 170));

                    tempDoc.Save(ms, false);
                    return File(ms.ToArray(), "application/pdf");
                }
            }

            
            var orderedSegments = new List<SegmentNode>();
            var current = combinedList.FirstOrDefault(s => s.ParentId == null);

            while (current != null)
            {
                orderedSegments.Add(current);
                current = combinedList.FirstOrDefault(s => s.ParentId == current.Id);
            }

            var openedDocuments = new List<PdfDocument>();
            try
            {
                using (PdfDocument outputDocument = new PdfDocument())
                {
                    foreach (var seg in orderedSegments)
                    {
                        string physicalPath = Path.Combine(_environment.ContentRootPath, seg.Path);
                        if (System.IO.File.Exists(physicalPath))
                        {
                            PdfDocument inputChunk = PdfReader.Open(physicalPath, PdfDocumentOpenMode.Import);
                            openedDocuments.Add(inputChunk);

                            for (int pageIdx = 0; pageIdx < inputChunk.PageCount; pageIdx++)
                            {
                                outputDocument.AddPage(inputChunk.Pages[pageIdx]);
                            }
                        }
                    }

                    MemoryStream stream = new MemoryStream();
                    outputDocument.Save(stream, false);
                    stream.Position = 0;

                    return File(stream, "application/pdf");
                }
            }
            finally
            {
                foreach (var doc in openedDocuments) doc.Dispose();
            }
        }

        // POST: /Reader/api/save-progress
        [HttpPost("api/save-progress")]
        public async Task<IActionResult> SaveProgress([FromBody] ReadingProgressDto dto)
        {
            
            var user = await _userManager.GetUserAsync(User);

            
            string userId = user?.Id ?? User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrEmpty(userId))
            {
                
                var lastCust = await _dbContext.Customers.OrderByDescending(c => c.CreatedAt).FirstOrDefaultAsync();
                if (lastCust != null) userId = lastCust.UserId;
            }

            if (string.IsNullOrEmpty(userId)) return Unauthorized(new { message = "User identity missing." });

            if (dto == null || dto.BookId == Guid.Empty)
            {
                return BadRequest(new { message = "Invalid Book ID provided." });
            }

            var progress = await _dbContext.UserReadingProgress
                .FirstOrDefaultAsync(p => p.UserId == userId && p.BookId == dto.BookId);

            if (progress == null)
            {
                progress = new UserReadingProgress
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    BookId = dto.BookId,
                    LastReadPage = dto.LastReadPage > 0 ? dto.LastReadPage : 1,
                    TotalPages = dto.TotalPages > 0 ? dto.TotalPages : 1,
                    LastReadAt = DateTime.UtcNow
                };
                _dbContext.UserReadingProgress.Add(progress);
            }
            else
            {
                progress.LastReadPage = dto.LastReadPage;
                if (dto.TotalPages > 0) progress.TotalPages = dto.TotalPages;
                progress.LastReadAt = DateTime.UtcNow;
            }

            await _dbContext.SaveChangesAsync();
            return Ok(new { success = true, message = "Reading progress saved to My Library." });
        }

        // GET: /api/reader/my-library OR /Reader/api/my-library
        [HttpGet("api/my-library")]
        [HttpGet("/api/reader/my-library")]
        public async Task<IActionResult> GetMyLibrary([FromQuery] string? userId = null)
        {
            ApplicationUser? user = (!string.IsNullOrWhiteSpace(userId) && User.IsInRole("Admin"))
                ? await _userManager.FindByIdAsync(userId!)
                : await _userManager.GetUserAsync(User);

            if (user == null) return Unauthorized(new { message = "User session invalid." });

            var library = await _dbContext.UserReadingProgress
                .Where(p => p.UserId == user.Id)
                .OrderByDescending(p => p.LastReadAt)
                .Select(p => new
                {
                    bookId = p.BookId,
                    itemName = p.Book != null ? p.Book.ItemName : "eBook Document",
                    authorName = p.Book != null && p.Book.AuthorMaster != null ? p.Book.AuthorMaster.AuthorName : "B. Jain Author",
                    categoryCode = p.Book != null ? p.Book.CategoryCode : "HOMEO",
                    coverImage = p.Book != null ? p.Book.CoverImagePath : "/images/default-cover.png",
                    lastReadPage = p.LastReadPage,
                    totalPages = p.TotalPages,
                    progressPercentage = p.TotalPages > 0 ? (int)((double)p.LastReadPage / p.TotalPages * 100) : 0,
                    lastReadAt = p.LastReadAt
                })
                .ToListAsync();

            return Ok(library);
        }
        // POST: /Reader/logout
        [HttpPost("logout")]
        public async Task<IActionResult> Logout()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user != null)
            {
                
                var customerRecords = await _dbContext.Customers
                    .Where(c => c.UserId == user.Id)
                    .ToListAsync();

                if (customerRecords.Any())
                {
                    _dbContext.Customers.RemoveRange(customerRecords);
                }

                
                var activeSessions = await _dbContext.UserSessions
                    .Where(s => s.UserId == user.Id && s.IsActive)
                    .ToListAsync();

                foreach (var session in activeSessions)
                {
                    session.IsActive = false;
                }

                await _dbContext.SaveChangesAsync();
            }
            await _signInManager.SignOutAsync();

            return Ok(new { success = true, message = "Logged out and customer profile data cleared." });
        }
    }
}