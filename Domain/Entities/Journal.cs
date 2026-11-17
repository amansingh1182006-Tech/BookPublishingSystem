using System;
using System.ComponentModel.DataAnnotations;

namespace BookPublishingSystem.Domain.Entities
{
    public class Journal
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [MaxLength(50)]
        public string JournalCode { get; set; } = string.Empty;

        [Required]
        [MaxLength(250)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(200)]
        public string PublisherName { get; set; } = string.Empty;

        [Required]
        public DateTime PublishDate { get; set; } = DateTime.UtcNow;

        [MaxLength(50)]
        public string? ISSN { get; set; }

        [MaxLength(100)]
        public string? VolumeIssue { get; set; }

        [MaxLength(50)]
        public string Frequency { get; set; } = "Quarterly";

        [MaxLength(100)]
        public string CategoryCode { get; set; } = "HOMEO";

        [MaxLength(50)]
        public string Language { get; set; } = "English";

        [MaxLength(1000)]
        public string? Description { get; set; }

        [MaxLength(500)]
        public string CoverImagePath { get; set; } = "/images/default-cover.png";
        [MaxLength(500)]
        public string? PdfFilePath { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ModifiedAt { get; set; }
    }
}