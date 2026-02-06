using KustoLoco.Core;
using Microsoft.Extensions.Logging;
using Spectre.Console.Rendering;
using Xbl.Client.Infrastructure;
using Xbl.Client.Io;
using Xbl.Client.Models;

namespace Xbl.Web.Shared;

public class NullConsole : IConsole
{
    private readonly ILogger<NullConsole> _logger;

    public NullConsole(ILogger<NullConsole> logger)
    {
        _logger = logger;
    }

    public void Render(ProfilesSummary summary)
    {
    }

    public void Render(IEnumerable<RarestAchievementItem> data)
    {
    }

    public void Render(IEnumerable<WeightedAchievementItem> weightedRarity)
    {
    }

    public void Render(IEnumerable<CompletenessItem> data)
    {
    }

    public void Render(IEnumerable<MinutesPlayed> data)
    {
    }

    public void Render(IEnumerable<CategorySlice> slices)
    {
    }

    public void KustoQueryResult(KustoQueryResult result)
    {
    }

    public void Markup(string text)
    {
    }

    public void MarkupLine(string text)
    {
    }

    public void MarkupInterpolated(FormattableString text)
    {
    }

    public void MarkupLineInterpolated(FormattableString text)
    {
    }

    public int ShowError(string error)
    {
        _logger.LogError(error);
        return -1;
    }

    public void Write(IRenderable table)
    {
    }

    public Task Progress(Func<IProgressContext, Task> action)
    {
        return action.Invoke(new NullProgressContext());
    }
}
