namespace Xbl.Web.Models.Kql;

// One row per title-genre assignment (a title with no genres has no rows here, same as how
// KqlAchievement only has rows for achievements that exist, not one per title).
public class KqlTitleGenre
{
    public string TitleId { get; set; }
    public string TitleName { get; set; }
    public string Source { get; set; }
    public string Genre { get; set; }
}
