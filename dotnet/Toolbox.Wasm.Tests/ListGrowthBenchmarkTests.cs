using Toolbox.Wasm.Core.Collections;
using Xunit;

namespace Toolbox.Wasm.Tests;

/// <summary>
/// These are the assertions the List&lt;T&gt; Visualizer's benchmark tab exists to make true.
/// The page has always claimed that preallocating "can improve performance"; if the probe
/// measured the wrong thing, or the build loops were optimised away, the numbers would still
/// look plausible and be meaningless. These are what catch that.
///
/// They run headless via <c>npm run test:wasm</c> - no browser, no WebAssembly - so the
/// absolute byte counts here are desktop .NET's, not the browser's. Everything asserted is
/// therefore a relationship (zero, or fewer than, or doubles), never a fixed number. The only
/// claim made about the timings is that they are positive: wall-clock on a shared CI runner is
/// exactly the kind of measurement that fails for reasons unrelated to the code.
/// </summary>
public class ListGrowthBenchmarkTests
{
    private static ListBenchmarkResult Run(int adds, int capacity, int rounds = 1) =>
        ListGrowthBenchmark.Run(new ListBenchmarkRequest
        {
            Adds = adds,
            Capacity = capacity,
            Rounds = rounds,
        });

    private static ListBenchmarkRun Variant(ListBenchmarkResult result, string id) =>
        result.Runs.Single(run => run.Id == id);

    [Fact]
    public void Reports_both_variants()
    {
        var result = Run(adds: 1_000, capacity: 1_000);

        Assert.Equal(new[] { "default", "preallocated" }, result.Runs.Select(run => run.Id));
        Assert.Null(result.Error);
    }

    [Fact]
    public void Preallocating_enough_capacity_removes_every_resize()
    {
        var result = Run(adds: 1_000, capacity: 1_000);

        Assert.Equal(0, Variant(result, "preallocated").ResizeCount);
        Assert.Empty(Variant(result, "preallocated").Growth);
    }

    [Fact]
    public void Preallocating_leaves_the_capacity_exactly_as_asked()
    {
        var result = Run(adds: 1_000, capacity: 1_500);

        Assert.Equal(1_500, Variant(result, "preallocated").FinalCapacity);
    }

    [Fact]
    public void The_default_list_resizes_repeatedly()
    {
        var result = Run(adds: 1_000, capacity: 1_000);
        var run = Variant(result, "default");

        Assert.True(run.ResizeCount > 0, "A default list filled to 1000 must have resized.");
        Assert.True(run.FinalCapacity >= 1_000);
    }

    [Fact]
    public void The_first_allocation_is_not_counted_as_a_resize()
    {
        // Four adds fit in the first array exactly, so an array is allocated but nothing is
        // ever copied. Counting that as a resize would overstate the cost of the default.
        var run = Variant(Run(adds: 4, capacity: 0), "default");

        Assert.Equal(0, run.ResizeCount);
        Assert.Equal(new GrowthStep(1, 0, 4), Assert.Single(run.Growth));
    }

    [Fact]
    public void The_observed_growth_doubles_from_four()
    {
        var run = Variant(Run(adds: 100, capacity: 100), "default");

        Assert.Equal(
            new[] { 4, 8, 16, 32, 64, 128 },
            run.Growth.Select(step => step.ToCapacity));

        // Every step but the first hands on the capacity the previous one produced, so the
        // sequence is a real chain rather than independently sampled numbers.
        Assert.Equal(
            run.Growth.Take(run.Growth.Count - 1).Select(step => step.ToCapacity),
            run.Growth.Skip(1).Select(step => step.FromCapacity));
    }

    [Fact]
    public void Preallocating_allocates_strictly_fewer_bytes()
    {
        var result = Run(adds: 10_000, capacity: 10_000);

        Assert.True(
            Variant(result, "preallocated").AllocatedBytes
                < Variant(result, "default").AllocatedBytes,
            "Growing by doubling allocates every intermediate array; preallocating allocates one.");
    }

    [Fact]
    public void Allocations_are_actually_measured_rather_than_optimised_away()
    {
        var run = Variant(Run(adds: 10_000, capacity: 10_000), "preallocated");

        // One int[10000] is 40KB before headers. If the build loop had been elided, or the
        // GC counter never read, this would be zero.
        Assert.True(run.AllocatedBytes >= 40_000, $"Allocated only {run.AllocatedBytes} bytes.");
    }

    [Fact]
    public void Under_allocating_still_reports_its_resizes()
    {
        // The preallocated column is not allowed to look like a win when it is not one.
        var run = Variant(Run(adds: 10_000, capacity: 100), "preallocated");

        Assert.True(run.ResizeCount > 0);
        Assert.Equal(100, run.Growth[0].FromCapacity);
    }

    [Fact]
    public void A_capacity_of_zero_behaves_exactly_like_no_capacity()
    {
        var result = Run(adds: 1_000, capacity: 0);

        var fallback = Variant(result, "default");
        var requested = Variant(result, "preallocated");

        Assert.Equal(fallback.ResizeCount, requested.ResizeCount);
        Assert.Equal(fallback.FinalCapacity, requested.FinalCapacity);
        Assert.Equal("new List<int>()", requested.Label);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(int.MinValue)]
    public void Non_positive_add_counts_are_clamped_rather_than_throwing(int adds)
    {
        var result = Run(adds, capacity: 10);

        Assert.Equal(1, result.Adds);
    }

    [Fact]
    public void A_pathological_request_is_clamped_and_says_so()
    {
        var result = Run(adds: int.MaxValue, capacity: int.MaxValue, rounds: int.MaxValue);

        // The reported counts are the ones actually run, not the ones asked for, so the UI
        // cannot label a clamped run with the user's original number.
        Assert.True(result.Adds < int.MaxValue);
        Assert.True(result.Capacity < int.MaxValue);
        Assert.True(result.Rounds < int.MaxValue);
        Assert.Equal(result.Capacity, Variant(result, "preallocated").FinalCapacity);
    }

    [Fact]
    public void The_reported_code_matches_the_variant_that_was_measured()
    {
        var result = Run(adds: 250, capacity: 250);

        Assert.Contains("new List<int>()", Variant(result, "default").Code);
        Assert.Contains("new List<int>(250)", Variant(result, "preallocated").Code);
        Assert.Contains("i < 250", Variant(result, "default").Code);
    }

    [Fact]
    public void Every_run_names_the_runtime_that_measured_it()
    {
        var result = Run(adds: 100, capacity: 100);

        Assert.Contains(".NET", result.RuntimeNote);
    }

    [Fact]
    public void Timings_are_positive_so_a_coarse_clock_never_reports_zero()
    {
        // The point of repeating each round up to a minimum duration: a 10-item build is far
        // below the resolution of a browser's clamped clock, and "0.0 ms" would be a lie.
        var result = Run(adds: 10, capacity: 10, rounds: 3);

        Assert.All(result.Runs, run => Assert.True(run.BestElapsedMs > 0));
        Assert.All(result.Runs, run => Assert.True(run.MedianElapsedMs >= run.BestElapsedMs));
    }
}
