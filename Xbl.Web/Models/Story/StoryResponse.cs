namespace Xbl.Web.Models.Story;

public class StoryResponse
{
    public List<TimelinePoint> Timeline { get; set; } = [];
    public List<ActivityDay> ActivityCalendar { get; set; } = [];
    public int CalendarStartYear { get; set; }
    public int CalendarEndYear { get; set; }
    public ActivityDay? BestDay { get; set; }
    public ActivityDay? BestMonth { get; set; }
    public ActivityDay? BestYear { get; set; }
    public StreakData? BestStreak { get; set; }
    public int GamesCompleted { get; set; }
    public int TotalGames { get; set; }
    public int DemosPlayed { get; set; }
    public double CompletionPercentage { get; set; }
    public List<GenreData> TopGenres { get; set; } = [];
}
