using System.Security.Cryptography;
using System.Text;

namespace Toolbox.Wasm.Core.Crypto;

/// <summary>
/// Verifies a JWT's HMAC signature with the real <see cref="System.Security.Cryptography"/>
/// primitives.
///
/// This is the part a JavaScript decoder cannot honestly do: decoding a JWT is just
/// base64, but *verifying* one means running the same HMAC the issuer ran. Until now the
/// tool showed the header's <c>alg</c> and said nothing about whether the token was
/// actually signed with it.
///
/// Deliberately free of any WebAssembly or interop dependency - it targets plain net10.0
/// so the semantics can be asserted in unit tests without a browser.
/// </summary>
public static class JwtVerifier
{
    /// <summary>
    /// Only symmetric algorithms. The asymmetric families need a public key rather than a
    /// shared secret, which is a different input and a different UI, so they are reported
    /// as unsupported rather than quietly failing to match.
    /// </summary>
    private static readonly string[] AsymmetricPrefixes = ["RS", "ES", "PS", "Ed"];

    public static JwtVerifyResult Verify(JwtVerifyRequest request)
    {
        var token = StripBearer(request.Token);

        var parts = token.Split('.');
        if (parts.Length != 3)
        {
            return new JwtVerifyResult(
                false,
                "malformed",
                null,
                "A JWT needs three dot-separated parts (header.payload.signature).");
        }

        string? algorithm;
        try
        {
            algorithm = ReadAlgorithm(parts[0]);
        }
        catch
        {
            return new JwtVerifyResult(false, "malformed", null, "The header is not valid base64url JSON.");
        }

        if (string.IsNullOrWhiteSpace(algorithm))
        {
            return new JwtVerifyResult(false, "malformed", null, "The header has no 'alg' field.");
        }

        // "alg": "none" is not an algorithm, it is the absence of one - and historically a
        // real authentication bypass, because naive verifiers treated it as a pass. Calling
        // it out explicitly is the whole point of surfacing it.
        if (string.Equals(algorithm, "none", StringComparison.OrdinalIgnoreCase))
        {
            return new JwtVerifyResult(
                false,
                "alg-none",
                algorithm,
                "This token declares 'alg: none', meaning it carries no signature at all. "
                    + "Anyone can edit the payload. A verifier that accepts this is broken.");
        }

        if (AsymmetricPrefixes.Any(prefix => algorithm.StartsWith(prefix, StringComparison.Ordinal)))
        {
            return new JwtVerifyResult(
                false,
                "unsupported-algorithm",
                algorithm,
                $"{algorithm} is signed with a private key and verified with a public one, "
                    + "so a shared secret cannot check it. Not supported here yet.");
        }

        if (!TryGetHashSize(algorithm, out var hashSize))
        {
            return new JwtVerifyResult(
                false,
                "unsupported-algorithm",
                algorithm,
                $"'{algorithm}' is not a JWS algorithm this tool knows how to verify.");
        }

        byte[] secretBytes;
        try
        {
            secretBytes = DecodeSecret(request.Secret, request.SecretEncoding);
        }
        catch
        {
            return new JwtVerifyResult(
                false,
                "malformed",
                algorithm,
                $"The secret is not valid {request.SecretEncoding}.");
        }

        byte[] providedSignature;
        try
        {
            providedSignature = Base64UrlDecode(parts[2]);
        }
        catch
        {
            return new JwtVerifyResult(false, "malformed", algorithm, "The signature is not valid base64url.");
        }

        // The signing input is the first two segments exactly as they appear in the token -
        // not re-encoded from the parsed JSON. Re-serializing would change whitespace and
        // key order and produce a different, wrong, hash.
        var signingInput = Encoding.ASCII.GetBytes($"{parts[0]}.{parts[1]}");
        var expected = ComputeHmac(hashSize, secretBytes, signingInput);

        // Length-independent, constant-time. Comparing with SequenceEqual would leak how
        // many leading bytes matched, which is exactly the timing side channel this API
        // exists to close.
        var match = CryptographicOperations.FixedTimeEquals(expected, providedSignature);

        return match
            ? new JwtVerifyResult(
                true,
                "verified",
                algorithm,
                $"The signature matches: this token was signed with {algorithm} using that secret, "
                    + "and neither header nor payload has been altered since.")
            : new JwtVerifyResult(
                false,
                "mismatch",
                algorithm,
                "The signature does not match. Either the secret is wrong (check its encoding) "
                    + "or the token has been modified.");
    }

    private static byte[] ComputeHmac(int hashSize, byte[] key, byte[] data) => hashSize switch
    {
        256 => HMACSHA256.HashData(key, data),
        384 => HMACSHA384.HashData(key, data),
        _ => HMACSHA512.HashData(key, data),
    };

    private static bool TryGetHashSize(string algorithm, out int hashSize)
    {
        hashSize = algorithm switch
        {
            "HS256" => 256,
            "HS384" => 384,
            "HS512" => 512,
            _ => 0,
        };

        return hashSize != 0;
    }

    private static string? ReadAlgorithm(string headerSegment)
    {
        var json = Encoding.UTF8.GetString(Base64UrlDecode(headerSegment));
        using var document = System.Text.Json.JsonDocument.Parse(json);
        return document.RootElement.TryGetProperty("alg", out var alg) ? alg.GetString() : null;
    }

    private static byte[] DecodeSecret(string secret, string encoding) => encoding?.ToLowerInvariant() switch
    {
        "base64" => Convert.FromBase64String(secret),
        "base64url" => Base64UrlDecode(secret),
        _ => Encoding.UTF8.GetBytes(secret),
    };

    /// <summary>
    /// base64url per RFC 4648 §5: URL-safe alphabet, padding stripped. JWTs use this
    /// everywhere, and <see cref="Convert.FromBase64String"/> rejects it outright.
    /// </summary>
    private static byte[] Base64UrlDecode(string value)
    {
        var padded = value.Replace('-', '+').Replace('_', '/');

        padded = (padded.Length % 4) switch
        {
            2 => padded + "==",
            3 => padded + "=",
            0 => padded,
            _ => throw new FormatException("Not a valid base64url length."),
        };

        return Convert.FromBase64String(padded);
    }

    private static string StripBearer(string token)
    {
        var trimmed = (token ?? string.Empty).Trim();
        return trimmed.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
            ? trimmed[7..].Trim()
            : trimmed;
    }
}
