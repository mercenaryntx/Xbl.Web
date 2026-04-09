using Microsoft.AspNetCore.Mvc;
using Xbl.Client;
using Xbl.Data;
using Xbl.Web.Models.Story;

namespace Xbl.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StoryController : ControllerBase
{
    private readonly IDatabaseContext _live;
    private readonly IDatabaseContext _x360;

    // Corrects x360 achievement unlock dates:
    // - If unlock date < game release date, use release date instead
    // - Result cannot be earlier than 2009-02-01
    private const string X360CorrectedDate = """
        CASE
          WHEN json_extract(t.Data, '$.products.Xbox360.ReleaseDate') IS NOT NULL
               AND json_extract(a.Data, '$.timeUnlocked') < json_extract(t.Data, '$.products.Xbox360.ReleaseDate')
          THEN
            CASE
              WHEN json_extract(t.Data, '$.products.Xbox360.ReleaseDate') >= '2009-02-01'
              THEN json_extract(t.Data, '$.products.Xbox360.ReleaseDate')
              ELSE '2009-02-01T00:00:00'
            END
          WHEN json_extract(a.Data, '$.timeUnlocked') < '2009-02-01'
          THEN '2009-02-01T00:00:00'
          ELSE json_extract(a.Data, '$.timeUnlocked')
        END
        """;

    public StoryController(
        [FromKeyedServices(DataSource.Live)] IDatabaseContext live,
        [FromKeyedServices(DataSource.Xbox360)] IDatabaseContext x360)
    {
        _live = live.Mandatory();
        _x360 = x360.Mandatory();
    }

    [HttpGet]
    [ResponseCache(Duration = 3600)]
    public async Task<StoryResponse> Get()
    {
        // Issue 3: exclude demos (totalGamerscore = 0) from completed / total counts
        const string completedCountQuery = """
            SELECT COUNT(*) FROM title
            WHERE json_extract(Data, '$.achievement.progressPercentage') = 100
            AND json_extract(Data, '$.achievement.totalGamerscore') > 0
            """;

        const string totalGamesQuery = "SELECT COUNT(*) FROM title";

        const string liveAchSumQuery = """
            SELECT
                COALESCE(SUM(json_extract(Data, '$.achievement.currentAchievements')), 0) AS Unlocked,
                (SELECT COUNT(*) FROM achievement) AS Total
            FROM title
            """;

        const string x360AchSumQuery = """
            SELECT
                COALESCE(SUM(json_extract(Data, '$.achievement.currentAchievements')), 0) AS Unlocked,
                COALESCE(SUM(json_extract(Data, '$.achievement.totalAchievements')), 0) AS Total
            FROM title
            """;

        const string genresQuery = """
            SELECT
                json_extract(t.Data, '$.category') AS Genre,
                COALESCE(SUM(json_extract(s.Data, '$.IntValue')), 0) AS Minutes,
                COUNT(DISTINCT t.Id) AS GameCount
            FROM title t
            LEFT JOIN stat s ON s.Id = t.Id AND json_extract(s.Data, '$.name') = 'MinutesPlayed'
            WHERE json_extract(t.Data, '$.category') IS NOT NULL
            AND json_extract(t.Data, '$.category') != ''
            AND json_extract(t.Data, '$.category') != 'Other'
            AND json_extract(t.Data, '$.achievement.totalGamerscore') > 0
            GROUP BY json_extract(t.Data, '$.category')
            ORDER BY Minutes DESC, GameCount DESC
            LIMIT 10
            """;

        const string x360GenresQuery = """
            SELECT
                json_extract(Data, '$.category') AS Genre,
                COUNT(*) AS GameCount
            FROM title
            WHERE json_extract(Data, '$.category') IS NOT NULL
            AND json_extract(Data, '$.category') != ''
            AND json_extract(Data, '$.category') != 'Other'
            AND json_extract(Data, '$.achievement.totalGamerscore') > 0
            GROUP BY json_extract(Data, '$.category')
            """;

        const string liveActivityQuery = """
            SELECT
                date(json_extract(Data, '$.timeUnlocked')) AS Date,
                COUNT(*) AS Count
            FROM achievement
            WHERE json_extract(Data, '$.unlocked') = true
            AND json_extract(Data, '$.timeUnlocked') > '2000-01-01'
            GROUP BY date(json_extract(Data, '$.timeUnlocked'))
            ORDER BY Date ASC
            """;

        // Issue 4: x360 activity uses corrected dates to fix corrupted unlock timestamps
        var x360ActivityQuery = $"""
            WITH x AS (
                SELECT {X360CorrectedDate} AS CorrectedDate
                FROM achievement a
                JOIN title t ON a.PartitionKey = t.Id
                WHERE json_extract(a.Data, '$.unlocked') = true
            )
            SELECT date(CorrectedDate) AS Date, COUNT(*) AS Count
            FROM x
            WHERE CorrectedDate > '2000-01-01'
            GROUP BY date(CorrectedDate)
            ORDER BY Date ASC
            """;

        var x360StartQuery = $"""
            WITH x AS (
                SELECT {X360CorrectedDate} AS CorrectedDate
                FROM achievement a
                JOIN title t ON a.PartitionKey = t.Id
                WHERE json_extract(a.Data, '$.unlocked') = true
            )
            SELECT MIN(CorrectedDate) FROM x WHERE CorrectedDate > '2000-01-01'
            """;

        // Phase 1: run all global queries in parallel
        var tasks = new
        {
            X360Start = _x360.Query<string>(x360StartQuery),
            LiveStart = _live.Query<string>("SELECT MIN(json_extract(Data, '$.timeUnlocked')) FROM achievement WHERE json_extract(Data, '$.unlocked') = true AND json_extract(Data, '$.timeUnlocked') > '2000-01-01'"),
            SeriesStart = _live.Query<string>("""
                SELECT MIN(json_extract(a.Data, '$.timeUnlocked'))
                FROM achievement a
                JOIN title t ON a.PartitionKey = t.Id
                WHERE json_extract(a.Data, '$.unlocked') = true
                AND json_extract(a.Data, '$.timeUnlocked') > '2000-01-01'
                AND (json_extract(t.Data, '$.originalConsole') LIKE '%Series%'
                     OR json_extract(a.Data, '$.platform') LIKE '%Series%')
                """),
            LiveActivity = _live.Query<ActivityDay>(liveActivityQuery),
            X360Activity = _x360.Query<ActivityDay>(x360ActivityQuery),
            LiveCompleted = _live.Query<int>(completedCountQuery),
            X360Completed = _x360.Query<int>(completedCountQuery),
            LiveTotal = _live.Query<int>(totalGamesQuery),
            X360Total = _x360.Query<int>(totalGamesQuery),
            LiveAchSum = _live.Query<AchievementSum>(liveAchSumQuery),
            X360AchSum = _x360.Query<AchievementSum>(x360AchSumQuery),
            Genres = _live.Query<GenreData>(genresQuery),
            X360Genres = _x360.Query<X360GenreData>(x360GenresQuery),
        };

        await Task.WhenAll(
            tasks.X360Start, tasks.LiveStart, tasks.SeriesStart,
            tasks.LiveActivity, tasks.X360Activity,
            tasks.LiveCompleted, tasks.X360Completed,
            tasks.LiveTotal, tasks.X360Total,
            tasks.LiveAchSum, tasks.X360AchSum,
            tasks.Genres, tasks.X360Genres);

        var x360Start = ParseDate(tasks.X360Start.Result.FirstOrDefault());
        var liveStart = ParseDate(tasks.LiveStart.Result.FirstOrDefault());
        var seriesStart = ParseDate(tasks.SeriesStart.Result.FirstOrDefault());

        // Phase 2: build per-era timeline data (runs in parallel)
        var hasSeriesEra = seriesStart.HasValue &&
            (!liveStart.HasValue || seriesStart.Value > liveStart.Value.AddYears(1));
        var liveEraEnd = hasSeriesEra
            ? seriesStart!.Value.ToString("yyyy-MM-ddTHH:mm:ss")
            : null;

        Task<TimelinePoint>? x360Task = x360Start.HasValue
            ? BuildX360EraAsync(x360Start.Value)
            : null;
        Task<TimelinePoint>? liveTask = liveStart.HasValue
            ? BuildLiveEraAsync("Xbox One", liveStart.Value.ToString("yyyy-MM-ddTHH:mm:ss"), liveEraEnd, isSeriesEra: false)
            : null;
        Task<TimelinePoint>? seriesTask = hasSeriesEra
            ? BuildLiveEraAsync("Xbox Series X|S", seriesStart!.Value.ToString("yyyy-MM-ddTHH:mm:ss"), null, isSeriesEra: true)
            : null;

        var eraTasks = new[] { x360Task, liveTask, seriesTask }
            .Where(t => t != null)
            .Select(t => (Task)t!);
        await Task.WhenAll(eraTasks);

        var timeline = new List<TimelinePoint>();
        if (x360Task != null) timeline.Add(x360Task.Result);
        if (liveTask != null) timeline.Add(liveTask.Result);
        if (seriesTask != null) timeline.Add(seriesTask.Result);

        // Merge activity calendars
        var mergedActivity = tasks.LiveActivity.Result
            .Concat(tasks.X360Activity.Result)
            .GroupBy(a => a.Date)
            .Select(g => new ActivityDay { Date = g.Key, Count = g.Sum(a => a.Count) })
            .OrderBy(a => a.Date)
            .ToList();

        var bestDay = mergedActivity.Count > 0 ? mergedActivity.MaxBy(a => a.Count) : null;
        var bestMonth = mergedActivity.Count > 0
            ? mergedActivity
                .GroupBy(a => a.Date[..7])
                .Select(g => new ActivityDay { Date = g.Key, Count = g.Sum(a => a.Count) })
                .MaxBy(b => b.Count)
            : null;
        var bestYear = mergedActivity.Count > 0
            ? mergedActivity
                .GroupBy(a => a.Date[..4])
                .Select(g => new ActivityDay { Date = g.Key, Count = g.Sum(a => a.Count) })
                .MaxBy(b => b.Count)
            : null;
        var bestStreak = CalculateBestStreak(mergedActivity);

        var gamesCompleted = tasks.LiveCompleted.Result.Sum() + tasks.X360Completed.Result.Sum();
        var totalGames = tasks.LiveTotal.Result.Sum() + tasks.X360Total.Result.Sum();

        var liveSum = tasks.LiveAchSum.Result.FirstOrDefault() ?? new AchievementSum();
        var x360Sum = tasks.X360AchSum.Result.FirstOrDefault() ?? new AchievementSum();
        var totalUnlocked = liveSum.Unlocked + x360Sum.Unlocked;
        var totalAvailable = liveSum.Total + x360Sum.Total;
        var completionPercentage = totalAvailable > 0
            ? Math.Round((double)totalUnlocked / totalAvailable * 100, 1)
            : 0;

        var demosPlayed = await GetDemosPlayed();

        var mergedGenres = MergeGenres(
            tasks.Genres.Result.ToList(),
            tasks.X360Genres.Result.ToList());

        var calendarStartYear = mergedActivity.Count > 0
            ? int.Parse(mergedActivity[0].Date[..4])
            : DateTime.UtcNow.Year;
        var calendarEndYear = mergedActivity.Count > 0
            ? int.Parse(mergedActivity[^1].Date[..4])
            : DateTime.UtcNow.Year;

        return new StoryResponse
        {
            Timeline = timeline,
            ActivityCalendar = mergedActivity,
            CalendarStartYear = calendarStartYear,
            CalendarEndYear = calendarEndYear,
            BestDay = bestDay,
            BestMonth = bestMonth,
            BestYear = bestYear,
            BestStreak = bestStreak,
            GamesCompleted = gamesCompleted,
            TotalGames = totalGames,
            DemosPlayed = demosPlayed,
            CompletionPercentage = completionPercentage,
            TopGenres = mergedGenres
        };
    }

    // Builds the Xbox 360 era timeline point using the x360 database.
    // Applies date fix to correct corrupted unlock timestamps.
    private async Task<TimelinePoint> BuildX360EraAsync(DateTime startDate)
    {
        const string eraStatsQuery = """
            SELECT
                COALESCE(SUM(json_extract(Data, '$.achievement.currentGamerscore')), 0) AS Gamerscore,
                COALESCE(SUM(json_extract(Data, '$.achievement.currentAchievements')), 0) AS AchievementsUnlocked,
                COUNT(*) AS GamesPlayed
            FROM title
            """;

        var firstAchQuery = $"""
            WITH x AS (
                SELECT
                    json_extract(a.Data, '$.name') AS Name,
                    json_extract(a.Data, '$.description') AS Description,
                    json_extract(a.Data, '$.displayImage') AS Icon,
                    json_extract(t.Data, '$.displayImage') AS GameImage,
                    json_extract(t.Data, '$.name') AS GameName,
                    json_extract(a.Data, '$.gamerscore') AS Gamerscore,
                    json_extract(t.Data, '$.titleId') AS TitleId,
                    json_extract(a.Data, '$.id') AS AchievementId,
                    {X360CorrectedDate} AS TimeUnlocked
                FROM achievement a
                JOIN title t ON a.PartitionKey = t.Id
                WHERE json_extract(a.Data, '$.unlocked') = true
            )
            SELECT * FROM x WHERE TimeUnlocked > '2000-01-01' ORDER BY TimeUnlocked ASC LIMIT 1
            """;

        var firstCompQuery = $"""
            WITH x AS (
                SELECT
                    t.Id AS DbId,
                    json_extract(t.Data, '$.titleId') AS TitleId,
                    json_extract(t.Data, '$.displayImage') AS GameImage,
                    json_extract(t.Data, '$.name') AS GameName,
                    json_extract(t.Data, '$.achievement.progressPercentage') AS ProgressPct,
                    json_extract(t.Data, '$.achievement.totalGamerscore') AS TotalGs,
                    {X360CorrectedDate} AS CorrectedDate
                FROM achievement a
                JOIN title t ON a.PartitionKey = t.Id
                WHERE json_extract(a.Data, '$.unlocked') = true
            )
            SELECT TitleId, GameImage, GameName, MAX(CorrectedDate) AS CompletionDate
            FROM x
            WHERE CorrectedDate > '2000-01-01' AND ProgressPct = 100 AND TotalGs > 0
            GROUP BY DbId
            ORDER BY CompletionDate ASC
            LIMIT 1
            """;

        var statsTask = _x360.Query<EraStats>(eraStatsQuery);
        var firstAchTask = _x360.Query<StoryAchievementData>(firstAchQuery);
        var firstCompTask = _x360.Query<StoryGameData>(firstCompQuery);

        await Task.WhenAll(statsTask, firstAchTask, firstCompTask);

        var stats = statsTask.Result.FirstOrDefault() ?? new EraStats();
        return new TimelinePoint
        {
            Label = "Xbox 360",
            StartDate = startDate.ToString("yyyy-MM-dd"),
            Gamerscore = stats.Gamerscore,
            AchievementsUnlocked = stats.AchievementsUnlocked,
            GamesPlayed = stats.GamesPlayed,
            FirstAchievement = firstAchTask.Result.FirstOrDefault(),
            FirstCompletion = firstCompTask.Result.FirstOrDefault(),
        };
    }

    // Builds a live (Xbox One / Xbox Series) era timeline point.
    // Date range is [startDate, endDate). endDate == null means no upper bound.
    private async Task<TimelinePoint> BuildLiveEraAsync(
        string label, string startDate, string? endDate, bool isSeriesEra)
    {
        var p = new { start = startDate, end = endDate };

        var eraStatsQuery = isSeriesEra
            ? """
              SELECT
                  COALESCE(SUM(json_extract(Data, '$.achievement.currentGamerscore')), 0) AS Gamerscore,
                  COALESCE(SUM(json_extract(Data, '$.achievement.currentAchievements')), 0) AS AchievementsUnlocked,
                  COUNT(*) AS GamesPlayed
              FROM title
              WHERE json_extract(Data, '$.originalConsole') LIKE '%Series%'
              """
            : """
              SELECT
                  COALESCE(SUM(json_extract(Data, '$.achievement.currentGamerscore')), 0) AS Gamerscore,
                  COALESCE(SUM(json_extract(Data, '$.achievement.currentAchievements')), 0) AS AchievementsUnlocked,
                  COUNT(*) AS GamesPlayed
              FROM title
              WHERE (json_extract(Data, '$.originalConsole') IS NULL
                     OR json_extract(Data, '$.originalConsole') NOT LIKE '%Series%')
              """;

        const string firstAchQuery = """
            SELECT
                json_extract(a.Data, '$.name') AS Name,
                json_extract(a.Data, '$.description') AS Description,
                json_extract(a.Data, '$.displayImage') AS Icon,
                json_extract(t.Data, '$.displayImage') AS GameImage,
                json_extract(t.Data, '$.name') AS GameName,
                json_extract(a.Data, '$.timeUnlocked') AS TimeUnlocked,
                json_extract(a.Data, '$.gamerscore') AS Gamerscore,
                json_extract(t.Data, '$.titleId') AS TitleId,
                json_extract(a.Data, '$.id') AS AchievementId
            FROM achievement a
            JOIN title t ON a.PartitionKey = t.Id
            WHERE json_extract(a.Data, '$.unlocked') = true
            AND json_extract(a.Data, '$.timeUnlocked') > '2000-01-01'
            AND json_extract(a.Data, '$.timeUnlocked') >= @start
            AND (@end IS NULL OR json_extract(a.Data, '$.timeUnlocked') < @end)
            ORDER BY json_extract(a.Data, '$.timeUnlocked') ASC
            LIMIT 1
            """;

        const string rarestAchQuery = """
            SELECT
                json_extract(a.Data, '$.name') AS Name,
                json_extract(a.Data, '$.description') AS Description,
                json_extract(a.Data, '$.displayImage') AS Icon,
                json_extract(t.Data, '$.displayImage') AS GameImage,
                json_extract(t.Data, '$.name') AS GameName,
                json_extract(a.Data, '$.timeUnlocked') AS TimeUnlocked,
                json_extract(a.Data, '$.gamerscore') AS Gamerscore,
                json_extract(a.Data, '$.rarity.currentPercentage') AS RarityPercentage,
                json_extract(t.Data, '$.titleId') AS TitleId,
                json_extract(a.Data, '$.id') AS AchievementId
            FROM achievement a
            JOIN title t ON a.PartitionKey = t.Id
            WHERE json_extract(a.Data, '$.unlocked') = true
            AND json_extract(a.Data, '$.rarity.currentPercentage') > 0
            AND json_extract(a.Data, '$.timeUnlocked') > '2000-01-01'
            AND json_extract(a.Data, '$.timeUnlocked') >= @start
            AND (@end IS NULL OR json_extract(a.Data, '$.timeUnlocked') < @end)
            ORDER BY json_extract(a.Data, '$.rarity.currentPercentage') ASC
            LIMIT 1
            """;

        const string firstCompQuery = """
            SELECT
                json_extract(t.Data, '$.displayImage') AS GameImage,
                json_extract(t.Data, '$.name') AS GameName,
                json_extract(t.Data, '$.titleId') AS TitleId,
                MAX(json_extract(a.Data, '$.timeUnlocked')) AS CompletionDate
            FROM title t
            JOIN achievement a ON a.PartitionKey = t.Id
            WHERE json_extract(t.Data, '$.achievement.progressPercentage') = 100
            AND json_extract(t.Data, '$.achievement.totalGamerscore') > 0
            AND json_extract(a.Data, '$.unlocked') = true
            AND json_extract(a.Data, '$.timeUnlocked') > '2000-01-01'
            GROUP BY t.Id
            HAVING MAX(json_extract(a.Data, '$.timeUnlocked')) >= @start
            AND (@end IS NULL OR MAX(json_extract(a.Data, '$.timeUnlocked')) < @end)
            ORDER BY CompletionDate ASC
            LIMIT 1
            """;

        const string fastestCompQuery = """
            SELECT
                json_extract(t.Data, '$.displayImage') AS GameImage,
                json_extract(t.Data, '$.name') AS GameName,
                json_extract(t.Data, '$.titleId') AS TitleId,
                MIN(json_extract(a.Data, '$.timeUnlocked')) AS StartDate,
                MAX(json_extract(a.Data, '$.timeUnlocked')) AS EndDate,
                CAST(ROUND((julianday(MAX(json_extract(a.Data, '$.timeUnlocked'))) - julianday(MIN(json_extract(a.Data, '$.timeUnlocked')))) * 1440) AS INTEGER) AS MinutesToComplete
            FROM title t
            JOIN achievement a ON a.PartitionKey = t.Id
            WHERE json_extract(t.Data, '$.achievement.progressPercentage') = 100
            AND json_extract(t.Data, '$.achievement.totalGamerscore') > 0
            AND json_extract(a.Data, '$.unlocked') = true
            AND json_extract(a.Data, '$.timeUnlocked') > '2000-01-01'
            GROUP BY t.Id
            HAVING MAX(json_extract(a.Data, '$.timeUnlocked')) >= @start
            AND (@end IS NULL OR MAX(json_extract(a.Data, '$.timeUnlocked')) < @end)
            ORDER BY MinutesToComplete ASC, EndDate ASC
            LIMIT 1
            """;

        // Xbox One era: most-played non-Series game.
        // Xbox Series era: most-played Series game.
        var mostPlayedQuery = isSeriesEra
            ? """
              SELECT
                  json_extract(t.Data, '$.displayImage') AS GameImage,
                  json_extract(t.Data, '$.name') AS GameName,
                  json_extract(t.Data, '$.titleId') AS TitleId,
                  json_extract(s.Data, '$.IntValue') AS Minutes
              FROM stat s
              JOIN title t ON s.Id = t.Id
              WHERE json_extract(s.Data, '$.name') = 'MinutesPlayed'
              AND json_extract(t.Data, '$.originalConsole') LIKE '%Series%'
              ORDER BY CAST(json_extract(s.Data, '$.IntValue') AS INTEGER) DESC
              LIMIT 1
              """
            : """
              SELECT
                  json_extract(t.Data, '$.displayImage') AS GameImage,
                  json_extract(t.Data, '$.name') AS GameName,
                  json_extract(t.Data, '$.titleId') AS TitleId,
                  json_extract(s.Data, '$.IntValue') AS Minutes
              FROM stat s
              JOIN title t ON s.Id = t.Id
              WHERE json_extract(s.Data, '$.name') = 'MinutesPlayed'
              AND (json_extract(t.Data, '$.originalConsole') IS NULL
                   OR json_extract(t.Data, '$.originalConsole') NOT LIKE '%Series%')
              ORDER BY CAST(json_extract(s.Data, '$.IntValue') AS INTEGER) DESC
              LIMIT 1
              """;

        var statsTask = _live.Query<EraStats>(eraStatsQuery);
        var firstAchTask = _live.Query<StoryAchievementData>(firstAchQuery, p);
        var rarestTask = _live.Query<StoryAchievementData>(rarestAchQuery, p);
        var firstCompTask = _live.Query<StoryGameData>(firstCompQuery, p);
        var fastestTask = _live.Query<StoryGameData>(fastestCompQuery, p);
        var mostPlayedTask = _live.Query<StoryGameData>(mostPlayedQuery);

        await Task.WhenAll(statsTask, firstAchTask, rarestTask, firstCompTask, fastestTask, mostPlayedTask);

        var stats = statsTask.Result.FirstOrDefault() ?? new EraStats();
        return new TimelinePoint
        {
            Label = label,
            StartDate = startDate,
            Gamerscore = stats.Gamerscore,
            AchievementsUnlocked = stats.AchievementsUnlocked,
            GamesPlayed = stats.GamesPlayed,
            FirstAchievement = firstAchTask.Result.FirstOrDefault(),
            RarestAchievement = rarestTask.Result.FirstOrDefault(),
            FirstCompletion = firstCompTask.Result.FirstOrDefault(),
            FastestCompletion = fastestTask.Result.FirstOrDefault(),
            MostPlayedGame = mostPlayedTask.Result.FirstOrDefault(),
        };
    }

    private static DateTime? ParseDate(string? raw)
    {
        if (string.IsNullOrEmpty(raw)) return null;
        return DateTime.TryParse(raw, out var d) ? d : null;
    }

    private static StreakData CalculateBestStreak(List<ActivityDay> activity)
    {
        if (activity.Count == 0)
            return new StreakData { Days = 0, StartDate = string.Empty, EndDate = string.Empty };

        var days = activity
            .Select(a => DateTime.TryParse(a.Date, out var d) ? d.Date : (DateTime?)null)
            .Where(d => d.HasValue)
            .Select(d => d!.Value)
            .OrderBy(d => d)
            .Distinct()
            .ToList();

        int maxStreak = 1, currentStreak = 1;
        DateTime streakStart = days[0], streakEnd = days[0];
        DateTime currentStart = days[0];

        for (int i = 1; i < days.Count; i++)
        {
            if (days[i] == days[i - 1].AddDays(1))
            {
                currentStreak++;
                if (currentStreak > maxStreak)
                {
                    maxStreak = currentStreak;
                    streakStart = currentStart;
                    streakEnd = days[i];
                }
            }
            else
            {
                currentStreak = 1;
                currentStart = days[i];
            }
        }

        return new StreakData
        {
            Days = maxStreak,
            StartDate = streakStart.ToString("yyyy-MM-dd"),
            EndDate = streakEnd.ToString("yyyy-MM-dd")
        };
    }

    private async Task<int> GetDemosPlayed()
    {
        try
        {
            const string query = "SELECT COUNT(*) FROM title WHERE json_extract(Data, '$.achievement.totalGamerscore') = 0";
            var liveCount = await _live.QuerySingle<int>(query);
            var x360Count = await _x360.QuerySingle<int>(query);
            return liveCount + x360Count;
        }
        catch
        {
            return 0;
        }
    }

    private static List<GenreData> MergeGenres(List<GenreData> liveGenres, List<X360GenreData> x360Genres)
    {
        var merged = liveGenres.ToDictionary(g => g.Genre, g => g, StringComparer.OrdinalIgnoreCase);
        foreach (var g in x360Genres)
        {
            if (merged.TryGetValue(g.Genre, out var existing))
                existing.GameCount += g.GameCount;
            else
                merged[g.Genre] = new GenreData { Genre = g.Genre, Minutes = 0, GameCount = g.GameCount };
        }
        return merged.Values
            .OrderByDescending(g => g.Minutes)
            .ThenByDescending(g => g.GameCount)
            .Take(10)
            .ToList();
    }
}
