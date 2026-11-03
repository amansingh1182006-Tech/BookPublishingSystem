namespace BookPublishingSystem.Application.DTOs;

public class CategoryCreateDto
{
    public string CategoryCode { get; set; } = string.Empty;
    public string CategoryName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}