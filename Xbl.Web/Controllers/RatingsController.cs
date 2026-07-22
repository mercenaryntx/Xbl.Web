using Microsoft.AspNetCore.Mvc;
using Xbl.Web.Data;

namespace Xbl.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RatingsController(IRatingsContext ratings) : ControllerBase
{
    public record RatingRequest(int Value);

    [HttpPut("{source}/{titleId}")]
    public async Task<IActionResult> Put(string source, string titleId, [FromBody] RatingRequest request)
    {
        if (request.Value is < 1 or > 10)
            return BadRequest("Rating value must be between 1 and 10 (half-star units).");

        await ratings.UpsertRatingAsync(source, titleId, request.Value);
        return NoContent();
    }

    [HttpDelete("{source}/{titleId}")]
    public async Task<IActionResult> Delete(string source, string titleId)
    {
        await ratings.DeleteRatingAsync(source, titleId);
        return NoContent();
    }
}
