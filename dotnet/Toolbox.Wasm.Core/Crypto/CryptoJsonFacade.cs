using System.Text.Json;
using Toolbox.Wasm.Core.Interop;

namespace Toolbox.Wasm.Core.Crypto;

/// <summary>
/// String-in / string-out wrapper around <see cref="JwtVerifier"/>.
///
/// JSImport/JSExport cannot marshal complex objects, so everything crossing into
/// JavaScript does so as JSON. Keeping that translation here rather than in the interop
/// assembly means the serialization contract the browser actually depends on is covered
/// by plain unit tests.
/// </summary>
public static class CryptoJsonFacade
{
    public static string VerifyJwt(string requestJson)
    {
        // A malformed payload is a programming error on the TypeScript side, not something
        // the user can trigger. Falling through to an empty request lets the verifier
        // classify it as `malformed`, which is a result the UI can render, rather than
        // throwing across the interop boundary where it would surface as an opaque failure.
        var request = JsonBridge.ReadOrDefault(
            requestJson,
            CryptoJsonContext.Default.JwtVerifyRequest,
            new JwtVerifyRequest());

        var result = JwtVerifier.Verify(request);
        return JsonSerializer.Serialize(result, CryptoJsonContext.Default.JwtVerifyResult);
    }
}
