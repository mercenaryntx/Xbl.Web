using System.Text.Json.Serialization;

namespace Xbl.Web.Models;

public class StatDeltaEntry
{
    [JsonPropertyName("updatedOn")]
    public DateTime UpdatedOn { get; set; }

    [JsonPropertyName("minutes")]
    public int Minutes { get; set; }
}
