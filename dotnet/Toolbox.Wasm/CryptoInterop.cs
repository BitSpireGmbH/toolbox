using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Versioning;
using Toolbox.Wasm.Core.Crypto;

namespace Toolbox.Wasm;

/// <summary>
/// The JavaScript-facing surface for JWT signature verification, reached from TypeScript
/// as <c>exports.Toolbox.Wasm.CryptoInterop.VerifyJwt(...)</c>.
///
/// Intentionally nothing but marshalling. JSImport/JSExport cannot pass complex objects,
/// so the request arrives as a JSON string and the verdict leaves as one; the real work
/// (and its tests) lives in Toolbox.Wasm.Core, which has no browser dependency.
///
/// The class must be partial - the interop source generator adds to it.
/// </summary>
[SupportedOSPlatform("browser")]
public static partial class CryptoInterop
{
    /// <returns>JSON matching the TypeScript <c>JwtVerification</c> interface.</returns>
    [JSExport]
    internal static string VerifyJwt(string requestJson) => CryptoJsonFacade.VerifyJwt(requestJson);
}
