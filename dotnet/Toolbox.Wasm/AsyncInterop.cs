using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Versioning;
using Toolbox.Wasm.Core.Async;

namespace Toolbox.Wasm;

[SupportedOSPlatform("browser")]
public static partial class AsyncInterop
{
    /// <returns>A promise of JSON matching the TypeScript <c>AsyncExplanation</c> interface. Async because the scenarios really suspend.</returns>
    [JSExport]
    [return: JSMarshalAs<JSType.Promise<JSType.String>>]
    internal static Task<string> Explain() => AsyncExplainer.ExplainJsonAsync();

    /// <returns>A promise of JSON matching the TypeScript <c>ThreadTimeline</c> interface.</returns>
    [JSExport]
    [return: JSMarshalAs<JSType.Promise<JSType.String>>]
    internal static async Task<string> RunTimeline(bool blocking) =>
        TimelineProbe.RunJson(await TimelineProbe.RunAsync(blocking));
}
