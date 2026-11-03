namespace BookPublishingSystem.Domain.Entities;

public class Keyword
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string KeywordCode { get; set; } = string.Empty;
    public string KeywordName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}