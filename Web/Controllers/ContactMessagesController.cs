using Application.DTOs;
using Domain.Entities;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;

namespace Web.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ContactMessagesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ContactMessagesController(ApplicationDbContext context)
        {
            _context = context;
        }
        [HttpGet]
        public ActionResult<IEnumerable<ContactMessageResponseDto>> GetAllMessages()
        {
            var messages = _context.ContactMessages
                .OrderByDescending(m => m.CreatedAt)
                .Select(m => new ContactMessageResponseDto
                {
                    Id = m.Id,
                    SenderName = m.SenderName,
                    EmailAddress = m.EmailAddress,
                    InquiryCategory = m.InquiryCategory,
                    MessageText = m.MessageText,
                    Status = m.Status,
                    CreatedAt = m.CreatedAt
                })
                .ToList();

            return Ok(messages);
        }
        [HttpPost]
        public async Task<IActionResult> SubmitMessage([FromBody] CreateContactMessageDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var entity = new ContactMessage
            {
                Id = Guid.NewGuid(),
                SenderName = dto.SenderName.Trim(),
                EmailAddress = dto.EmailAddress.Trim(),
                InquiryCategory = dto.InquiryCategory.Trim(),
                MessageText = dto.MessageText.Trim(),
                Status = "Unread",
                CreatedAt = DateTime.UtcNow
            };

            _context.ContactMessages.Add(entity);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Your message has been received. Our support team will contact you soon!", id = entity.Id });
        }
        [HttpPut("{id}/resolve")]
        public async Task<IActionResult> MarkAsResolved(Guid id)
        {
            var msg = await _context.ContactMessages.FindAsync(id);
            if (msg == null) return NotFound();

            msg.Status = msg.Status == "Resolved" ? "Unread" : "Resolved";
            await _context.SaveChangesAsync();

            return Ok(new { status = msg.Status });
        }
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteMessage(Guid id)
        {
            var msg = await _context.ContactMessages.FindAsync(id);
            if (msg == null) return NotFound();

            _context.ContactMessages.Remove(msg);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Deleted successfully" });
        }
    }
}
