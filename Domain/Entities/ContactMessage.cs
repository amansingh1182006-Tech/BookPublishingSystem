using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text;

namespace Domain.Entities
{
    public class ContactMessage
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [MaxLength(150)]
        public string SenderName { get; set; } = string.Empty;

        [Required]
        [MaxLength(150)]
        public string EmailAddress { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string InquiryCategory { get; set; } = string.Empty;

        [Required]
        public string MessageText { get; set; } = string.Empty;

        [MaxLength(50)]
        public string Status { get; set; } = "Unread"; 

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
