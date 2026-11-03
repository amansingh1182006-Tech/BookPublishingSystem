using System;

namespace BookPublishingSystem.Domain.Entities
{
    public class BookSegmentAlpha
    {
        public Guid Id { get; set; }
        public Guid BookId { get; set; }
        public Guid? ParentChunkId { get; set; }
        public string StorageRelativePath { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public virtual Book Book { get; set; } = null!;
    }

    public class BookSegmentBeta
    {
        public Guid Id { get; set; }
        public Guid BookId { get; set; }
        public Guid? ParentChunkId { get; set; }
        public string StorageRelativePath { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public virtual Book Book { get; set; } = null!;
    }

    public class BookSegmentGamma
    {
        public Guid Id { get; set; }
        public Guid BookId { get; set; }
        public Guid? ParentChunkId { get; set; }
        public string StorageRelativePath { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public virtual Book Book { get; set; } = null!;
    }
}