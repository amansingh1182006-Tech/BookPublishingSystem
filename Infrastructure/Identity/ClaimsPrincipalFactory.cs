using BookPublishingSystem.Domain.Entities;
using Domain.Constants;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using System.Security.Claims;
using System.Threading.Tasks;

namespace Infrastructure.Identity
{
    public class CustomClaimsPrincipalFactory : UserClaimsPrincipalFactory<ApplicationUser, ApplicationRole>
    {
        public CustomClaimsPrincipalFactory(
            UserManager<ApplicationUser> userManager,
            RoleManager<ApplicationRole> roleManager,
            IOptions<IdentityOptions> optionsAccessor)
            : base(userManager, roleManager, optionsAccessor)
        {
        }

        protected override async Task<ClaimsIdentity> GenerateClaimsAsync(ApplicationUser user)
        {
            var identity = new ClaimsIdentity(
                IdentityConstants.ApplicationScheme,
                Options.ClaimsIdentity.UserNameClaimType,
                Options.ClaimsIdentity.RoleClaimType);

            identity.AddClaim(new Claim(Options.ClaimsIdentity.UserIdClaimType, user.Id));
            identity.AddClaim(new Claim(Options.ClaimsIdentity.UserNameClaimType, user.UserName ?? user.Email ?? string.Empty));

            if (Options.ClaimsIdentity.UserIdClaimType != ClaimTypes.NameIdentifier)
            {
                identity.AddClaim(new Claim(ClaimTypes.NameIdentifier, user.Id));
            }

            if (!string.IsNullOrEmpty(user.Email))
            {
                identity.AddClaim(new Claim(Options.ClaimsIdentity.EmailClaimType, user.Email));
                if (Options.ClaimsIdentity.EmailClaimType != ClaimTypes.Email)
                {
                    identity.AddClaim(new Claim(ClaimTypes.Email, user.Email));
                }
            }
            else
            {
                identity.AddClaim(new Claim(ClaimTypes.Email, string.Empty));
            }

            if (UserManager.SupportsUserSecurityStamp)
            {
                var stamp = await UserManager.GetSecurityStampAsync(user);
                if (!string.IsNullOrEmpty(stamp))
                {
                    identity.AddClaim(new Claim(Options.ClaimsIdentity.SecurityStampClaimType, stamp));
                }
            }

            if (UserManager.SupportsUserRole)
            {
                var roles = await UserManager.GetRolesAsync(user);
                foreach (var roleName in roles)
                {
                    identity.AddClaim(new Claim(Options.ClaimsIdentity.RoleClaimType, roleName));
                }
            }

            identity.AddClaim(new Claim("FullName", user.FullName ?? string.Empty));
            identity.AddClaim(new Claim(CustomClaims.AuthorId, user.Id));

            return identity;
        }
    }
}