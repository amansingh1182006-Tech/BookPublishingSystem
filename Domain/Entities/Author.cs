namespace BookPublishingSystem.Domain.Entities;

public class Author
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string AuthorName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ModifiedAt { get; set; }
    public ICollection<Book> Books { get; set; } = new List<Book>();
}