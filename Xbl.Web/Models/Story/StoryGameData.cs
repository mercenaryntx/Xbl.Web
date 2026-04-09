namespace Xbl.Web.Models.Story;

public class StoryGameData
{
    public string GameImage { get; set; } = string.Empty;
    public string GameName { get; set; } = string.Empty;
    public string? CompletionDate { get; set; }
    public string? StartDate { get; set; }
    public string? EndDate { get; set; }
    public int MinutesToComplete { get; set; }
    public int Minutes { get; set; }
    public string TitleId { get; set; } = string.Empty;
}
