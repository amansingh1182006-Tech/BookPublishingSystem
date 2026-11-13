using Microsoft.AspNetCore.Http;
using System.ComponentModel.DataAnnotations;

namespace Application.DTOs
{
    public class BookUploadDto
    {
        [Required(ErrorMessage = "Item No is required")]
        public string ItemNo { get; set; } = string.Empty;

        public string? ISBN { get; set; }

        [Required(ErrorMessage = "Item Name is required")]
        public string ItemName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Category Code is required")]
        public string CategoryCode { get; set; } = string.Empty;

        [Range(1, 10000, ErrorMessage = "No of Pages must be at least 1")]
        public int NoOfPages { get; set; } = 1;

        public string? VendorName { get; set; }
        public string? AuthorName { get; set; }

        
        public string? AuthorId { get; set; }

        public string? Language { get; set; } = "English";

        public string? Description { get; set; }

        [Range(0, 999999.99, ErrorMessage = "Price must be a positive value")]
        public decimal Price { get; set; }

        public IFormFile? CoverImage { get; set; }

        [Required(ErrorMessage = "Main Book PDF file is required")]
        public IFormFile MainPdf { get; set; } = null!;
    }

    public class BookUpdateDto
    {
        public string ItemName { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public int NoOfPages { get; set; } = 1;
        public string? Language { get; set; } = "English";
        public string? CategoryCode { get; set; }
        public string? Description { get; set; }
        public string? AuthorName { get; set; }
        public string? AuthorId { get; set; }
        public IFormFile? CoverImage { get; set; }
        public IFormFile? MainPdf { get; set; }
    }
}