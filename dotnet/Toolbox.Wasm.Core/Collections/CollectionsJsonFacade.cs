using System.Text.Json;
using Toolbox.Wasm.Core.Interop;

namespace Toolbox.Wasm.Core.Collections;

/// <summary>
/// String-in / string-out wrapper around <see cref="ListGrowthBenchmark"/>.
///
/// JSImport/JSExport cannot marshal complex objects, so everything crossing into JavaScript
/// does so as JSON. Keeping that translation here rather than in the interop assembly means
/// the serialization contract the browser actually depends on is covered by plain unit tests.
/// </summary>
public static class CollectionsJsonFacade
{
    /// <summary>
    /// Falls back to the default request rather than reporting a parse failure. Unlike the
    /// LINQ runner there is no user-authored payload to get wrong here - the browser builds
    /// this object from two number inputs - so a malformed payload means the marshalling
    /// broke, and running the defaults still shows the reader something true.
    /// </summary>
    public static string RunListBenchmark(string requestJson)
    {
        var request = JsonBridge.ReadOrDefault(
            requestJson,
            CollectionsJsonContext.Default.ListBenchmarkRequest,
            new ListBenchmarkRequest());

        var result = ListGrowthBenchmark.Run(request);
        return JsonSerializer.Serialize(result, CollectionsJsonContext.Default.ListBenchmarkResult);
    }
}
