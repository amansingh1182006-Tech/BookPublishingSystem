using Application.Authorization.Requirements;
using BookPublishingSystem.Domain.Entities;
using Domain.Constants;

using Microsoft.AspNetCore.Authorization;

namespace Application.Authorization.Handlers
{
    public class AuthorOwnershipHandler : AuthorizationHandler<AuthorOwnershipRequirement, Book>
    {
        protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, AuthorOwnershipRequirement requirement, Book resource)   
        {
            var userIdClaim = context.User.FindFirst(CustomClaims.AuthorId)?.Value
                              ?? context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

            if (userIdClaim != null && resource.AuthorId == userIdClaim)
            {
                context.Succeed(requirement);
            }

            return Task.CompletedTask;
        }
    }
}