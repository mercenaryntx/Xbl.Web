using Spectre.Console;
using Xbl.Client.Infrastructure;

namespace Xbl.Web.Shared;

public class NullProgressContext : IProgressContext
{
    private int _taskCount;

    public ProgressTask AddTask(string description, double maxValue)
    {
        return new ProgressTask(_taskCount++, description, maxValue);
    }
}
