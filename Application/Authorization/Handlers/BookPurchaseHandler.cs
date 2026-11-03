using Application.Authorization.Requirements;
using Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Application.Authorization.Handlers
{
    public class BookPurchaseHandler : AuthorizationHandler<BookPurchaseRequirement, Guid>
    {
        private readonly IApplicationDbContext _context;

        public BookPurchaseHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, BookPurchaseRequirement requirement, Guid bookId)
        {
            var userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (string.IsNullOrEmpty(userId)) return;

            var hasPurchased = await _context.Customers
                .AsQueryable()
                .AnyAsync(p => p.UserId == userId && p.BookId == bookId);

            if (hasPurchased)
            {
                context.Succeed(requirement);
            }
        }
    }
}