using AutoMapper;
using Microsoft.AspNetCore.Mvc;
using Xbl.Client;
using Xbl.Client.Io;
using Xbl.Client.Models.Xbl.Player;
using Xbl.Data;
using Xbl.Web.Data;
using Xbl.Web.Models;

namespace Xbl.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TitlesController : ControllerBase
{
    private readonly IDatabaseContext _x360;
    private readonly IMapper _mapper;
    private readonly IXblClient _xbl;
    private readonly ILogger<TitlesController> _logger;
    private readonly IDatabaseContext _live;
    private readonly IRatingsContext _ratings;

    private const string LastUpdateHeader = "X-Titles-Last-Update";
    private const string TitleSelector = """
                                         SELECT 
                                           json_extract(Data, '$.titleId') as TitleId,
                                           json_extract(Data, '$.name') AS Name, 
                                           json_extract(Data, '$.displayImage') AS DisplayImage, 
                                           json_extract(Data, '$.achievement.currentAchievements') AS CurrentAchievements, 
                                           json_extract(Data, '$.achievement.totalAchievements') AS TotalAchievements, 
                                           json_extract(Data, '$.achievement.currentGamerscore') AS CurrentGamerscore, 
                                           json_extract(Data, '$.achievement.totalGamerscore') AS TotalGamerscore, 
                                           json_extract(Data, '$.achievement.progressPercentage') AS ProgressPercentage, 
                                           json_extract(Data, '$.titleHistory.lastTimePlayed') AS LastTimePlayed
                                         FROM title
                                         """;

    public TitlesController(
        [FromKeyedServices(DataSource.Live)] IDatabaseContext live,
        [FromKeyedServices(DataSource.Xbox360)] IDatabaseContext x360,
        IMapper mapper,
        ILogger<TitlesController> logger,
        IRatingsContext ratings)
    {
        _mapper = mapper;
        _logger = logger;
        _live = live.Mandatory();
        _x360 = x360.Mandatory();
        _ratings = ratings;
    }

    [HttpGet("{source}")]
    [ResponseCache(Duration = 3600, VaryByQueryKeys = ["title", "orderBy", "orderDir", "page", "genre"], VaryByHeader = LastUpdateHeader)]
    public async Task<IEnumerable<Title>> Get(
        string source,
        [FromQuery] string title = "",
        [FromQuery] string orderBy = "lastPlayed",
        [FromQuery] string orderDir = "DESC",
        [FromQuery] int page = 0,
        [FromQuery] int? genre = null)
    {
        const int limit = 50;
        var db = source switch
        {
            "live" => _live,
            "x360" => _x360,
            _ => null
        };
        if (db is null) return [];

        var where = "WHERE json_extract(Data, '$.achievement.totalGamerscore') > 0";
        if (!string.IsNullOrEmpty(title)) where += " AND json_extract(Data, '$.name') LIKE @Title";

        List<string> genreTitleIds = null;
        if (genre is not null)
        {
            genreTitleIds = (await _ratings.GetTitleIdsByGenreAsync(source, genre.Value)).ToList();
            if (genreTitleIds.Count == 0) return [];
            where += " AND json_extract(Data, '$.titleId') IN @GenreTitleIds";
        }

        List<Title> results;
        if (orderBy == "rating")
        {
            var idQuery = $"SELECT json_extract(Data, '$.titleId') FROM title {where}";
            var allIds = (await db.Query<string>(idQuery, new { Title = $"%{title}%", GenreTitleIds = genreTitleIds })).ToList();
            var ratingsMap = await _ratings.GetRatingsMapAsync(source);

            var unrated = allIds.Where(id => !ratingsMap.ContainsKey(id));
            var rated = allIds.Where(ratingsMap.ContainsKey);
            rated = orderDir.Equals("ASC", StringComparison.OrdinalIgnoreCase)
                ? rated.OrderBy(id => ratingsMap[id])
                : rated.OrderByDescending(id => ratingsMap[id]);
            // Unrated titles have no meaningful position on a rating sort, so they always sort last.
            var pageIds = rated.Concat(unrated).Skip(page * limit).Take(limit).ToList();
            if (pageIds.Count == 0) return [];

            var rows = (await db.Query<Title>(
                    $"{TitleSelector} WHERE json_extract(Data, '$.titleId') IN @PageIds",
                    new { PageIds = pageIds }))
                .ToDictionary(t => t.TitleId);
            results = pageIds.Where(rows.ContainsKey).Select(id => rows[id]).ToList();

            await HydrateRatingsAndGenres(results, source, ratingsMap);
        }
        else
        {
            var sqlOrderBy = orderBy switch
            {
                "name" => "$.name",
                "lastPlayed" => "$.titleHistory.lastTimePlayed",
                "progress" => "$.achievement.progressPercentage",
                _ => "$.titleHistory.lastTimePlayed"
            };
            var query = $"{TitleSelector} {where} ORDER BY json_extract(Data, @OrderBy) {orderDir} LIMIT @Limit OFFSET @Offset";
            var p = new { Limit = limit, Offset = page * limit, OrderBy = sqlOrderBy, Title = $"%{title}%", GenreTitleIds = genreTitleIds };
            results = (await db.Query<Title>(query, p)).ToList();

            await HydrateRatingsAndGenres(results, source, null);
        }

        return results;
    }

    private async Task HydrateRatingsAndGenres(List<Title> titles, string source, Dictionary<string, int> ratingsMap)
    {
        if (titles.Count == 0) return;
        var ids = titles.Select(t => t.TitleId).ToList();
        ratingsMap ??= await _ratings.GetRatingsMapAsync(source, ids);
        var genreMap = await _ratings.GetGenreMapAsync(source, ids);
        foreach (var t in titles)
        {
            if (ratingsMap.TryGetValue(t.TitleId, out var value)) t.Rating = value;
            if (genreMap.TryGetValue(t.TitleId, out var genres)) t.Genres = genres;
        }
    }

    [HttpGet("{source}/{titleId}")]
    [ResponseCache(Duration = 3600, VaryByHeader = LastUpdateHeader)]
    public async Task<TitleDetail> Get(string source, int titleId)
    {
        var repo = source switch
        {
            "live" => _live,
            "x360" => _x360,
            _ => throw new InvalidOperationException()
        };

        var achievements = await repo.GetRepository<Client.Models.Xbl.Achievements.Achievement>();

        var tt = repo.Query<TitleDetail>($"{TitleSelector} WHERE Id = {titleId}");
        var at = achievements.GetPartition(titleId);

        await Task.WhenAll(tt, at);

        var t = tt.Result.First();
        var a = at.Result;

        t.Achievements = _mapper.Map<Achievement[]>(a.OrderByDescending(aa => aa.TimeUnlocked));

        if (source == "live")
        {
            var stats = await repo.GetRepository<Stat>();
            var s = await stats.Get(titleId);
            t.Minutes = s?.IntValue;
        }
        return t;
    }

    [HttpGet("{source}/{titleId}/statdelta")]
    public async Task<IEnumerable<StatDeltaEntry>> GetStatDelta(string source, int titleId)
    {
        if (source != "live") return [];
        var rows = await _live.Query<StatDeltaEntry>(
            "SELECT UpdatedOn, json_extract(Data, '$.minutes') AS Minutes FROM statdelta WHERE PartitionKey = @TitleId ORDER BY UpdatedOn ASC",
            new { TitleId = titleId });
        return rows;
    }

    [HttpOptions]
    public async Task<IActionResult> Options()
    {
        var lastUpdate = await _live.Query<DateTime>("SELECT json_extract(Data, '$.titleHistory.lastTimePlayed') FROM title ORDER BY json_extract(Data, '$.titleHistory.lastTimePlayed') DESC LIMIT 1");
        var ratingsUpdatedOn = await _ratings.GetMaxUpdatedOnAsync();
        var lastGameUpdate = lastUpdate.Single();
        var combined = ratingsUpdatedOn is { } r && r > lastGameUpdate ? r : lastGameUpdate;
        Response.Headers[LastUpdateHeader] = combined.ToString("o");
        return NoContent();
    }
}