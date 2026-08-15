using System.Globalization;

namespace Toolbox.Wasm.Core.Linq;

/// <summary>
/// Turns a pipeline element - or a terminal's answer - into the short string the UI
/// shows.
///
/// Invariant culture throughout: the browser's locale must not change what the trace
/// says a number was, or the same demo would read differently in two places for
/// reasons that have nothing to do with LINQ.
/// </summary>
internal static class ValueRenderer
{
    internal static string Render(object? value, int maxLength)
    {
        var text = RenderCore(value);
        return text.Length <= maxLength ? text : string.Concat(text.AsSpan(0, maxLength - 1), "…");
    }

    /// <summary>
    /// Pipeline elements are always <c>int</c>. The other cases exist for terminal
    /// answers - <c>Any()</c> returns a bool, <c>Sum()</c> and <c>Count()</c> an int.
    /// </summary>
    private static string RenderCore(object? value) => value switch
    {
        null => "null",
        int i => i.ToString(CultureInfo.InvariantCulture),
        long l => l.ToString(CultureInfo.InvariantCulture),
        double d => d.ToString("0.###", CultureInfo.InvariantCulture),
        bool b => b ? "true" : "false",
        string s => $"\"{s}\"",
        _ => value.ToString() ?? "null",
    };
}
