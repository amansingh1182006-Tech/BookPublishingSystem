using Microsoft.AspNetCore.Http;
using System.Threading.Tasks;

namespace Web.Middlewares
{
    public class SecurityHeadersMiddleware
    {
        private readonly RequestDelegate _next;

        public SecurityHeadersMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context)
        {
           
            context.Response.Headers["X-Frame-Options"] = "SAMEORIGIN";
            context.Response.Headers["X-Content-Type-Options"] = "nosniff";
            context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
            context.Response.Headers["X-XSS-Protection"] = "1; mode=block";
            context.Response.Headers["Content-Security-Policy"] = "frame-ancestors 'self';";

            await _next(context);
        }
    }
}