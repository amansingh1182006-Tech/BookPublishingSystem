using BookPublishingSystem.Domain.Entities;
using BookPublishingSystem.Domain.Enums;
using Microsoft.AspNetCore.Identity;
using System;
using System.Threading.Tasks;

namespace Infrastructure.Persistence.Seeders
{
    public static class RoleAndUserSeeder
    {
        public static async Task SeedRolesAndAdminAsync(
            RoleManager<ApplicationRole> roleManager,
            UserManager<ApplicationUser> userManager)
        {
            // 1. Seed System Roles in Database (If they don't exist)
            foreach (var roleName in Enum.GetNames(typeof(SystemRole)))
            {
                if (!await roleManager.RoleExistsAsync(roleName))
                {
                    await roleManager.CreateAsync(new ApplicationRole { Name = roleName });
                }
            }

            // Code me koi hardcoded admin account ya secrets file dependence nahi hai.
            // Purely Database-Driven Identity Auth.
        }
    }
}