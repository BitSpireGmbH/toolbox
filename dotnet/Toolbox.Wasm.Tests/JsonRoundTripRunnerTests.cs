using Toolbox.Wasm.Core.Serialization;
using Xunit;

namespace Toolbox.Wasm.Tests;

/// <summary>
/// These assert System.Text.Json's own behaviour, which is the only reason the tool runs
/// the real reader instead of `JSON.parse`. If any of these start matching what
/// JavaScript would have said, the runtime has stopped being consulted.
/// </summary>
public class JsonRoundTripRunnerTests
{
    private static RoundTripResult Run(string payload, RoundTripOptions? options = null) =>
        JsonRoundTripRunner.Run(payload, options ?? new RoundTripOptions());

    [Fact]
    public void ParseFailure_ReportsTheLineAndBytePosition()
    {
        var result = Run("{\n  \"a\": 1,\n  \"b\":,\n}");

        Assert.Null(result.Output);
        Assert.NotNull(result.Error);
        // Zero-based, as System.Text.Json reports it - the third line.
        Assert.Equal((long?)2, result.Error.LineNumber);
        Assert.False(string.IsNullOrWhiteSpace(result.Error.Message));
    }

    [Fact]
    public void TrailingCommas_AreRejectedByDefaultAndAllowedOnRequest()
    {
        Assert.NotNull(Run("""{ "a": 1, }""").Error);
        Assert.Null(Run("""{ "a": 1, }""", new RoundTripOptions { AllowTrailingCommas = true }).Error);
    }

    [Fact]
    public void Comments_AreRejectedByDefaultAndSkippedOnRequest()
    {
        const string payload = """
            {
              // why this is here
              "a": 1
            }
            """;

        Assert.NotNull(Run(payload).Error);
        Assert.Null(Run(payload, new RoundTripOptions { SkipComments = true }).Error);
    }

    [Fact]
    public void MaxDepth_IsEnforced()
    {
        var result = Run("""{ "a": { "b": { "c": 1 } } }""", new RoundTripOptions { MaxDepth = 2 });

        Assert.NotNull(result.Error);
    }

    [Fact]
    public void DefaultEncoder_EscapesCharactersThatAreValidJson()
    {
        // The complaint that shows up as "System.Text.Json corrupted my output": all four
        // are perfectly legal JSON, and the default encoder escapes every one of them.
        var result = Run("""{ "a": "1+2 <b> & é" }""");

        // Built by concatenation so the expectations stay readable as *escaped* text
        // rather than being silently un-escaped by an editor on the way in.
        const string u = @"\u";

        Assert.Contains(u + "002B", result.Output); // +
        Assert.Contains(u + "003C", result.Output); // <
        Assert.Contains(u + "0026", result.Output); // &
        Assert.Contains(u + "00E9", result.Output); // é
        Assert.DoesNotContain("1+2", result.Output);
    }

    [Fact]
    public void RelaxedEncoder_LeavesThemAlone()
    {
        var result = Run(
            """{ "a": "1+2 <b> & é" }""",
            new RoundTripOptions { RelaxedEscaping = true });

        Assert.Contains("1+2 <b> & é", result.Output);
    }

    [Fact]
    public void Indentation_HonoursSizeAndTabs()
    {
        var spaces = Run("""{"a":1}""", new RoundTripOptions { WriteIndented = true, IndentSize = 4 });
        Assert.Contains("\n    \"a\"", spaces.Output);

        var tabs = Run("""{"a":1}""", new RoundTripOptions { WriteIndented = true, IndentWithTabs = true });
        Assert.Contains("\n\t\"a\"", tabs.Output);
    }

    [Fact]
    public void WriteIndentedOff_ProducesCompactOutput()
    {
        var result = Run("{\n  \"a\": 1\n}", new RoundTripOptions { WriteIndented = false });

        Assert.Equal("""{"a":1}""", result.Output);
    }

    [Fact]
    public void IntegerBeyondTwoToTheFiftyThree_IsFlaggedAsUnsafeForJavaScript()
    {
        var result = Run("""{ "id": 9007199254740993 }""");

        var note = Assert.Single(result.Notes);
        Assert.Equal("$.id", note.Path);
        Assert.Equal("precision", note.Kind);
        Assert.Equal("9007199254740993", note.Raw);
    }

    [Fact]
    public void IntegerWithinRange_IsNotFlagged()
    {
        Assert.Empty(Run("""{ "id": 9007199254740991 }""").Notes);
    }

    [Fact]
    public void FractionThatSurvivesAsDecimalButNotAsDouble_IsFlagged()
    {
        var result = Run("""{ "amount": 0.1234567890123456789 }""");

        var note = Assert.Single(result.Notes);
        Assert.Equal("$.amount", note.Path);
        Assert.Contains("decimal keeps", note.Detail);
    }

    [Theory]
    [InlineData("0.1")]
    [InlineData("1.50")] // trailing zero is a scale difference, not a precision loss
    [InlineData("-3.25")]
    public void FractionsBothTypesAgreeOn_AreNotFlagged(string number)
    {
        Assert.Empty(Run($$"""{ "amount": {{number}} }""").Notes);
    }

    [Fact]
    public void NotesAreLocatedThroughArraysAndNestedObjects()
    {
        var result = Run("""{ "rows": [ { "id": 9007199254740993 } ] }""");

        Assert.Equal("$.rows[0].id", Assert.Single(result.Notes).Path);
    }
}
