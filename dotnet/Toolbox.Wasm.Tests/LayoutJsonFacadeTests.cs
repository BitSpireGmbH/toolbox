using System.Text.Json;
using Toolbox.Wasm.Core.Layout;
using Xunit;

namespace Toolbox.Wasm.Tests;

/// <summary>
/// The JSON shape here is a contract with TypeScript: the browser parses these strings
/// straight into the interfaces in <c>src/app/services/struct-layout.service.ts</c>. A
/// casing or null-handling change breaks the tool silently, so it is pinned rather than
/// left to serializer defaults.
/// </summary>
public class LayoutJsonFacadeTests
{
    private static JsonElement Parse(string json) => JsonDocument.Parse(json).RootElement;

    [Fact]
    public void Calculate_EmitsCamelCaseMatchingTheTypeScriptInterface()
    {
        var root = Parse(LayoutJsonFacade.Calculate(
            """{ "source": "struct S { public byte Flag; public long Ticks; }", "target": "X64" }"""));

        Assert.Equal("X64", root.GetProperty("target").GetString());

        var layout = root.GetProperty("structs")[0];
        Assert.Equal("S", layout.GetProperty("name").GetString());
        Assert.Equal("Sequential", layout.GetProperty("kind").GetString());
        Assert.Equal(16, layout.GetProperty("size").GetInt32());
        Assert.Equal(8, layout.GetProperty("alignment").GetInt32());
        Assert.Equal(7, layout.GetProperty("paddingBytes").GetInt32());

        var field = layout.GetProperty("fields")[1];
        Assert.Equal("Ticks", field.GetProperty("name").GetString());
        Assert.Equal("long", field.GetProperty("type").GetString());
        Assert.Equal(8, field.GetProperty("offset").GetInt32());
        Assert.Equal(7, field.GetProperty("paddingBefore").GetInt32());
        Assert.False(field.GetProperty("isExplicit").GetBoolean());
        Assert.False(field.GetProperty("overlaps").GetBoolean());
    }

    [Fact]
    public void Calculate_OmitsTheSuggestionWhenThereIsNothingToSuggest()
    {
        // TypeScript treats `suggestion` as optional and checks truthiness; emitting an
        // explicit null would be harmless, but omitting it keeps the payload honest.
        var root = Parse(LayoutJsonFacade.Calculate(
            """{ "source": "struct S { public int A; public int B; }", "target": "X64" }"""));

        Assert.False(root.GetProperty("structs")[0].TryGetProperty("suggestion", out _));
    }

    [Fact]
    public void Calculate_EmitsTheSuggestionWhenThereIsOne()
    {
        var root = Parse(LayoutJsonFacade.Calculate(
            """{ "source": "struct S { public byte A; public long B; public byte C; }", "target": "X64" }"""));

        var suggestion = root.GetProperty("structs")[0].GetProperty("suggestion");
        Assert.Equal(16, suggestion.GetProperty("size").GetInt32());
        Assert.Equal(
            ["B", "A", "C"],
            suggestion.GetProperty("fieldOrder").EnumerateArray().Select(entry => entry.GetString()));
    }

    [Fact]
    public void Calculate_SurfacesDiagnosticsRatherThanFailing()
    {
        var root = Parse(LayoutJsonFacade.Calculate(
            """{ "source": "struct S { public MyThing Thing; }", "target": "X64" }"""));

        Assert.NotEmpty(root.GetProperty("diagnostics").EnumerateArray());
    }

    [Fact]
    public void Calculate_CarriesTheCaveatsForThirtyTwoBitTargets()
    {
        var root = Parse(LayoutJsonFacade.Calculate(
            """{ "source": "struct S { public string Name; }", "target": "Wasm32" }"""));

        Assert.Equal("Wasm32", root.GetProperty("target").GetString());
        Assert.Equal(4, root.GetProperty("structs")[0].GetProperty("size").GetInt32());
        Assert.NotEmpty(root.GetProperty("caveats").EnumerateArray());
    }

    [Theory]
    [InlineData("not json")]
    [InlineData("")]
    [InlineData("""{ "source": "struct S { public int A; }", "target": "Motorola68000" }""")]
    public void Calculate_WithAnUnusablePayload_FallsBackToX64RatherThanThrowing(string payload)
    {
        var root = Parse(LayoutJsonFacade.Calculate(payload));

        Assert.Equal("X64", root.GetProperty("target").GetString());
    }
}
