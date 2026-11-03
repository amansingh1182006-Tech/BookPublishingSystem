namespace Application.DTOs;

public class UserProfileDto
{
    public string UserId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public DateTime JoinedDate { get; set; }
}

public class PurchaseReportDto
{
    public Guid PurchaseId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string UserEmail { get; set; } = string.Empty;
    public string BookTitle { get; set; } = string.Empty;
    public string PlanType { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public DateTime Date { get; set; }
}

public class AdminDashboardDto
{
    public List<UserProfileDto> Users { get; set; } = new();
    public List<PurchaseReportDto> Purchases { get; set; } = new();
}