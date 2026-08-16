using System.Text.Json;
using Toolbox.Wasm.Core.Serialization;
using Xunit;

namespace Toolbox.Wasm.Tests;

/// <summary>
/// The JSON shape here is a contract with TypeScript: the browser parses these strings
/// straight into the <c>NamingResult</c> and <c>NamingPolicyInfo</c> interfaces in
/// <c>src/app/services/json-naming.service.ts</c>. A casing change breaks the tool
/// silently, so it is pinned rather than left to serializer defaults.
/// </summary>
public class SerializationJsonFacadeTests
{
    private static JsonElement Parse(string json) => JsonDocument.Parse(json).RootElement;

    [Fact]
    public void ApplyNaming_EmitsCamelCaseMatchingTheTypeScriptInterface()
    {
        var root = Parse(SerializationJsonFacade.ApplyNaming(
            """{ "policy": "CamelCase", "names": ["IPAddress", "ID", "FirstName"] }"""));

        Assert.Equal("CamelCase", root.GetProperty("policy").GetString());

        var names = root.GetProperty("names");
        Assert.Equal("ipAddress", names.GetProperty("IPAddress").GetString());
        Assert.Equal("id", names.GetProperty("ID").GetString());
        Assert.Equal("firstName", names.GetProperty("FirstName").GetString());
    }

    [Fact]
    public void ApplyNaming_EchoesNoneForAPolicyThisRuntimeDoesNotKnow()
    {
        var root = Parse(SerializationJsonFacade.ApplyNaming(
            """{ "policy": "PascalCase", "names": ["IPAddress"] }"""));

        Assert.Equal(NamingPolicyResolver.None, root.GetProperty("policy").GetString());
        Assert.Equal("IPAddress", root.GetProperty("names").GetProperty("IPAddress").GetString());
    }

    [Theory]
    [InlineData("not json")]
    [InlineData("")]
    public void ApplyNaming_WithUnusablePayload_ReturnsAnEmptyMapRatherThanThrowing(string payload)
    {
        var root = Parse(SerializationJsonFacade.ApplyNaming(payload));

        Assert.Empty(root.GetProperty("names").EnumerateObject());
    }

    [Fact]
    public void GetNamingPolicies_ExposesTheRuntimesOwnCatalog()
    {
        var root = Parse(SerializationJsonFacade.GetNamingPolicies());

        var ids = root.EnumerateArray()
            .Select(entry => entry.GetProperty("id").GetString())
            .ToArray();

        Assert.Contains(NamingPolicyResolver.None, ids);
        Assert.Contains("CamelCase", ids);
        Assert.Contains("SnakeCaseLower", ids);

        // The example is what proves the real policy ran, so it must not be empty.
        foreach (var entry in root.EnumerateArray())
        {
            Assert.False(string.IsNullOrWhiteSpace(entry.GetProperty("example").GetString()));
            Assert.False(string.IsNullOrWhiteSpace(entry.GetProperty("label").GetString()));
        }
    }
}
