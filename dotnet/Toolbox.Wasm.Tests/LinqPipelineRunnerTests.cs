using Toolbox.Wasm.Core.Linq;
using Xunit;

namespace Toolbox.Wasm.Tests;

/// <summary>
/// These are the assertions the LINQ Visualizer exists to make true. The tool claims to
/// show *when* each element moves through a pipeline; if the trace were reconstructed
/// rather than observed, these tests are what would catch it.
///
/// They run headless via <c>npm run test:wasm</c> - no browser, no WebAssembly - which
/// is the whole reason the logic lives in Toolbox.Wasm.Core.
/// </summary>
public class LinqPipelineRunnerTests
{
    private static LinqOperatorSpec Op(string id, double? number = null, string? text = null) =>
        new() { Id = id, Number = number, Text = text };

    private static LinqPipelineSpec Numbers(
        int count,
        string terminal,
        params LinqOperatorSpec[] operators) =>
        new()
        {
            Source = new LinqSourceSpec { Kind = "numbers", Count = count },
            Operators = [.. operators],
            Terminal = terminal,
        };

    /// <summary>Compact "kind@stage" form, so an expected sequence is readable in one line.</summary>
    private static string[] Signature(LinqRunResult result) =>
        [.. result.Events.Select(traceEvent => $"{traceEvent.Kind}@{traceEvent.Stage}")];

    [Fact]
    public void NoTerminalOperator_RunsNothingAtAll()
    {
        // The headline lesson: a query is a description, and describing it costs nothing.
        var result = LinqPipelineRunner.Run(
            Numbers(8, "none", Op("where-greater-than", 3), Op("select-double")));

        Assert.Null(result.Error);
        Assert.Empty(result.Events);
        Assert.Equal(0, result.Stats.TotalEvents);
        Assert.Equal(0, result.Stats.SourcePulls);
        Assert.Contains("Nothing ran", result.ResultText, StringComparison.Ordinal);
    }

    [Fact]
    public void WhereThenSelect_MovesOneElementAllTheWayThroughBeforeStartingTheNext()
    {
        // The most commonly held wrong model is that Where runs over the whole sequence
        // and *then* Select does. The first six events prove otherwise.
        var result = LinqPipelineRunner.Run(
            Numbers(3, "toList", Op("where-greater-than", 0), Op("select-double")));

        Assert.Null(result.Error);

        string[] expected = ["pulled@2", "pulled@1", "pulled@0", "yielded@0", "yielded@1", "yielded@2"];
        Assert.Equal(expected, Signature(result).Take(6).ToArray());

        // The second element is not touched until the first has left the pipeline.
        Assert.Equal("1", result.Events[3].Value);
        Assert.Equal("2", result.Events[5].Value);
    }

    [Fact]
    public void First_StopsPullingAsSoonAsItHasAnElement()
    {
        // A thousand-element source, three pulls.
        var result = LinqPipelineRunner.Run(Numbers(1000, "first", Op("where-greater-than", 2)));

        Assert.Null(result.Error);
        Assert.Equal(3, result.Stats.SourcePulls);
        Assert.True(result.Stats.ShortCircuited);
        Assert.DoesNotContain("exhausted@0", Signature(result));
        Assert.Equal("3", result.ResultText);
    }

    [Fact]
    public void Take_StopsTheWholePipelineOnceItHasEnough()
    {
        var result = LinqPipelineRunner.Run(Numbers(100, "toList", Op("take", 3)));

        Assert.Null(result.Error);
        Assert.Equal(3, result.Stats.SourcePulls);
        Assert.True(result.Stats.ShortCircuited);
    }

    [Fact]
    public void OrderBy_DrainsTheEntireSourceBeforeYieldingAnything()
    {
        // The counterpoint to the streaming demo, and the reason a stray OrderBy in
        // front of a First() can be so expensive.
        var result = LinqPipelineRunner.Run(Numbers(8, "first", Op("order-by-desc")));

        Assert.Null(result.Error);

        var signature = Signature(result);
        var sourceExhausted = Array.IndexOf(signature, "exhausted@0");
        var firstSortedYield = Array.IndexOf(signature, "yielded@1");

        Assert.True(sourceExhausted >= 0, "OrderBy must have run the source dry.");
        Assert.True(
            sourceExhausted < firstSortedYield,
            "OrderBy yielded before the source was exhausted, which it cannot do.");

        Assert.False(result.Stats.ShortCircuited);
        Assert.Equal(8, result.Stats.SourceYields);

        // Sorting descending means the answer was the *last* number fetched - the most
        // vivid possible demonstration that it had to see them all.
        Assert.Equal("8", result.ResultText);
    }

    [Fact]
    public void EnumeratingTwice_RunsTheSourceAgainFromScratch()
    {
        var once = LinqPipelineRunner.Run(Numbers(4, "toList"));

        var spec = Numbers(4, "toList");
        spec.EnumerateTwice = true;
        var twice = LinqPipelineRunner.Run(spec);

        Assert.Null(twice.Error);
        Assert.Equal(once.Stats.SourcePulls * 2, twice.Stats.SourcePulls);
        Assert.Contains(twice.Events, traceEvent => traceEvent.Pass == 1);
        Assert.Contains("recipe", twice.ResultText, StringComparison.Ordinal);
    }

    [Fact]
    public void Skip_StillPullsTheElementsItDiscards()
    {
        // "Skip is free" is a common assumption. It isn't - the elements are produced.
        var result = LinqPipelineRunner.Run(Numbers(5, "toList", Op("skip", 3)));

        Assert.Equal(5, result.Stats.SourceYields);
        Assert.Contains("[4, 5]", result.ResultText, StringComparison.Ordinal);
    }

    [Fact]
    public void StageKinds_DistinguishStreamingFromBuffering()
    {
        var result = LinqPipelineRunner.Run(
            Numbers(6, "toList", Op("where-greater-than", 2), Op("order-by-desc")));

        Assert.Collection(
            result.Stages,
            stage => Assert.Equal("source", stage.Kind),
            stage => Assert.Equal("streaming", stage.Kind),
            stage => Assert.Equal("buffering", stage.Kind));
    }

    [Fact]
    public void StageLabels_ShowTheArgumentTheUserActuallyChose()
    {
        var result = LinqPipelineRunner.Run(Numbers(5, "toList", Op("where-greater-than", 42)));

        Assert.Equal("Where(n => n > 42)", result.Stages[1].Label);
    }

    [Fact]
    public void FirstOnAnEmptySequence_ReportsTheExceptionAsTheOutcome()
    {
        // Not a tool failure - it is the behaviour being demonstrated.
        var result = LinqPipelineRunner.Run(Numbers(3, "first", Op("where-greater-than", 100)));

        Assert.Null(result.Error);
        Assert.Contains("InvalidOperationException", result.ResultText, StringComparison.Ordinal);
    }

    [Fact]
    public void TakeWhile_StopsAtTheFirstFailureEvenIfLaterNumbersWouldPass()
    {
        // Reverse first, so the sequence is 5,4,3,2,1. TakeWhile(n < 4) then takes
        // nothing at all - while Take(3) would have taken three. That difference is the
        // entire reason the operator exists, and it is invisible on a sorted source.
        var result = LinqPipelineRunner.Run(
            Numbers(5, "toList", Op("reverse"), Op("take-while", 4)));

        Assert.Null(result.Error);
        Assert.Contains("[]", result.ResultText, StringComparison.Ordinal);
    }

    [Fact]
    public void SkipWhile_StopsSkippingOnceTheTestFails()
    {
        // Reversed: 5,4,3,2,1. SkipWhile(n < 4) skips nothing, because the very first
        // number already fails the test - so everything comes through.
        var result = LinqPipelineRunner.Run(
            Numbers(5, "toList", Op("reverse"), Op("skip-while", 4)));

        Assert.Null(result.Error);
        Assert.Contains("[5, 4, 3, 2, 1]", result.ResultText, StringComparison.Ordinal);
    }

    [Fact]
    public void Distinct_DropsRepeatsAsTheyStreamPast()
    {
        // n % 3 over 1..7 is 1,2,0,1,2,0,1 - so Distinct has something to do.
        var result = LinqPipelineRunner.Run(
            Numbers(7, "toList", Op("select-mod", 3), Op("distinct")));

        Assert.Null(result.Error);
        Assert.Contains("[1, 2, 0]", result.ResultText, StringComparison.Ordinal);
    }

    [Fact]
    public void SelectMod_TreatsAZeroDivisorAsOneRatherThanThrowing()
    {
        // The one arithmetic hole in an int-to-int palette. A user can type 0, and
        // DivideByZeroException would break the promise that nothing here can fail.
        var result = LinqPipelineRunner.Run(Numbers(4, "toList", Op("select-mod", 0)));

        Assert.Null(result.Error);
        Assert.DoesNotContain("Exception", result.ResultText, StringComparison.Ordinal);
        Assert.Contains("[0, 0, 0, 0]", result.ResultText, StringComparison.Ordinal);

        // The generated C# has to show the value that actually ran, not the 0 typed in.
        Assert.Contains("% 1", result.MethodSyntax, StringComparison.Ordinal);
    }

    [Fact]
    public void Last_HasToFetchEverythingDespiteSoundingCheap()
    {
        var result = LinqPipelineRunner.Run(Numbers(6, "last"));

        Assert.Null(result.Error);
        Assert.Equal("6", result.ResultText);
        Assert.False(result.Stats.ShortCircuited);
        Assert.Equal(6, result.Stats.SourceYields);
    }

    [Fact]
    public void OrderByAscending_BuffersJustLikeItsDescendingTwin()
    {
        var result = LinqPipelineRunner.Run(Numbers(5, "first", Op("order-by-asc")));

        var signature = Signature(result);
        Assert.True(
            Array.IndexOf(signature, "exhausted@0") < Array.IndexOf(signature, "yielded@1"),
            "OrderBy yielded before the source was exhausted, which it cannot do.");
        Assert.Equal("1", result.ResultText);
    }

    [Fact]
    public void EveryPairOfOperators_ComposesWithoutFailing()
    {
        // The palette is int -> int throughout precisely so that a beginner poking at
        // combinations can never land on an error telling them they got it wrong.
        // If an operator is ever added that changes the element type, this catches it.
        var ids = OperatorCatalog.Describe().Operators.Select(info => info.Id).ToArray();

        Assert.NotEmpty(ids);

        foreach (var first in ids)
        {
            foreach (var second in ids)
            {
                var result = LinqPipelineRunner.Run(
                    Numbers(6, "toList", Op(first), Op(second)));

                Assert.Null(result.Error);
                Assert.DoesNotContain("Exception", result.ResultText, StringComparison.Ordinal);
            }
        }
    }

    [Fact]
    public void EveryTerminal_RunsAgainstAnyChain()
    {
        var terminals = OperatorCatalog.Describe().Terminals.Select(info => info.Id);

        foreach (var terminal in terminals)
        {
            var result = LinqPipelineRunner.Run(
                Numbers(6, terminal, Op("where-greater-than", 2), Op("select-double")));

            Assert.Null(result.Error);
            Assert.DoesNotContain("Exception", result.ResultText, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void RunawayPipelines_AreTruncatedRatherThanAllowedToFillTheLog()
    {
        var result = LinqPipelineRunner.Run(Numbers(
            200,
            "toList",
            Op("select-double"),
            Op("select-double"),
            Op("select-double"),
            Op("select-double"),
            Op("select-double")));

        Assert.True(result.Truncated);
        Assert.True(result.Events.Count <= TraceLogLimit);
    }

    /// <summary>Mirrors <c>TraceLog.MaxEvents</c>, which is internal to the Core assembly.</summary>
    private const int TraceLogLimit = 2000;

    [Fact]
    public void UnknownOperator_IsReportedAsAnError()
    {
        var result = LinqPipelineRunner.Run(Numbers(5, "toList", Op("does-not-exist")));

        Assert.NotNull(result.Error);
        Assert.Empty(result.Events);
    }

    [Fact]
    public void MethodSyntax_MatchesTheChainThatRan()
    {
        var result = LinqPipelineRunner.Run(
            Numbers(6, "toList", Op("where-greater-than", 2), Op("select-double")));

        Assert.Contains("var numbers = Enumerable.Range(1, 6);", result.MethodSyntax, StringComparison.Ordinal);
        Assert.Contains(".Where(n => n > 2)", result.MethodSyntax, StringComparison.Ordinal);
        Assert.Contains(".Select(n => n * 2);", result.MethodSyntax, StringComparison.Ordinal);
        Assert.Contains("var result = query.ToList();", result.MethodSyntax, StringComparison.Ordinal);
    }

    [Fact]
    public void QuerySyntax_IsEmittedWhenTheChainGenuinelyMapsOntoAQueryExpression()
    {
        var result = LinqPipelineRunner.Run(
            Numbers(6, "toList", Op("where-greater-than", 2), Op("select-double")));

        Assert.NotNull(result.QuerySyntax);
        Assert.Contains("from n in numbers", result.QuerySyntax!, StringComparison.Ordinal);
        Assert.Contains("where n > 2", result.QuerySyntax!, StringComparison.Ordinal);
        Assert.Contains("select n * 2;", result.QuerySyntax!, StringComparison.Ordinal);
    }

    [Fact]
    public void QuerySyntax_AddsTheIdentityProjectionWhenTheChainHasNoSelect()
    {
        var result = LinqPipelineRunner.Run(Numbers(6, "toList", Op("where-greater-than", 2)));

        Assert.NotNull(result.QuerySyntax);
        Assert.Contains("select n;", result.QuerySyntax!, StringComparison.Ordinal);
    }

    [Fact]
    public void QuerySyntax_IsOmittedForChainsWithNoClauseEquivalent()
    {
        // Take has no query-syntax form. Emitting almost-right C# would undercut the
        // one promise this tool makes.
        var result = LinqPipelineRunner.Run(Numbers(6, "toList", Op("take", 2)));

        Assert.Null(result.QuerySyntax);
    }

    [Fact]
    public void QuerySyntax_IsOmittedWhenClausesWouldBeOutOfOrder()
    {
        // select-then-where would need an `into` continuation.
        var result = LinqPipelineRunner.Run(
            Numbers(6, "toList", Op("select-double"), Op("where-greater-than", 4)));

        Assert.Null(result.QuerySyntax);
    }
}
