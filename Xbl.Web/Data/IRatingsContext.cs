using Xbl.Web.Models;

namespace Xbl.Web.Data;

public interface IRatingsContext
{
    Task<Dictionary<string, int>> GetRatingsMapAsync(string source, IEnumerable<string> titleIds = null);
    Task UpsertRatingAsync(string source, string titleId, int value);
    Task DeleteRatingAsync(string source, string titleId);

    Task<IEnumerable<GenreSummary>> GetGenresAsync();
    Task<GenreRef> CreateOrGetGenreAsync(string name);
    Task<GenreRef> RenameGenreAsync(int genreId, string name);
    Task DeleteGenreAsync(int genreId);

    Task AssignGenreAsync(int genreId, string source, string titleId);
    Task UnassignGenreAsync(int genreId, string source, string titleId);
    Task<Dictionary<string, List<GenreRef>>> GetGenreMapAsync(string source, IEnumerable<string> titleIds = null);
    Task<HashSet<string>> GetTitleIdsByGenreAsync(string source, int genreId);

    Task<DateTime?> GetMaxUpdatedOnAsync();
}
