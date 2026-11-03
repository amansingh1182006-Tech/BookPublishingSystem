using Microsoft.AspNetCore.Http;
using System.Security.Claims;
using System.Threading.Tasks;

namespace Web.Middlewares
{
    public class AntiScreenshotMiddleware
    {
        private readonly RequestDelegate _next;

        public AntiScreenshotMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            if (context.Request.Path.StartsWithSegments("/api/reader") ||
                context.Request.Path.StartsWithSegments("/Reader") ||
                context.Request.Path.StartsWithSegments("/api/author"))
            {
                var userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "ANONYMOUS";
                var userEmail = context.User.FindFirst(ClaimTypes.Email)?.Value ?? "UNVERIFIED";

                context.Response.Headers["X-DRM-Watermark-User"] = $"{userEmail} ({userId})";
                context.Response.Headers["X-DRM-Session-Timestamp"] = System.DateTime.UtcNow.ToString("o");
            }

            await _next(context);
        }
    }
}