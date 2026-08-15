using System.Text.Json;
using Toolbox.Wasm.Core.Linq;
using Xunit;

namespace Toolbox.Wasm.Tests;

/// <summary>
/// The JSON shape here is a contract with TypeScript: the browser parses these strings
/// straight into the <c>LinqRunResult</c> / <c>LinqCatalog</c> interfaces. A casing or
/// null-handling change breaks the tool silently, so it is pinned by tests rather than
/// left to serializer defaults.
/// </summary>
public class LinqJsonFacadeTests
{
    private static JsonElement Parse(string json) => JsonDocument.Parse(json).RootElement;

    private const string SimplePipeline = """
        {
          "source": { "kind": "numbers", "count": 4 },
          "operators": [ { "id": "where-greater-than", "number": 1 } ],
          "terminal": "toList"
        }
        """;

    [Fact]
    public void Run_EmitsCamelCaseMatchingTheTypeScriptInterface()
    {
        var root = Parse(LinqJsonFacade.Run(SimplePipeline));

        var stage = root.GetProperty("stages")[1];
        Assert.Equal(1, stage.GetProperty("index").GetInt32());
        Assert.Equal("Where(n => n > 1)", stage.GetProperty("label").GetString());
        Assert.Equal("streaming", stage.GetProperty("kind").GetString());

        var first = root.GetProperty("events")[0];
        Assert.Equal(0, first.GetProperty("step").GetInt32());
        Assert.Equal("pulled", first.GetProperty("kind").GetString());
        Assert.Equal(0, first.GetProperty("pass").GetInt32());

        var stats = root.GetProperty("stats");
        // Five, not four: the final MoveNext that discovers the source is empty was
        // still a pull, and pretending otherwise would hide the last event in the trace.
        Assert.Equal(5, stats.GetProperty("sourcePulls").GetInt32());
        Assert.Equal(4, stats.GetProperty("sourceYields").GetInt32());
        Assert.False(stats.GetProperty("shortCircuited").GetBoolean());

        Assert.Equal(JsonValueKind.String, root.GetProperty("methodSyntax").ValueKind);
        Assert.Equal(JsonValueKind.String, root.GetProperty("resultText").ValueKind);
    }

    [Fact]
    public void Run_OmitsOptionalFieldsRatherThanEmittingNulls()
    {
        // TypeScript treats `error` and `querySyntax` as optional and checks truthiness;
        // omitting them keeps the payload honest about what is actually absent.
        var root = Parse(LinqJsonFacade.Run("""
            { "source": { "kind": "numbers", "count": 3 }, "operators": [ { "id": "take", "number": 2 } ], "terminal": "toList" }
            """));

        Assert.False(root.TryGetProperty("error", out _));
        Assert.False(root.TryGetProperty("querySyntax", out _));
    }

    [Fact]
    public void Run_OmitsTheValueFieldOnEventsThatCarryNoElement()
    {
        var root = Parse(LinqJsonFacade.Run(SimplePipeline));

        var pulled = root.GetProperty("events")[0];
        Assert.False(pulled.TryGetProperty("value", out _));

        var yielded = root.GetProperty("events")
            .EnumerateArray()
            .First(item => item.GetProperty("kind").GetString() == "yielded");
        Assert.Equal("1", yielded.GetProperty("value").GetString());
    }

    [Fact]
    public void Run_ReportsMalformedJsonRatherThanQuietlyRunningADefaultPipeline()
    {
        var root = Parse(LinqJsonFacade.Run("{ not json"));

        Assert.True(root.TryGetProperty("error", out var error));
        Assert.Contains("could not be read", error.GetString()!, StringComparison.Ordinal);
    }

    [Fact]
    public void Run_TreatsAnEmptySpecAsTheDefaultPipeline()
    {
        var root = Parse(LinqJsonFacade.Run("{}"));

        Assert.False(root.TryGetProperty("error", out _));
        Assert.Equal(1, root.GetProperty("stages").GetArrayLength());
    }

    [Fact]
    public void GetCatalog_DescribesEveryPaletteEntryTheBrowserNeeds()
    {
        var root = Parse(LinqJsonFacade.GetCatalog());

        Assert.Equal(1, root.GetProperty("sources").GetArrayLength());
        Assert.NotEmpty(root.GetProperty("operators").EnumerateArray());
        Assert.NotEmpty(root.GetProperty("terminals").EnumerateArray());

        var parameterised = root.GetProperty("operators")
            .EnumerateArray()
            .First(item => item.GetProperty("id").GetString() == "where-greater-than");

        Assert.Equal("number", parameterised.GetProperty("argKind").GetString());
        Assert.Equal(3, parameterised.GetProperty("defaultNumber").GetDouble());
        Assert.Equal("streaming", parameterised.GetProperty("kind").GetString());
        Assert.Contains("numbers", parameterised.GetProperty("sources").EnumerateArray()
            .Select(item => item.GetString()));
    }

    [Fact]
    public void GetCatalog_OmitsArgMetadataForOperatorsThatTakeNoParameter()
    {
        var root = Parse(LinqJsonFacade.GetCatalog());

        var reverse = root.GetProperty("operators")
            .EnumerateArray()
            .First(item => item.GetProperty("id").GetString() == "reverse");

        Assert.False(reverse.TryGetProperty("argKind", out _));
        Assert.False(reverse.TryGetProperty("defaultNumber", out _));
    }
}
