using BookPublishingSystem.Application.DTOs;
using BookPublishingSystem.Domain.Entities;
using Domain.Entities;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Web.Models;

namespace Web.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AccountController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly SignInManager<ApplicationUser> _signInManager;
        private readonly RoleManager<ApplicationRole> _roleManager;
        private readonly ApplicationDbContext _dbContext;

        public AccountController(
            UserManager<ApplicationUser> userManager,
            SignInManager<ApplicationUser> signInManager,
            RoleManager<ApplicationRole> roleManager,
            ApplicationDbContext dbContext)
        {
            _userManager = userManager;
            _signInManager = signInManager;
            _roleManager = roleManager;
            _dbContext = dbContext;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterViewModel model)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var existingUser = await _userManager.FindByEmailAsync(model.Email);
            if (existingUser != null) return BadRequest(new { message = "Email is already registered." });

            var user = new ApplicationUser
            {
                UserName = model.Email,
                Email = model.Email,
                FullName = model.FullName,
                EmailConfirmed = true,
                CreatedAt = DateTime.UtcNow
            };

            var result = await _userManager.CreateAsync(user, model.Password);
            if (!result.Succeeded) return BadRequest(result.Errors);

            string roleName = model.SelectedRole.ToString();
            if (!await _roleManager.RoleExistsAsync(roleName))
            {
                await _roleManager.CreateAsync(new ApplicationRole { Name = roleName });
            }
            await _userManager.AddToRoleAsync(user, roleName);

            if (roleName.Equals("Author", StringComparison.OrdinalIgnoreCase) || roleName.Equals("Publisher", StringComparison.OrdinalIgnoreCase))
            {
                var authorMaster = new Author
                {
                    Id = Guid.NewGuid(),
                    AuthorName = user.FullName ?? user.Email,
                    CreatedAt = DateTime.UtcNow
                };
                _dbContext.Authors.Add(authorMaster);
            }
            else if (roleName.Equals("Reader", StringComparison.OrdinalIgnoreCase))
            {
                string genCustId = $"CUST-{DateTime.UtcNow:yyMM}-{new Random().Next(1000, 9999)}";
                var defaultBook = await _dbContext.Books.FirstOrDefaultAsync();
                Guid assignedBookId = defaultBook != null ? defaultBook.Id : Guid.NewGuid();

                var customerMaster = new Customer
                {
                    Id = Guid.NewGuid(),
                    CustId = genCustId,
                    CustName = !string.IsNullOrWhiteSpace(user.FullName) ? user.FullName : user.Email,
                    EmailId = user.Email ?? string.Empty,
                    MobileNo = "N/A",
                    Address1 = "Pending Profile Update",
                    Address2 = string.Empty,
                    State = "N/A",
                    PostalCode = "000000",
                    Country = "India",
                    Landmark = string.Empty,
                    UserId = user.Id,
                    BookId = assignedBookId,
                    PlanType = "ProfileOnly",
                    AmountPaid = 0.00m,
                    TransactionId = "REGISTER-INIT",
                    PurchasedAt = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow
                };

                _dbContext.Customers.Add(customerMaster);
            }

            await _dbContext.SaveChangesAsync();
            return Ok(new { message = "Registration successful! Record synced to Master list.", email = user.Email });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginViewModel model)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var user = await _userManager.FindByEmailAsync(model.Email);
            if (user == null)
            {
                return Unauthorized(new { message = "Invalid email or password." });
            }

            var result = await _signInManager.CheckPasswordSignInAsync(user, model.Password, false);

            if (result.Succeeded)
            {
                
                var activeSessions = await _dbContext.Set<UserSession>()
                    .Where(s => s.UserId == user.Id && s.IsActive)
                    .ToListAsync();

                foreach (var session in activeSessions)
                {
                    session.IsActive = false;
                }

                
                string newSessionToken = Guid.NewGuid().ToString();
                string? ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

                var newSession = new UserSession
                {
                    UserId = user.Id,
                    SessionToken = newSessionToken,
                    IpAddress = ipAddress,
                    LoginTime = DateTime.UtcNow,
                    LastActiveTime = DateTime.UtcNow,
                    IsActive = true
                };

                _dbContext.Set<UserSession>().Add(newSession);
                await _dbContext.SaveChangesAsync();

                
                await _userManager.UpdateSecurityStampAsync(user);

                var claims = new List<Claim>
                {
                    new Claim("SessionToken", newSessionToken)
                };

                await _signInManager.SignInWithClaimsAsync(user, model.RememberMe, claims);

                var roles = await _userManager.GetRolesAsync(user);
                string redirectUrl = "/";

                if (roles.Contains("Admin"))
                {
                    redirectUrl = "/Admin/Dashboard";
                }
                else if (roles.Contains("Author") || roles.Contains("Publisher"))
                {
                    redirectUrl = "/Author/Dashboard";
                }

                return Ok(new
                {
                    message = "Login successful",
                    userId = user.Id,
                    email = user.Email,
                    fullName = user.FullName,
                    roles = roles,
                    redirectUrl = redirectUrl,
                    sessionToken = newSessionToken
                });
            }

            return Unauthorized(new { message = "Invalid email or password." });
        }

        [HttpGet("me")]
        public async Task<IActionResult> GetCurrentUser()
        {
            if (User.Identity == null || !User.Identity.IsAuthenticated)
            {
                return Unauthorized();
            }

            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var roles = await _userManager.GetRolesAsync(user);

            return Ok(new
            {
                userId = user.Id,
                email = user.Email,
                fullName = user.FullName,
                profilePicturePath = user.ProfilePicturePath,
                roles = roles
            });
        }

        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto model)
        {
            if (string.IsNullOrWhiteSpace(model.Email) ||
                string.IsNullOrWhiteSpace(model.NewPassword) ||
                string.IsNullOrWhiteSpace(model.ConfirmPassword))
            {
                return BadRequest(new { message = "Email, New Password aur Confirm Password sabhi required hain." });
            }

            if (model.NewPassword.Trim() != model.ConfirmPassword.Trim())
            {
                return BadRequest(new { message = "New Password aur Confirm Password match nahi ho rahe hain." });
            }

            var user = await _userManager.FindByEmailAsync(model.Email.Trim());
            if (user == null)
            {
                return NotFound(new { message = "Is Email ID ke sath koi account registered nahi hai." });
            }

            var resetToken = await _userManager.GeneratePasswordResetTokenAsync(user);
            var result = await _userManager.ResetPasswordAsync(user, resetToken, model.NewPassword.Trim());

            if (result.Succeeded)
            {
                await _userManager.UpdateSecurityStampAsync(user);
                return Ok(new { message = "Password successfully reset ho gaya hai! Ab aap naye password se login kar sakte hain." });
            }

            var errorMessages = string.Join(", ", result.Errors.Select(e => e.Description));
            return BadRequest(new { message = errorMessages });
        }

        [Authorize]
        [HttpGet("profile")]
        public async Task<IActionResult> GetUserProfile()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var roles = await _userManager.GetRolesAsync(user);
            var mainRole = roles.FirstOrDefault() ?? "Reader";

            object? roleDetails = null;

            if (mainRole == "Admin")
            {
                var allUsers = await _dbContext.Users
                    .Select(u => new { u.Id, u.FullName, u.Email, u.CreatedAt })
                    .ToListAsync();

                var allPurchases = await _dbContext.Customers
                    .Include(p => p.User)
                    .Include(p => p.Book)
                    .Select(p => new
                    {
                        p.Id,
                        p.CustId,
                        p.CustName,
                        p.MobileNo,
                        p.TransactionId,
                        p.AmountPaid,
                        p.PurchasedAt,
                        UserEmail = p.User != null ? p.User.Email : p.EmailId,
                        BookDetails = p.Book != null ? new
                        {
                            p.Book.ItemNo,
                            p.Book.ISBN,
                            p.Book.ItemName,
                            Title = p.Book.ItemName,
                            p.Book.Price
                        } : null
                    })
                    .ToListAsync();

                roleDetails = new
                {
                    totalUsersCount = allUsers.Count,
                    totalPurchasesCount = allPurchases.Count,
                    totalRevenue = allPurchases.Sum(p => p.AmountPaid),
                    users = allUsers,
                    purchases = allPurchases
                };
            }
            else if (mainRole == "Author" || mainRole == "Publisher")
            {
                var myBooks = await _dbContext.Books
                    .Where(b => b.AuthorId == user.Id)
                    .Select(b => new
                    {
                        b.Id,
                        b.ItemNo,
                        b.ISBN,
                        b.ItemName,
                        Title = b.ItemName,
                        b.CategoryCode,
                        b.NoOfPages,
                        AuthorName = b.AuthorMaster != null ? b.AuthorMaster.AuthorName : "Official Publisher",
                        b.Language,
                        b.Description,
                        b.Price,
                        b.IsPublished,
                        b.CreatedAt
                    }).ToListAsync();

                roleDetails = new
                {
                    publishedBooksCount = myBooks.Count(b => b.IsPublished),
                    draftBooksCount = myBooks.Count(b => !b.IsPublished),
                    books = myBooks
                };
            }
            else if (mainRole == "Reader")
            {
                var myPurchases = await _dbContext.Customers
                    .Include(p => p.Book)
                    .Where(p => p.UserId == user.Id)
                    .Select(p => new
                    {
                        p.BookId,
                        bookTitle = p.Book != null ? p.Book.ItemName : "",
                        bookItemName = p.Book != null ? p.Book.ItemName : "",
                        p.AmountPaid,
                        p.PurchasedAt,
                        p.TransactionId
                    }).ToListAsync();

                roleDetails = new
                {
                    totalPurchased = myPurchases.Count,
                    purchases = myPurchases
                };
            }

            return Ok(new
            {
                userId = user.Id,
                email = user.Email,
                fullName = user.FullName,
                bio = user.Bio,
                profilePicturePath = user.ProfilePicturePath,
                roles = roles,
                primaryRole = mainRole,
                details = roleDetails
            });
        }

        [HttpPost("logout")]
        public async Task<IActionResult> Logout()
        {
            if (User.Identity?.IsAuthenticated == true)
            {
                var userId = _userManager.GetUserId(User);
                var tokenClaim = User.FindFirstValue("SessionToken");

                if (!string.IsNullOrEmpty(userId) && !string.IsNullOrEmpty(tokenClaim))
                {
                    var currentSession = await _dbContext.Set<UserSession>()
                        .FirstOrDefaultAsync(s => s.UserId == userId && s.SessionToken == tokenClaim);

                    if (currentSession != null)
                    {
                        currentSession.IsActive = false;
                        await _dbContext.SaveChangesAsync();
                    }
                }
            }

            await _signInManager.SignOutAsync();
            return Ok(new { message = "Logout successful" });
        }
    }
}