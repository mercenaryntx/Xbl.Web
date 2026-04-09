namespace Xbl.Web.Models.Story;

public class TimelinePoint
{
    public string Label { get; set; } = string.Empty;
    public string StartDate { get; set; } = string.Empty;
    public int Gamerscore { get; set; }
    public int AchievementsUnlocked { get; set; }
    public int GamesPlayed { get; set; }
    public StoryAchievementData? FirstAchievement { get; set; }
    public StoryAchievementData? RarestAchievement { get; set; }
    public StoryGameData? FirstCompletion { get; set; }
    public StoryGameData? FastestCompletion { get; set; }
    public StoryGameData? MostPlayedGame { get; set; }
}
