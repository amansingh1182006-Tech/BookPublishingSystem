namespace Web.Models
{
    public class SecureReaderViewModel
    {
        public Guid BookId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string StreamUrl { get; set; } = string.Empty;
        public string WatermarkText { get; set; } = string.Empty;
        public bool IsAuthorized { get; set; }
    }
}
