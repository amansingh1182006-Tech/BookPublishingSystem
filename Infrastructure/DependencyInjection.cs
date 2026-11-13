using Application.Interfaces;
using BookPublishingSystem.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Infrastructure.Persistence;

namespace Infrastructure
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddInfrastructureServices(this IServiceCollection services, IConfiguration configuration)
        {
            // Add DbContext
            services.AddDbContext<ApplicationDbContext>(options =>
                options.UseSqlServer(configuration.GetConnectionString("DefaultConnection")));

            // Direct interface binding to ApplicationDbContext (No Lambda Needed)
            services.AddScoped<IApplicationDbContext, ApplicationDbContext>();
            services.AddScoped<Application.Interfaces.IRoyaltyDistributionService, Infrastructure.Services.RoyaltyDistributionService>();

            return services;
        }

    }
}
