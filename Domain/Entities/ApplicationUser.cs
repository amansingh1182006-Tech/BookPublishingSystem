using Microsoft.AspNetCore.Identity;

namespace BookPublishingSystem.Domain.Entities;

public class ApplicationUser : IdentityUser
{
    public string FullName { get; set; } = string.Empty;
    public string? Bio { get; set; } = string.Empty;
    public string? ProfilePicturePath { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<Book> AuthoredBooks { get; set; } = new List<Book>();
    public ICollection<Customer> Purchases { get; set; } = new List<Customer>();
}