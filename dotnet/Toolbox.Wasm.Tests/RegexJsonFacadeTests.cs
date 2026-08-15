using System.Text.Json;
using Toolbox.Wasm.Core.Regex;
using Xunit;

namespace Toolbox.Wasm.Tests;

/// <summary>
/// The JSON shape here is a contract with TypeScript: the browser parses these
/// strings straight into the existing <c>RegexEvaluation</c> / <c>RegexReplaceResult</c>
/// interfaces. A casing or null-handling change breaks the tool silently, so it is
/// pinned by tests rather than left to serializer defaults.
/// </summary>
public class RegexJsonFacadeTests
{
    private const string NoOptions = "{}";

    private static JsonElement Parse(string json) => JsonDocument.Parse(json).RootElement;

    [Fact]
    public void Evaluate_EmitsCamelCaseMatchingTheTypeScriptInterface()
    {
        var root = Parse(RegexJsonFacade.Evaluate(@"(?<year>\d{4})", "in 2024", NoOptions));

        var match = root.GetProperty("matches")[0];
        Assert.Equal("2024", match.GetProperty("value").GetString());
        Assert.Equal(3, match.GetProperty("index").GetInt32());
        Assert.Equal(4, match.GetProperty("length").GetInt32());

        var group = match.GetProperty("groups")[0];
        Assert.Equal("year", group.GetProperty("name").GetString());
        Assert.Equal("2024", group.GetProperty("value").GetString());
        Assert.Equal(3, group.GetProperty("index").GetInt32());
    }

    [Fact]
    public void Evaluate_OmitsErrorWhenThereIsNone()
    {
        // TypeScript treats `error` as optional and checks truthiness; emitting an
        // explicit null would be harmless, but omitting it keeps the payload honest.
        var root = Parse(RegexJsonFacade.Evaluate("a", "aaa", NoOptions));

        Assert.False(root.TryGetProperty("error", out _));
    }

    [Fact]
    public void Evaluate_SurfacesErrorForInvalidPattern()
    {
        var root = Parse(RegexJsonFacade.Evaluate("(unclosed", "text", NoOptions));

        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("error").GetString()));
        Assert.Empty(root.GetProperty("matches").EnumerateArray());
    }

    [Fact]
    public void Evaluate_DeserializesCamelCaseOptionsFromTypeScript()
    {
        // Exactly the payload RegexOptionsModel serializes to on the TS side.
        const string optionsJson = """
            {
              "ignoreCase": false,
              "multiline": false,
              "singleline": false,
              "ignorePatternWhitespace": true,
              "explicitCapture": false,
              "cultureInvariant": false,
              "rightToLeft": false
            }
            """;

        var root = Parse(RegexJsonFacade.Evaluate(@"\d{4}  # year", "in 2024", optionsJson));

        var match = Assert.Single(root.GetProperty("matches").EnumerateArray());
        Assert.Equal("2024", match.GetProperty("value").GetString());
    }

    [Fact]
    public void Evaluate_WithUnparseableOptions_FallsBackToDefaults()
    {
        var root = Parse(RegexJsonFacade.Evaluate("a", "aaa", "not json"));

        Assert.Equal(3, root.GetProperty("matches").GetArrayLength());
    }

    [Fact]
    public void Evaluate_WithMissingOptionsPayload_FallsBackToDefaults()
    {
        var root = Parse(RegexJsonFacade.Evaluate("a", "aaa", string.Empty));

        Assert.Equal(3, root.GetProperty("matches").GetArrayLength());
    }

    [Fact]
    public void Replace_EmitsResultAndOmitsError()
    {
        var root = Parse(RegexJsonFacade.Replace(@"(\w+)@", "user@host", "$1 at ", NoOptions));

        Assert.Equal("user at host", root.GetProperty("result").GetString());
        Assert.False(root.TryGetProperty("error", out _));
    }
}
