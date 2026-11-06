using Domain.Entities;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using BookPublishingSystem.Domain.Entities;

namespace Web.Middlewares
{
    public class SingleDeviceSessionMiddleware
    {
        private readonly RequestDelegate _next;

        public SingleDeviceSessionMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context, IServiceProvider serviceProvider)
        {
            if (context.User.Identity?.IsAuthenticated == true)
            {
                var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
                var tokenClaim = context.User.FindFirstValue("SessionToken");

                if (!string.IsNullOrEmpty(userId) && !string.IsNullOrEmpty(tokenClaim))
                {
                    using (var scope = serviceProvider.CreateScope())
                    {
                        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                        var signInManager = scope.ServiceProvider.GetRequiredService<SignInManager<ApplicationUser>>();

                       
                        var activeSession = await dbContext.Set<UserSession>()
                            .AsNoTracking()
                            .FirstOrDefaultAsync(s => s.UserId == userId && s.SessionToken == tokenClaim && s.IsActive);

                        
                        if (activeSession == null)
                        {
                            await signInManager.SignOutAsync();
                            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                            context.Response.ContentType = "application/json";
                            await context.Response.WriteAsync("{\"error\": \"SessionExpired\", \"message\": \"Aapka account kisi doosri device me login ho gaya hai. Kripya punah login karein.\"}");
                            return;
                        }

                        
                        if ((DateTime.UtcNow - activeSession.LastActiveTime).TotalMinutes > 5)
                        {
                            var sessionToUpdate = await dbContext.Set<UserSession>().FindAsync(activeSession.Id);
                            if (sessionToUpdate != null)
                            {
                                sessionToUpdate.LastActiveTime = DateTime.UtcNow;
                                await dbContext.SaveChangesAsync();
                            }
                        }
                    }
                }
            }

            await _next(context);
        }
    }
}