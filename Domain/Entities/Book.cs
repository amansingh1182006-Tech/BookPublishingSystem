namespace BookPublishingSystem.Domain.Entities;

public class Book
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string ItemNo { get; set; } = string.Empty;
    public string ISBN { get; set; } = string.Empty;
    public string ItemName { get; set; } = string.Empty; 
    public string CategoryCode { get; set; } = string.Empty;
    public int NoOfPages { get; set; }
    public Guid? AuthorMasterId { get; set; }
    public Author? AuthorMaster { get; set; }

    public Guid? LanguageMasterId { get; set; }
    public Language? LanguageMaster { get; set; }
    public string Language { get; set; } = "English";
    public string Description { get; set; } = string.Empty;
    public string CoverImagePath { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string AuthorId { get; set; } = string.Empty; 
    public ApplicationUser Author { get; set; } = null!;
    public bool IsPublished { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public virtual ICollection<BookSegmentAlpha> BookSegmentsAlpha { get; set; } = new List<BookSegmentAlpha>();
    public virtual ICollection<BookSegmentBeta> BookSegmentsBeta { get; set; } = new List<BookSegmentBeta>();
    public virtual ICollection<BookSegmentGamma> BookSegmentsGamma { get; set; } = new List<BookSegmentGamma>();
}