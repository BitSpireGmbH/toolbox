using System.Security.Cryptography;
using System.Text;
using Toolbox.Wasm.Core.Crypto;
using Xunit;

namespace Toolbox.Wasm.Tests;

/// <summary>
/// These are the assertions the JWT Decoder's new verification badge exists to make true.
/// The tool claims a token was really signed with a given secret; if the HMAC were
/// computed over the wrong bytes, or the comparison were sloppy, these are what would
/// catch it.
///
/// They run headless via <c>npm run test:wasm</c> - no browser, no WebAssembly - which is
/// the whole reason the logic lives in Toolbox.Wasm.Core.
/// </summary>
public class JwtVerifierTests
{
    private const string Secret = "a-string-secret-at-least-256-bits-long";

    /// <summary>
    /// Builds a genuinely signed token rather than pasting a fixture, so the test cannot
    /// drift from the implementation by both being wrong in the same way... and so the
    /// signing input is constructed independently, by hand, from the spec.
    /// </summary>
    private static string SignHs256(string headerJson, string payloadJson, string secret)
    {
        var header = Base64Url(Encoding.UTF8.GetBytes(headerJson));
        var payload = Base64Url(Encoding.UTF8.GetBytes(payloadJson));
        var signature = HMACSHA256.HashData(
            Encoding.UTF8.GetBytes(secret),
            Encoding.ASCII.GetBytes($"{header}.{payload}"));

        return $"{header}.{payload}.{Base64Url(signature)}";
    }

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static JwtVerifyResult Verify(string token, string secret, string encoding = "utf8") =>
        JwtVerifier.Verify(new JwtVerifyRequest { Token = token, Secret = secret, SecretEncoding = encoding });

    [Fact]
    public void CorrectSecret_Verifies()
    {
        var token = SignHs256("""{"alg":"HS256","typ":"JWT"}""", """{"sub":"1234567890"}""", Secret);

        var result = Verify(token, Secret);

        Assert.True(result.Verified);
        Assert.Equal("verified", result.Status);
        Assert.Equal("HS256", result.Algorithm);
    }

    [Fact]
    public void WrongSecret_DoesNotVerify()
    {
        var token = SignHs256("""{"alg":"HS256","typ":"JWT"}""", """{"sub":"1234567890"}""", Secret);

        var result = Verify(token, Secret + "x");

        Assert.False(result.Verified);
        Assert.Equal("mismatch", result.Status);
    }

    [Fact]
    public void TamperedPayload_DoesNotVerify()
    {
        // The headline lesson: the signature covers the payload, so editing a claim breaks
        // it even though the token still looks structurally perfect.
        var token = SignHs256("""{"alg":"HS256","typ":"JWT"}""", """{"admin":false}""", Secret);
        var parts = token.Split('.');
        var forged = $"{parts[0]}.{Base64Url(Encoding.UTF8.GetBytes("""{"admin":true}"""))}.{parts[2]}";

        var result = Verify(forged, Secret);

        Assert.False(result.Verified);
        Assert.Equal("mismatch", result.Status);
    }

    [Fact]
    public void AlgNone_IsReportedAsItsOwnStatus_NotAsAMismatch()
    {
        // "alg": "none" is a real authentication bypass, not an ordinary failure, and the
        // UI needs to say something different about it.
        var header = Base64Url(Encoding.UTF8.GetBytes("""{"alg":"none","typ":"JWT"}"""));
        var payload = Base64Url(Encoding.UTF8.GetBytes("""{"admin":true}"""));

        var result = Verify($"{header}.{payload}.", Secret);

        Assert.False(result.Verified);
        Assert.Equal("alg-none", result.Status);
    }

    [Fact]
    public void Rs256_IsUnsupported_RatherThanReportedAsForged()
    {
        // A shared secret cannot check an asymmetric signature. Saying "mismatch" here
        // would tell the user their token is forged when the tool simply cannot know.
        var header = Base64Url(Encoding.UTF8.GetBytes("""{"alg":"RS256","typ":"JWT"}"""));
        var payload = Base64Url(Encoding.UTF8.GetBytes("""{"sub":"1"}"""));

        var result = Verify($"{header}.{payload}.{Base64Url([1, 2, 3])}", Secret);

        Assert.False(result.Verified);
        Assert.Equal("unsupported-algorithm", result.Status);
        Assert.Equal("RS256", result.Algorithm);
    }

    [Theory]
    [InlineData("HS384")]
    [InlineData("HS512")]
    public void Hs384AndHs512_AreSupported(string algorithm)
    {
        var header = Base64Url(Encoding.UTF8.GetBytes($$"""{"alg":"{{algorithm}}","typ":"JWT"}"""));
        var payload = Base64Url(Encoding.UTF8.GetBytes("""{"sub":"1"}"""));
        var signingInput = Encoding.ASCII.GetBytes($"{header}.{payload}");
        var key = Encoding.UTF8.GetBytes(Secret);

        var signature = algorithm == "HS384"
            ? HMACSHA384.HashData(key, signingInput)
            : HMACSHA512.HashData(key, signingInput);

        var result = Verify($"{header}.{payload}.{Base64Url(signature)}", Secret);

        Assert.True(result.Verified);
        Assert.Equal(algorithm, result.Algorithm);
    }

    [Fact]
    public void Base64SecretEncoding_IsHonoured()
    {
        // The most common "why won't it verify" cause: the issuer's secret is base64, but
        // it gets pasted and hashed as literal text.
        var keyBytes = RandomNumberGenerator.GetBytes(32);
        var header = Base64Url(Encoding.UTF8.GetBytes("""{"alg":"HS256","typ":"JWT"}"""));
        var payload = Base64Url(Encoding.UTF8.GetBytes("""{"sub":"1"}"""));
        var signature = HMACSHA256.HashData(keyBytes, Encoding.ASCII.GetBytes($"{header}.{payload}"));
        var token = $"{header}.{payload}.{Base64Url(signature)}";

        var asBase64 = Verify(token, Convert.ToBase64String(keyBytes), "base64");
        var asText = Verify(token, Convert.ToBase64String(keyBytes), "utf8");

        Assert.True(asBase64.Verified);
        Assert.False(asText.Verified);
    }

    [Fact]
    public void BearerPrefix_IsTolerated()
    {
        var token = SignHs256("""{"alg":"HS256","typ":"JWT"}""", """{"sub":"1"}""", Secret);

        Assert.True(Verify($"Bearer {token}", Secret).Verified);
    }

    [Theory]
    [InlineData("not-a-jwt")]
    [InlineData("only.two")]
    [InlineData("")]
    public void StructurallyInvalidTokens_AreMalformed(string token)
    {
        var result = Verify(token, Secret);

        Assert.False(result.Verified);
        Assert.Equal("malformed", result.Status);
    }

    [Fact]
    public void SignatureOfTheWrongLength_DoesNotVerify()
    {
        // FixedTimeEquals returns false on a length mismatch rather than throwing, which is
        // what lets a truncated signature be a clean "no" instead of an exception.
        var token = SignHs256("""{"alg":"HS256","typ":"JWT"}""", """{"sub":"1"}""", Secret);
        var parts = token.Split('.');

        var result = Verify($"{parts[0]}.{parts[1]}.{Base64Url([9, 9, 9])}", Secret);

        Assert.False(result.Verified);
        Assert.Equal("mismatch", result.Status);
    }
}
