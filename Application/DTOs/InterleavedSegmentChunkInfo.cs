using System;

namespace Application.DTOs
{
    public class InterleavedSegmentChunkInfo
    {
        public Guid ChunkId { get; set; }
        public Guid? ParentChunkId { get; set; }
        public string StorageRelativePath { get; set; } = string.Empty;
        public string TableTarget { get; set; } = "Alpha";

        public string PageIndices { get; set; }
    }
}