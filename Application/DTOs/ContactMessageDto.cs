using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text;

namespace Application.DTOs
{
    public class CreateContactMessageDto
    {
        [Required(ErrorMessage = "Name is required")]
        public string SenderName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Email is required")]
        [EmailAddress(ErrorMessage = "Invalid email format")]
        public string EmailAddress { get; set; } = string.Empty;

        [Required(ErrorMessage = "Category is required")]
        public string InquiryCategory { get; set; } = string.Empty;

        [Required(ErrorMessage = "Message is required")]
        public string MessageText { get; set; } = string.Empty;
    }

    public class ContactMessageResponseDto
    {
        public Guid Id { get; set; }
        public string SenderName { get; set; } = string.Empty;
        public string EmailAddress { get; set; } = string.Empty;
        public string InquiryCategory { get; set; } = string.Empty;
        public string MessageText { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }
}
