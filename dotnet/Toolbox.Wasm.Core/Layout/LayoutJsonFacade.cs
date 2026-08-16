using System.Text.Json;
using Toolbox.Wasm.Core.Interop;

namespace Toolbox.Wasm.Core.Layout;

/// <summary>
/// String-in / string-out wrapper around <see cref="LayoutCalculator"/>.
///
/// JSImport/JSExport cannot marshal complex objects, so everything crossing into
/// JavaScript does so as JSON. Keeping that translation here rather than in the
/// interop assembly means the serialization contract the browser actually depends
/// on is covered by plain unit tests.
/// </summary>
public static class LayoutJsonFacade
{
    /// <returns>JSON matching the TypeScript <c>LayoutResult</c> interface.</returns>
    public static string Calculate(string requestJson)
    {
        var request = JsonBridge.ReadOrDefault(
            requestJson,
            LayoutJsonContext.Default.LayoutRequest,
            new LayoutRequest());

        var result = LayoutCalculator.Calculate(request.Source ?? string.Empty, ParseTarget(request.Target));
        return JsonSerializer.Serialize(result, LayoutJsonContext.Default.LayoutResult);
    }

    /// <summary>
    /// An unrecognised target falls back to x64 rather than throwing. The value comes from
    /// a dropdown, and defaulting to the target most people are on beats failing.
    /// </summary>
    private static LayoutTarget ParseTarget(string? target) =>
        Enum.TryParse<LayoutTarget>(target, ignoreCase: true, out var parsed)
            ? parsed
            : LayoutTarget.X64;
}
