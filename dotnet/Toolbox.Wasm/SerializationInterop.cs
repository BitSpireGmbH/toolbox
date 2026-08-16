using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Versioning;
using Toolbox.Wasm.Core.Serialization;

namespace Toolbox.Wasm;

/// <summary>
/// The JavaScript-facing surface for System.Text.Json behaviour, reached from
/// TypeScript as <c>exports.Toolbox.Wasm.SerializationInterop.ApplyNaming(...)</c>.
///
/// Intentionally nothing but marshalling. JSImport/JSExport cannot pass complex objects,
/// so the request arrives as a JSON string and the result leaves as one; the real work
/// (and its tests) lives in Toolbox.Wasm.Core, which has no browser dependency.
///
/// The class must be partial - the interop source generator adds to it.
/// </summary>
[SupportedOSPlatform("browser")]
public static partial class SerializationInterop
{
    /// <returns>JSON matching the TypeScript <c>NamingResult</c> interface.</returns>
    [JSExport]
    internal static string ApplyNaming(string requestJson) =>
        SerializationJsonFacade.ApplyNaming(requestJson);

    /// <returns>JSON matching the TypeScript <c>RoundTripResult</c> interface.</returns>
    [JSExport]
    internal static string RoundTrip(string payload, string optionsJson) =>
        SerializationJsonFacade.RoundTrip(payload, optionsJson);

    /// <returns>JSON matching the TypeScript <c>NamingPolicyInfo[]</c> interface.</returns>
    [JSExport]
    internal static string GetNamingPolicies() =>
        SerializationJsonFacade.GetNamingPolicies();
}
