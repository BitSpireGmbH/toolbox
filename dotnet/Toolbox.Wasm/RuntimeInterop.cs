using System.Runtime.InteropServices;
using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Versioning;

namespace Toolbox.Wasm;

/// <summary>
/// Lets the page report which .NET is actually running, straight from the runtime
/// rather than from a build-time constant. Anything else would still read ".NET 10"
/// if the runtime silently failed to load and a fallback took over.
/// </summary>
[SupportedOSPlatform("browser")]
public static partial class RuntimeInterop
{
    /// <returns>e.g. <c>.NET 10.0.3</c></returns>
    [JSExport]
    internal static string GetFrameworkDescription() => RuntimeInformation.FrameworkDescription;
}
