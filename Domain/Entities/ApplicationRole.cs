using Microsoft.AspNetCore.Identity;

namespace BookPublishingSystem.Domain.Entities;

public class ApplicationRole : IdentityRole
{
    public string? Description { get; set; } = string.Empty;
}