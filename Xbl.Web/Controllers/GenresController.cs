using Microsoft.AspNetCore.Mvc;
using Xbl.Web.Data;
using Xbl.Web.Models;

namespace Xbl.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GenresController(IRatingsContext ratings) : ControllerBase
{
    public record GenreRequest(string Name);

    [HttpGet]
    public async Task<IEnumerable<GenreSummary>> Get() => await ratings.GetGenresAsync();

    [HttpPost]
    public async Task<ActionResult<GenreRef>> Post([FromBody] GenreRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) return BadRequest("Genre name is required.");
        return await ratings.CreateOrGetGenreAsync(request.Name);
    }

    [HttpDelete("{genreId:int}")]
    public async Task<IActionResult> Delete(int genreId)
    {
        await ratings.DeleteGenreAsync(genreId);
        return NoContent();
    }

    [HttpPut("{genreId:int}/games/{source}/{titleId}")]
    public async Task<IActionResult> AssignGame(int genreId, string source, string titleId)
    {
        await ratings.AssignGenreAsync(genreId, source, titleId);
        return NoContent();
    }

    [HttpDelete("{genreId:int}/games/{source}/{titleId}")]
    public async Task<IActionResult> UnassignGame(int genreId, string source, string titleId)
    {
        await ratings.UnassignGenreAsync(genreId, source, titleId);
        return NoContent();
    }
}
