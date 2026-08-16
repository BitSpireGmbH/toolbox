using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Versioning;
using Toolbox.Wasm.Core.Layout;

namespace Toolbox.Wasm;

/// <summary>
/// The JavaScript-facing surface for struct layout, reached from TypeScript as
/// <c>exports.Toolbox.Wasm.LayoutInterop.Calculate(...)</c>.
///
/// Intentionally nothing but marshalling. JSImport/JSExport cannot pass complex objects,
/// so the request arrives as a JSON string and the layout leaves as one; the real work
/// (and its tests) lives in Toolbox.Wasm.Core, which has no browser dependency.
///
/// The class must be partial - the interop source generator adds to it.
/// </summary>
[SupportedOSPlatform("browser")]
public static partial class LayoutInterop
{
    /// <returns>JSON matching the TypeScript <c>LayoutResult</c> interface.</returns>
    [JSExport]
    internal static string Calculate(string requestJson) =>
        LayoutJsonFacade.Calculate(requestJson);
}
