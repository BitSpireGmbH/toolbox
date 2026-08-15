using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Versioning;
using Toolbox.Wasm.Core.Diagnostics;

namespace Toolbox.Wasm;

/// <summary>
/// The JavaScript-facing surface for runtime measurements, reached from TypeScript as
/// <c>exports.Toolbox.Wasm.DiagnosticsInterop.MeasureSlice(...)</c>.
///
/// Intentionally nothing but marshalling. JSImport/JSExport cannot pass complex objects,
/// so the request arrives as a JSON string and the measurements leave as one; the real
/// work (and its tests) lives in Toolbox.Wasm.Core, which has no browser dependency.
///
/// The class must be partial - the interop source generator adds to it.
/// </summary>
[SupportedOSPlatform("browser")]
public static partial class DiagnosticsInterop
{
    /// <returns>JSON matching the TypeScript <c>SliceAllocation</c> interface.</returns>
    [JSExport]
    internal static string MeasureSlice(string requestJson) =>
        DiagnosticsJsonFacade.MeasureSlice(requestJson);
}
