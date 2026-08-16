using System.Text.Json;
using Toolbox.Wasm.Core.Interop;

namespace Toolbox.Wasm.Core.Serialization;

/// <summary>
/// String-in / string-out wrapper around <see cref="NamingPolicyResolver"/>.
///
/// JSImport/JSExport cannot marshal complex objects, so everything crossing into
/// JavaScript does so as JSON. Keeping that translation here rather than in the
/// interop assembly means the serialization contract the browser actually depends
/// on is covered by plain unit tests.
/// </summary>
public static class SerializationJsonFacade
{
    /// <returns>JSON matching the TypeScript <c>NamingResult</c> interface.</returns>
    public static string ApplyNaming(string requestJson)
    {
        // A malformed payload is a programming error on the TypeScript side, not
        // something the user can trigger. Falling back to an empty request returns an
        // empty map, which the caller already has to handle for the runtime-unavailable
        // case, so the tool degrades along a path that is exercised rather than a new one.
        var request = JsonBridge.ReadOrDefault(
            requestJson,
            SerializationJsonContext.Default.NamingRequest,
            new NamingRequest());

        var result = new NamingResult(
            NamingPolicyResolver.Normalize(request.Policy),
            NamingPolicyResolver.Apply(request.Policy, request.Names ?? []));

        return JsonSerializer.Serialize(result, SerializationJsonContext.Default.NamingResult);
    }

    /// <returns>JSON matching the TypeScript <c>RoundTripResult</c> interface.</returns>
    public static string RoundTrip(string payload, string optionsJson)
    {
        var options = JsonBridge.ReadOrDefault(
            optionsJson,
            SerializationJsonContext.Default.RoundTripOptions,
            new RoundTripOptions());

        var result = JsonRoundTripRunner.Run(payload ?? string.Empty, options);
        return JsonSerializer.Serialize(result, SerializationJsonContext.Default.RoundTripResult);
    }

    /// <returns>JSON matching the TypeScript <c>NamingPolicyInfo[]</c> interface.</returns>
    public static string GetNamingPolicies() =>
        JsonSerializer.Serialize(
            NamingPolicyResolver.Catalog,
            SerializationJsonContext.Default.IReadOnlyListNamingPolicyInfo);
}
