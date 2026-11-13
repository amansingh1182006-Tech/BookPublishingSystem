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
using Microsoft.AspNetCore.StaticFiles;
using Serilog;
using Web.Middlewares;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, configuration) =>
    configuration.ReadFrom.Configuration(context.Configuration));


builder.Services.AddInfrastructureServices(builder.Configuration);
builder.Services.AddApplicationServices();


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


builder.Services.AddScoped<IStorageService, LocalSecureStorageService>();
builder.Services.AddScoped<IChapterStreamService, DRMStreamService>();
builder.Services.AddScoped<Application.Interfaces.IRoyaltyDistributionService, Infrastructure.Services.RoyaltyDistributionService>();


builder.Services.AddAuthorizationBuilder()
    .AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"))
    .AddPolicy("CanManageOwnBook", policy =>
        policy.RequireRole("Author", "Publisher", "Admin")
              .AddRequirements(new Application.Authorization.Requirements.AuthorOwnershipRequirement()))
    .AddPolicy("CanReadPurchasedBook", policy =>
        policy.RequireRole("Reader", "Admin")
              .AddRequirements(new Application.Authorization.Requirements.BookPurchaseRequirement()));

builder.Services.AddControllersWithViews()
    .AddJsonOptions(options =>
    {
        
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });

var app = builder.Build();


using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<ApplicationDbContext>();

        
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


app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseMiddleware<AntiScreenshotMiddleware>();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();


app.UseDefaultFiles();

var provider = new FileExtensionContentTypeProvider();
provider.Mappings[".jpg"] = "image/jpeg";
provider.Mappings[".jpeg"] = "image/jpeg";
provider.Mappings[".png"] = "image/png";
provider.Mappings[".webp"] = "image/webp";

app.UseStaticFiles(new StaticFileOptions
{
    ContentTypeProvider = provider,
    OnPrepareResponse = ctx =>
    {
        
        ctx.Context.Response.Headers.Append("Cache-Control", "no-cache, no-store");
        ctx.Context.Response.Headers.Append("Expires", "-1");
    }
});


app.UseRouting();
app.UseAuthentication();
app.UseMiddleware<SingleDeviceSessionMiddleware>();
app.UseAuthorization();


app.MapControllers(); 

app.MapControllerRoute(
    name: "areas",
    pattern: "{area:exists}/{controller=Home}/{action=Index}/{id?}");

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");


app.MapFallbackToFile("index.html");

app.Run();