namespace BookPublishingSystem.Domain.Entities;

public class Language
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string LanguageCode { get; set; } = string.Empty;
    public string LanguageName { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}