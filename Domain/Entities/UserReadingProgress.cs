using BookPublishingSystem.Domain.Entities;
using System;

namespace Domain.Entities
{
    public class UserReadingProgress
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string UserId { get; set; } = string.Empty;
        public Guid BookId { get; set; }
        public int LastReadPage { get; set; } = 1;
        public int TotalPages { get; set; } = 1;
        public DateTime LastReadAt { get; set; } = DateTime.UtcNow;

        // Navigation Property
        public virtual Book? Book { get; set; }
    }
}