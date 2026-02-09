using Microsoft.AspNetCore.Mvc;
using Xbl.Client;
using Xbl.Data;

namespace Xbl.Web.Controllers;

[ApiController]
[Route("[controller]")]
public class ProgressController : ControllerBase
{
    private readonly IDatabaseContext _live;
    private readonly ILogger<ProgressController> _logger;

    public ProgressController(
        [FromKeyedServices(DataSource.Live)] IDatabaseContext live,
        ILogger<ProgressController> logger)
    {
        _live = live.Mandatory();
        _logger = logger;
    }

    [HttpGet("trends")]
    [ResponseCache(Duration = 3600)]
    public async Task<ProgressTrends> GetTrends()
    {
        // Query only unlocked achievements with just the fields we need
        var query = @"
            SELECT 
                json_extract(Data, '$.timeUnlocked') as TimeUnlocked,
                json_extract(Data, '$.gamerscore') as Gamerscore
            FROM achievement
            WHERE json_extract(Data, '$.unlocked') = true
            ORDER BY json_extract(Data, '$.timeUnlocked') ASC";

        var unlockedAchievements = (await _live.Query<UnlockedAchievement>(query)).ToList();
        
        _logger.LogInformation("Retrieved {Count} unlocked achievements", unlockedAchievements.Count);
        
        if (!unlockedAchievements.Any())
        {
            _logger.LogWarning("No unlocked achievements found in database");
            return new ProgressTrends();
        }

        // Log the date range
        var minDate = unlockedAchievements.Min(a => a.TimeUnlocked);
        var maxDate = unlockedAchievements.Max(a => a.TimeUnlocked);
        _logger.LogInformation("Achievement date range: {Min} to {Max}", 
            minDate.ToString("yyyy-MM-dd"), maxDate.ToString("yyyy-MM-dd"));

        var firstYear = minDate.Year;
        var lastYear = maxDate.Year;

        // Generate yearly data from first achievement year to current year
        var yearlyData = GenerateYearlyData(unlockedAchievements, firstYear, lastYear);
        
        // Generate monthly data grouped by year
        var monthlyByYear = GenerateMonthlyDataByYear(unlockedAchievements, firstYear, lastYear);
        
        // Generate weekly data grouped by year
        var weeklyByYear = GenerateWeeklyDataByYear(unlockedAchievements, firstYear, lastYear);

        _logger.LogInformation("Generated data - Yearly: {Yearly} years, Monthly: {Monthly} years, Weekly: {Weekly} years",
            yearlyData.Count, monthlyByYear.Count, weeklyByYear.Count);

        return new ProgressTrends
        {
            Yearly = yearlyData,
            MonthlyByYear = monthlyByYear,
            WeeklyByYear = weeklyByYear
        };
    }

    private List<ProgressDataPoint> GenerateYearlyData(
        List<UnlockedAchievement> achievements,
        int startYear,
        int endYear)
    {
        var data = new List<ProgressDataPoint>();

        for (int year = startYear; year <= endYear; year++)
        {
            var achievementsInYear = achievements
                .Where(a => a.TimeUnlocked.Year == year)
                .ToList();

            var achievementsInPeriod = achievementsInYear.Count;
            var gamerscoreInPeriod = achievementsInYear.Sum(a => a.Gamerscore);

            data.Add(new ProgressDataPoint
            {
                Date = $"{year}-01-01",
                Period = year.ToString(),
                Achievements = achievementsInPeriod,
                Gamerscore = gamerscoreInPeriod
            });
        }

        return data;
    }

    private Dictionary<int, List<ProgressDataPoint>> GenerateMonthlyDataByYear(
        List<UnlockedAchievement> achievements,
        int startYear,
        int endYear)
    {
        var result = new Dictionary<int, List<ProgressDataPoint>>();

        for (int year = startYear; year <= endYear; year++)
        {
            var monthlyData = new List<ProgressDataPoint>();
            var yearAchievements = achievements.Where(a => a.TimeUnlocked.Year == year).ToList();

            for (int month = 1; month <= 12; month++)
            {
                var achievementsInMonth = yearAchievements
                    .Where(a => a.TimeUnlocked.Month == month)
                    .ToList();

                var achievementsInPeriod = achievementsInMonth.Count;
                var gamerscoreInPeriod = achievementsInMonth.Sum(a => a.Gamerscore);

                var date = new DateTime(year, month, 1);
                monthlyData.Add(new ProgressDataPoint
                {
                    Date = date.ToString("yyyy-MM-dd"),
                    Period = date.ToString("MMM yyyy"),
                    Achievements = achievementsInPeriod,
                    Gamerscore = gamerscoreInPeriod
                });
            }

            result[year] = monthlyData;
        }

        return result;
    }

    private Dictionary<int, List<ProgressDataPoint>> GenerateWeeklyDataByYear(
        List<UnlockedAchievement> achievements,
        int startYear,
        int endYear)
    {
        var result = new Dictionary<int, List<ProgressDataPoint>>();

        for (int year = startYear; year <= endYear; year++)
        {
            var weeklyData = new List<ProgressDataPoint>();
            var yearAchievements = achievements.Where(a => a.TimeUnlocked.Year == year).ToList();

            // Start from first day of year
            var currentDate = new DateTime(year, 1, 1);
            var endDate = new DateTime(year, 12, 31);

            while (currentDate <= endDate)
            {
                var weekEnd = currentDate.AddDays(7);
                if (weekEnd.Year != year)
                    weekEnd = new DateTime(year, 12, 31).AddDays(1); // End of year

                var achievementsInWeek = yearAchievements
                    .Where(a => a.TimeUnlocked >= currentDate && a.TimeUnlocked < weekEnd)
                    .ToList();

                var achievementsInPeriod = achievementsInWeek.Count;
                var gamerscoreInPeriod = achievementsInWeek.Sum(a => a.Gamerscore);

                weeklyData.Add(new ProgressDataPoint
                {
                    Date = currentDate.ToString("yyyy-MM-dd"),
                    Period = currentDate.ToString("MMM dd"),
                    Achievements = achievementsInPeriod,
                    Gamerscore = gamerscoreInPeriod
                });

                currentDate = weekEnd;
            }

            result[year] = weeklyData;
        }

        return result;
    }
}

public class UnlockedAchievement
{
    public DateTime TimeUnlocked { get; set; }
    public int Gamerscore { get; set; }
}

public class ProgressDataPoint
{
    public string Date { get; set; }
    public string Period { get; set; }
    public int Achievements { get; set; }
    public int Gamerscore { get; set; }
}

public class ProgressTrends
{
    public List<ProgressDataPoint> Yearly { get; set; } = new();
    public Dictionary<int, List<ProgressDataPoint>> MonthlyByYear { get; set; } = new();
    public Dictionary<int, List<ProgressDataPoint>> WeeklyByYear { get; set; } = new();
}
