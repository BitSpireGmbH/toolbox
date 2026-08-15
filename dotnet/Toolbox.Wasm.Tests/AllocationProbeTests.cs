using Toolbox.Wasm.Core.Diagnostics;
using Xunit;

namespace Toolbox.Wasm.Tests;

/// <summary>
/// These are the assertions the Span&lt;T&gt; Visualizer's allocation banner exists to make
/// true. The page used to print "1 allocation" and "0 allocations" as static text; if the
/// probe measured the wrong thing, or the loops were optimised away, the numbers would
/// still look plausible and be meaningless. These are what catch that.
///
/// They run headless via <c>npm run test:wasm</c> - no browser, no WebAssembly - so the
/// absolute byte counts here are desktop .NET's, not the browser's. Everything asserted
/// is therefore a relationship (zero, or grows with length), never a fixed number.
/// </summary>
public class AllocationProbeTests
{
    private const string Sample = "The quick brown fox jumps over the lazy dog";

    private static SliceAllocationResult Measure(int start, int length, int iterations = 500) =>
        AllocationProbe.MeasureSlice(new SliceAllocationRequest
        {
            Input = Sample,
            Start = start,
            Length = length,
            Iterations = iterations,
        });

    private static AllocationSample Sample_(SliceAllocationResult result, string id) =>
        result.Samples.Single(s => s.Id == id);

    [Fact]
    public void SpanSlice_AllocatesNothing()
    {
        // The headline claim of the whole tool.
        var result = Measure(4, 5);

        Assert.Equal(0, Sample_(result, "span-slice").TotalBytes);
        Assert.Equal(0, Sample_(result, "span-slice").BytesPerOperation);
    }

    [Fact]
    public void Substring_Allocates()
    {
        var result = Measure(4, 5);

        Assert.True(Sample_(result, "substring").BytesPerOperation > 0);
    }

    [Fact]
    public void MaterialisingASpanCostsTheSameAsSubstring()
    {
        // The honest counterweight: Span defers the copy, it does not abolish it. If these
        // two ever diverge, the lesson on the page is wrong.
        var result = Measure(4, 10);

        Assert.Equal(
            Sample_(result, "substring").BytesPerOperation,
            Sample_(result, "span-tostring").BytesPerOperation);
    }

    [Fact]
    public void SubstringCostGrowsWithSliceLength_WhileSpanStaysFlat()
    {
        // This is what makes the visualiser interactive rather than a static fact: dragging
        // the length control has to move one number and not the other.
        var shortSlice = Measure(0, 4);
        var longSlice = Measure(0, 40);

        Assert.True(
            Sample_(longSlice, "substring").BytesPerOperation
                > Sample_(shortSlice, "substring").BytesPerOperation);

        Assert.Equal(0, Sample_(longSlice, "span-slice").BytesPerOperation);
        Assert.Equal(0, Sample_(shortSlice, "span-slice").BytesPerOperation);
    }

    [Fact]
    public void LoopsAreNotOptimisedAway()
    {
        // If the JIT elided the Substring loop, per-operation bytes would collapse to zero
        // and the tool would confidently report that Substring is free.
        var few = Measure(0, 8, iterations: 100);
        var many = Measure(0, 8, iterations: 1000);

        Assert.True(many.Samples.Single(s => s.Id == "substring").TotalBytes
            > few.Samples.Single(s => s.Id == "substring").TotalBytes);
    }

    [Theory]
    [InlineData(-1, 4)]
    [InlineData(0, 500)]
    [InlineData(40, 10)]
    public void OutOfRangeSlices_ReportAnErrorRatherThanThrowing(int start, int length)
    {
        var result = Measure(start, length);

        Assert.NotNull(result.Error);
        Assert.Empty(result.Samples);
    }

    [Fact]
    public void EmptySlice_IsMeasurableAndAllocatesNothingForSpan()
    {
        var result = Measure(0, 0);

        Assert.Null(result.Error);
        Assert.Equal(0, Sample_(result, "span-slice").BytesPerOperation);
    }

    [Fact]
    public void IterationCount_IsClampedRatherThanTrusted()
    {
        // A hostile or buggy caller must not be able to make the browser sit still.
        var result = AllocationProbe.MeasureSlice(new SliceAllocationRequest
        {
            Input = Sample,
            Start = 0,
            Length = 4,
            Iterations = int.MaxValue,
        });

        Assert.True(result.Iterations <= 200_000);
    }

    [Fact]
    public void EverySampleCarriesTheCodeItMeasured()
    {
        // A number with no attributable line of code is not evidence of anything.
        var result = Measure(2, 6);

        Assert.All(result.Samples, s => Assert.False(string.IsNullOrWhiteSpace(s.Code)));
        Assert.Contains("Substring(2, 6)", Sample_(result, "substring").Code, StringComparison.Ordinal);
        Assert.Contains("AsSpan(2, 6)", Sample_(result, "span-slice").Code, StringComparison.Ordinal);
    }

    [Fact]
    public void ResultNamesTheRuntimeThatMeasuredIt()
    {
        // These are not desktop numbers. The tool has to say so.
        var result = Measure(0, 4);

        Assert.False(string.IsNullOrWhiteSpace(result.RuntimeNote));
    }
}
