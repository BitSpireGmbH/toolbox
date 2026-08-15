using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Versioning;
using Toolbox.Wasm.Core.Linq;

namespace Toolbox.Wasm;

/// <summary>
/// The JavaScript-facing surface for the LINQ Visualizer, reached from TypeScript as
/// <c>exports.Toolbox.Wasm.LinqInterop.Run(...)</c>.
///
/// Intentionally nothing but marshalling. JSImport/JSExport cannot pass complex
/// objects, so the pipeline description arrives as a JSON string and the trace leaves
/// as one; the real work (and its tests) lives in Toolbox.Wasm.Core, which has no
/// browser dependency.
///
/// The class must be partial - the interop source generator adds to it.
/// </summary>
[SupportedOSPlatform("browser")]
public static partial class LinqInterop
{
    /// <returns>JSON matching the TypeScript <c>LinqRunResult</c> interface.</returns>
    [JSExport]
    internal static string Run(string specJson) => LinqJsonFacade.Run(specJson);

    /// <returns>JSON matching the TypeScript <c>LinqCatalog</c> interface.</returns>
    [JSExport]
    internal static string GetCatalog() => LinqJsonFacade.GetCatalog();
}
