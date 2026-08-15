using System.Text.Json.Serialization;

namespace Toolbox.Wasm.Core.Crypto;

/// <summary>
/// What the browser sends to have a token's signature checked.
///
/// The secret arrives as text plus a declared encoding rather than as bytes: JWT secrets
/// are handed to developers in wildly different forms (a plain passphrase, a base64url
/// blob from an identity provider, a base64 blob from a config file), and picking the
/// wrong one is the single most common reason a signature "mysteriously" fails to
/// verify. Making the choice explicit turns that into a visible setting instead of a
/// silent mismatch.
/// </summary>
public sealed class JwtVerifyRequest
{
    /// <summary>The full compact JWT. A <c>Bearer</c> prefix is tolerated.</summary>
    public string Token { get; set; } = string.Empty;

    public string Secret { get; set; } = string.Empty;

    /// <summary><c>utf8</c> (default), <c>base64</c>, or <c>base64url</c>.</summary>
    public string SecretEncoding { get; set; } = "utf8";
}

/// <summary>
/// Mirrors the TypeScript <c>JwtVerification</c>.
///
/// <see cref="Verified"/> is deliberately not a bare bool on its own: "false" covers both
/// "the signature is wrong" and "this tool could not check it", and conflating those
/// would let an unverifiable token look forged. <see cref="Status"/> is what the UI keys
/// off; <see cref="Verified"/> is only ever true for a genuine cryptographic match.
/// </summary>
public sealed record JwtVerifyResult(
    bool Verified,
    /// <summary>
    /// <c>verified</c>, <c>mismatch</c>, <c>unsupported-algorithm</c>, <c>alg-none</c>,
    /// or <c>malformed</c>.
    /// </summary>
    string Status,
    /// <summary>The algorithm named in the token header, as written.</summary>
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Algorithm,
    /// <summary>Plain-English detail. Always present, because every status needs explaining.</summary>
    string Detail);
