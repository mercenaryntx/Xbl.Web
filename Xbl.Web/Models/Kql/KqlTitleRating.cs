namespace Xbl.Web.Models.Kql;

// Flat, join-free table for Query Mode: one row per title (live + x360 combined), independent of
// the sibling Xbl.Client.Models.Kql.KqlTitle - kept local to Xbl.Web since the ratings/genres
// feature is deliberately self-contained here (see RatingsContext).
public class KqlTitleRating
{
    public string TitleId { get; set; }
    public string TitleName { get; set; }
    public string Source { get; set; }

    // Not nullable: KustoLoco's reflection-based schema inference drops the column entirely for
    // a Nullable<int> property (confirmed - "ratings | take 5" silently omitted Rating with no
    // error). 0 means "not rated"; valid ratings are 1-5.
    public int Rating { get; set; }
}
