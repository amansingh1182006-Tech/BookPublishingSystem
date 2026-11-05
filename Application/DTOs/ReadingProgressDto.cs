using System;

namespace Application.DTOs
{
    public class ReadingProgressDto
    {
        public Guid BookId { get; set; }
        public int LastReadPage { get; set; }
        public int TotalPages { get; set; }
    }
}