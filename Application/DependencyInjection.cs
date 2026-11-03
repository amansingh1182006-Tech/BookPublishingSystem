using Application.Authorization.Handlers;
using Application.Authorization.Requirements;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection;

namespace Application
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddApplicationServices(this IServiceCollection services)
        {
            services.AddScoped<IAuthorizationHandler, AuthorOwnershipHandler>();
            services.AddScoped<IAuthorizationHandler, BookPurchaseHandler>();

            return services;
        }
    }
}