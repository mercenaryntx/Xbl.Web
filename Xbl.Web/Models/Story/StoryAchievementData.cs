namespace Xbl.Web.Models.Story;

public class StoryAchievementData
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Icon { get; set; } = string.Empty;
    public string GameImage { get; set; } = string.Empty;
    public string GameName { get; set; } = string.Empty;
    public string TimeUnlocked { get; set; } = string.Empty;
    public int Gamerscore { get; set; }
    public double RarityPercentage { get; set; }
    public string TitleId { get; set; } = string.Empty;
    public string AchievementId { get; set; } = string.Empty;
}
