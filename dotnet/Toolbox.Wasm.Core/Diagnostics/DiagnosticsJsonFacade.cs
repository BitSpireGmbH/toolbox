using System.Text.Json;
using Toolbox.Wasm.Core.Interop;

namespace Toolbox.Wasm.Core.Diagnostics;

/// <summary>
/// String-in / string-out wrapper around <see cref="AllocationProbe"/>.
///
/// JSImport/JSExport cannot marshal complex objects, so everything crossing into
/// JavaScript does so as JSON. Keeping that translation here rather than in the interop
/// assembly means the serialization contract the browser actually depends on is covered
/// by plain unit tests.
/// </summary>
public static class DiagnosticsJsonFacade
{
    public static string MeasureSlice(string requestJson)
    {
        var request = JsonBridge.ReadOrDefault(
            requestJson,
            DiagnosticsJsonContext.Default.SliceAllocationRequest,
            new SliceAllocationRequest());

        var result = AllocationProbe.MeasureSlice(request);
        return JsonSerializer.Serialize(result, DiagnosticsJsonContext.Default.SliceAllocationResult);
    }
}
