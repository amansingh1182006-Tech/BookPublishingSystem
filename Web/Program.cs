using Application;
using Application.Interfaces;
using BookPublishingSystem.Domain.Entities;
using Infrastructure;
using Infrastructure.Identity;
using Infrastructure.Persistence;
using Infrastructure.Persistence.Seeders;
using Infrastructure.Services;
using Infrastructure.Storage;
using Microsoft.AspNetCore.Identity;
using Web.Middlewares;

var builder = WebApplication.CreateBuilder(args);

// Add Infrastructure & Application Services
builder.Services.AddInfrastructureServices(builder.Configuration);
builder.Services.AddApplicationServices();

// Add ASP.NET Core Identity
builder.Services.AddIdentity<ApplicationUser, ApplicationRole>(options =>
{
    options.Password.RequireDigit = true;
    options.Password.RequiredLength = 8;
    options.Password.RequireNonAlphanumeric = false;
    options.SignIn.RequireConfirmedAccount = false;
})
.AddEntityFrameworkStores<ApplicationDbContext>()
.AddDefaultTokenProviders();

builder.Services.AddScoped<IUserClaimsPrincipalFactory<ApplicationUser>, CustomClaimsPrincipalFactory>();

// Custom Storage & DRM Services
builder.Services.AddScoped<IStorageService, LocalSecureStorageService>();
builder.Services.AddScoped<IChapterStreamService, DRMStreamService>();

// Custom Policy Configuration (Admin, Author, Reader Policies)
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"))
    .AddPolicy("CanManageOwnBook", policy =>
        policy.RequireRole("Author", "Publisher", "Admin")
              .AddRequirements(new Application.Authorization.Requirements.AuthorOwnershipRequirement()))
    .AddPolicy("CanReadPurchasedBook", policy =>
        policy.RequireRole("Reader", "Admin")
              .AddRequirements(new Application.Authorization.Requirements.BookPurchaseRequirement()));

builder.Services.AddControllersWithViews();

var app = builder.Build();

// Automatic Database & Identity Tables Initialization
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<ApplicationDbContext>();

        // Ensure SQL Server tables exist
        await context.Database.EnsureCreatedAsync();

        var roleManager = services.GetRequiredService<RoleManager<ApplicationRole>>();
        var roles = new[] { "Author", "Publisher", "Reader", "Admin" };

        foreach (var role in roles)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new ApplicationRole { Name = role });
            }
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Database Auto-Init Error: {ex.Message}");
    }
}

// Seed Database System Roles
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var roleManager = services.GetRequiredService<RoleManager<ApplicationRole>>();
        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
        await RoleAndUserSeeder.SeedRolesAndAdminAsync(roleManager, userManager);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Seeding Error: {ex.Message}");
    }
}

// Middleware Pipeline Injection
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseMiddleware<AntiScreenshotMiddleware>();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();

// IMPORTANT FIX: Static Files and Default Document Middleware Order
app.UseDefaultFiles();
app.UseStaticFiles(); // React Build Assets & Storage Files

// Routing & Authorization Middleware Order
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();

// Controllers & React SPA Fallback Route
app.MapControllers(); // For API Controllers (/api/account, /api/admin, etc.)

app.MapControllerRoute(
    name: "areas",
    pattern: "{area:exists}/{controller=Home}/{action=Index}/{id?}");

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

// Direct React App Fallback ( For React single page application route resolve )
app.MapFallbackToFile("index.html");

app.Run();