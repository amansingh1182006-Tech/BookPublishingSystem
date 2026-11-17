using Microsoft.AspNetCore.Http;
using System;

namespace Application.DTOs
{
    public class JournalFormDto
    {
        public string? JournalCode { get; set; }
        public string Name { get; set; } = string.Empty;
        public string PublisherName { get; set; } = string.Empty;
        public DateTime PublishDate { get; set; } = DateTime.UtcNow;
        public string? ISSN { get; set; }
        public string? VolumeIssue { get; set; }
        public string? Frequency { get; set; }
        public string? CategoryCode { get; set; }
        public string? Language { get; set; }
        public string? Description { get; set; }
        public bool IsActive { get; set; } = true;
        public IFormFile? CoverImage { get; set; }
        public IFormFile? JournalPdf { get; set; }
    }

    public class BulkJournalRowDto
    {
        public string Name { get; set; } = string.Empty;
        public string PublisherName { get; set; } = string.Empty;
        public DateTime PublishDate { get; set; } = DateTime.UtcNow;
        public string? ISSN { get; set; }
        public string? VolumeIssue { get; set; }
        public string? Frequency { get; set; }
        public string? Language { get; set; }
    }
}