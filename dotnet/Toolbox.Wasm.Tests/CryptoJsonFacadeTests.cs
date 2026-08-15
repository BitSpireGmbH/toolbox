using System.Text.Json;
using Toolbox.Wasm.Core.Crypto;
using Xunit;

namespace Toolbox.Wasm.Tests;

/// <summary>
/// Pins the wire format the browser depends on. The TypeScript interfaces are written by
/// hand against these shapes, so a rename here without one there fails at the call rather
/// than at build time - these tests are what make that a test failure instead.
/// </summary>
public class CryptoJsonFacadeTests
{
    private static JsonElement Verify(string requestJson) =>
        JsonDocument.Parse(CryptoJsonFacade.VerifyJwt(requestJson)).RootElement;

    [Fact]
    public void Result_UsesCamelCaseFieldNames()
    {
        var json = Verify("""{"token":"a.b","secret":"s","secretEncoding":"utf8"}""");

        Assert.True(json.TryGetProperty("verified", out _));
        Assert.True(json.TryGetProperty("status", out _));
        Assert.True(json.TryGetProperty("detail", out _));
    }

    [Fact]
    public void Algorithm_IsOmittedWhenUnknown()
    {
        // JsonIgnoreCondition.WhenWritingNull - the TypeScript side declares it optional,
        // so it must genuinely be absent rather than present-and-null.
        var json = Verify("""{"token":"not-a-jwt","secret":"s"}""");

        Assert.False(json.TryGetProperty("algorithm", out _));
    }

    [Fact]
    public void RequestIsDeserializedFromCamelCase()
    {
        // Proves secretEncoding actually arrives; if it silently defaulted to utf8 this
        // would report a mismatch instead of verifying.
        var secret = Convert.ToBase64String("a-string-secret-at-least-256-bits-long"u8.ToArray());
        var request = JsonSerializer.Serialize(
            new JwtVerifyRequest { Token = "x.y.z", Secret = secret, SecretEncoding = "base64" },
            CryptoJsonContext.Default.JwtVerifyRequest);

        Assert.Contains("secretEncoding", request, StringComparison.Ordinal);
        Assert.Contains("base64", request, StringComparison.Ordinal);
    }

    [Fact]
    public void MalformedRequestJson_ReportsAResultRatherThanThrowing()
    {
        var json = Verify("{ this is not json");

        Assert.Equal("malformed", json.GetProperty("status").GetString());
    }
}
