using System;

namespace Application.DTOs
{
    public class SegmentNode
    {
        public Guid Id { get; set; }
        public Guid? ParentId { get; set; }
        public string Path { get; set; } = string.Empty;

        public string PageIndices { get; set; }
    }
}