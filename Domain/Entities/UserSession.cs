using BookPublishingSystem.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Text;

namespace Domain.Entities
{
    public class UserSession
    {
        public int Id { get; set; }
        public string UserId { get; set; } = string.Empty;
        public string SessionToken { get; set; } = string.Empty;
        public string? IpAddress { get; set; }
        public DateTime LoginTime { get; set; } = DateTime.UtcNow;
        public DateTime LastActiveTime { get; set; } = DateTime.UtcNow;
        public bool IsActive { get; set; } = true;

        public virtual ApplicationUser? User { get; set; }
    }
}
