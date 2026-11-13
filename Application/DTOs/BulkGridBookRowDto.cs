using Microsoft.AspNetCore.Http;
using System;
using System.Collections.Generic;
using System.Text;

namespace Application.DTOs
{
    public class BulkGridUploadRequest
    {
        public List<BulkGridBookRowDto> Books { get; set; } = new List<BulkGridBookRowDto>();
    }

    public class BulkGridBookRowDto
    {
        public string? ItemNo { get; set; }
        public string? ISBN { get; set; }
        public string ItemName { get; set; } = string.Empty;
        public string? CategoryCode { get; set; }
        public string? VendorName { get; set; }
        public string? AuthorName { get; set; }
        public string? Language { get; set; }
        public decimal Price { get; set; }
        public int NoOfPages { get; set; }
        public IFormFile? MainPdf { get; set; }
        public IFormFile? CoverImage { get; set; }
    }
}
