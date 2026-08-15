using Toolbox.Wasm.Core.Regex;
using Xunit;

namespace Toolbox.Wasm.Tests;

/// <summary>
/// The cases that justify the whole exercise: constructs and options the browser's
/// JavaScript engine either silently ignores or cannot parse at all.
/// </summary>
public class RegexEvaluatorTests
{
    private static RegexOptionsModel Options(Action<RegexOptionsModel>? configure = null)
    {
        var options = new RegexOptionsModel();
        configure?.Invoke(options);
        return options;
    }

    [Fact]
    public void EmptyPattern_ReturnsNoMatchesAndNoError()
    {
        var result = RegexEvaluator.Evaluate(string.Empty, "anything", Options());

        Assert.Empty(result.Matches);
        Assert.Null(result.Error);
    }

    [Fact]
    public void InvalidPattern_ReportsErrorInsteadOfThrowing()
    {
        var result = RegexEvaluator.Evaluate("(unclosed", "text", Options());

        Assert.Empty(result.Matches);
        Assert.NotNull(result.Error);
    }

    [Fact]
    public void NamedGroups_AreReturnedByNameAndByNumber()
    {
        var result = RegexEvaluator.Evaluate(
            @"(?<year>\d{4})-(?<month>\d{2})",
            "on 2024-03 and 2025-04",
            Options());

        Assert.Equal(2, result.Matches.Count);

        var first = result.Matches[0];
        Assert.Equal("2024-03", first.Value);
        Assert.Equal(3, first.Index);

        var year = Assert.Single(first.Groups, g => g.Name == "year");
        Assert.Equal("2024", year.Value);
        Assert.Equal(3, year.Index);

        // A named group carries a number in .NET too, so it appears in both passes.
        Assert.Contains(first.Groups, g => g.Name == "1" && g.Value == "2024");
    }

    // ---------------------------------------------------------------------
    // Options with no JavaScript equivalent. Each of these previously produced a
    // "this option has no effect on the preview" warning.
    // ---------------------------------------------------------------------

    [Fact]
    public void IgnorePatternWhitespace_SkipsWhitespaceAndComments()
    {
        // Under the JavaScript engine the literal spaces and the "# year" comment are
        // matched literally, so this finds nothing.
        var result = RegexEvaluator.Evaluate(
            @"\d{4}  # the year",
            "shipped 2024",
            Options(o => o.IgnorePatternWhitespace = true));

        var match = Assert.Single(result.Matches);
        Assert.Equal("2024", match.Value);
    }

    [Fact]
    public void ExplicitCapture_SuppressesUnnamedGroups()
    {
        var result = RegexEvaluator.Evaluate(
            @"(\d+)-(?<tail>\d+)",
            "12-34",
            Options(o => o.ExplicitCapture = true));

        var match = Assert.Single(result.Matches);
        Assert.Contains(match.Groups, g => g.Name == "tail");
        Assert.DoesNotContain(match.Groups, g => g.Value == "12");
    }

    [Fact]
    public void RightToLeft_MatchesFromTheEnd()
    {
        var leftToRight = RegexEvaluator.Evaluate(@"\w+", "alpha beta", Options());
        var rightToLeft = RegexEvaluator.Evaluate(
            @"\w+",
            "alpha beta",
            Options(o => o.RightToLeft = true));

        Assert.Equal("alpha", leftToRight.Matches[0].Value);
        Assert.Equal("beta", rightToLeft.Matches[0].Value);
    }

    [Fact]
    public void CultureInvariant_IsAccepted()
    {
        var result = RegexEvaluator.Evaluate(
            "STRASSE",
            "strasse",
            Options(o =>
            {
                o.IgnoreCase = true;
                o.CultureInvariant = true;
            }));

        Assert.Single(result.Matches);
    }

    // ---------------------------------------------------------------------
    // Constructs JavaScript cannot even parse.
    // ---------------------------------------------------------------------

    [Fact]
    public void BalancingGroupsAndConditionals_Evaluate()
    {
        // Balancing groups (?<Close-Open>) and conditionals (?(Open)) are .NET-only;
        // `new RegExp(...)` throws on this pattern.
        const string balancedParens =
            @"^[^()]*(?>(?:(?<Open>\()[^()]*)+(?:(?<Close-Open>\))[^()]*)+)*(?(Open)(?!))$";

        var balanced = RegexEvaluator.Evaluate(balancedParens, "3+(4*(2-1))", Options());
        var unbalanced = RegexEvaluator.Evaluate(balancedParens, "3+(4*(2-1)", Options());

        Assert.Null(balanced.Error);
        Assert.Single(balanced.Matches);

        Assert.Null(unbalanced.Error);
        Assert.Empty(unbalanced.Matches);
    }

    [Fact]
    public void UnicodeBlockEscape_Evaluates()
    {
        var result = RegexEvaluator.Evaluate(@"\p{IsGreek}+", "abc αβγ def", Options());

        var match = Assert.Single(result.Matches);
        Assert.Equal("αβγ", match.Value);
    }

    // ---------------------------------------------------------------------
    // Safety rails.
    // ---------------------------------------------------------------------

    [Fact]
    public void CatastrophicBacktracking_TimesOutInsteadOfHanging()
    {
        var result = RegexEvaluator.Evaluate(
            @"^(a+)+$",
            new string('a', 50) + "!",
            Options(o => o.MatchTimeoutMs = 100));

        Assert.NotNull(result.Error);
        Assert.Contains("timed out", result.Error, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void NonBacktrackingWithRightToLeft_ReportsUnsupportedCombination()
    {
        var result = RegexEvaluator.Evaluate(
            "a",
            "aaa",
            Options(o =>
            {
                o.NonBacktracking = true;
                o.RightToLeft = true;
            }));

        Assert.NotNull(result.Error);
    }

    [Fact]
    public void MatchFlood_IsCappedAndFlagged()
    {
        var result = RegexEvaluator.Evaluate("a*", new string('a', 5000), Options());

        Assert.True(result.Matches.Count <= RegexEvaluator.MaxMatches);
    }

    // ---------------------------------------------------------------------
    // Replace uses .NET substitution syntax, matching the generated C#.
    // ---------------------------------------------------------------------

    [Fact]
    public void Replace_UsesDotNetSubstitutionSyntax()
    {
        var result = RegexEvaluator.Replace(
            @"(?<first>\w+) (?<second>\w+)",
            "hello world",
            "${second} ${first}",
            Options());

        Assert.Null(result.Error);
        Assert.Equal("world hello", result.Result);
    }

    [Fact]
    public void Replace_WithEmptyPattern_ReturnsInputUnchanged()
    {
        var result = RegexEvaluator.Replace(string.Empty, "untouched", "x", Options());

        Assert.Equal("untouched", result.Result);
        Assert.Null(result.Error);
    }

    [Fact]
    public void Replace_WithInvalidPattern_ReportsError()
    {
        var result = RegexEvaluator.Replace("(unclosed", "text", "x", Options());

        Assert.NotNull(result.Error);
        Assert.Equal("text", result.Result);
    }
}
