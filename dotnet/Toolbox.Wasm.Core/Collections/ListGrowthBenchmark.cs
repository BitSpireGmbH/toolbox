using System.Diagnostics;
using System.Runtime.CompilerServices;

namespace Toolbox.Wasm.Core.Collections;

/// <summary>
/// Measures what it actually costs to fill a <c>List&lt;int&gt;</c>, with and without
/// preallocating its capacity.
///
/// The List&lt;T&gt; Visualizer animates the allocate -> copy -> add -> discard cycle and then
/// closes by asserting that <c>new List&lt;T&gt;(capacity)</c> "can improve performance". That
/// claim was the last piece of the page still taking itself on trust: the animation is a
/// TypeScript simulation with invented addresses. This runs the real thing on the real runtime
/// and reports what happened, the same way <see cref="Diagnostics.AllocationProbe"/> replaced
/// the Span&lt;T&gt; page's hard-coded allocation counts.
///
/// Deliberately free of any WebAssembly or interop dependency - it targets plain net10.0 so
/// the behaviour can be asserted in unit tests without a browser.
/// </summary>
public static class ListGrowthBenchmark
{
    /// <summary>Keeps the build loops from being optimised into nothing.</summary>
    private static long sink;

    /// <summary>
    /// Guards against a pathological request wedging the browser tab. Unlike the substring
    /// probe this measures a whole loop per repetition, so the ceiling is set by how long the
    /// worst case blocks the main thread - rounds x variants x adds - rather than by how many
    /// cheap operations fit in a frame.
    /// </summary>
    private const int MaxAdds = 200_000;

    private const int MaxRounds = 15;

    /// <summary>
    /// Doubling from 4 reaches <see cref="MaxAdds"/> in under twenty steps, so this is only a
    /// backstop against a future growth policy that reallocated far more often.
    /// </summary>
    private const int MaxGrowthSteps = 64;

    /// <summary>
    /// Browsers clamp timer resolution for Spectre mitigation, so a small build can finish
    /// below what the clock can see and report a meaningless zero. Each round therefore
    /// repeats the build until it has done at least this much work, and divides.
    /// </summary>
    private const double MinRoundMs = 10.0;

    /// <summary>Stops the repeat loop if the clock never advances at all.</summary>
    private const int MaxRepeatsPerRound = 100_000;

    public static ListBenchmarkResult Run(ListBenchmarkRequest request)
    {
        var adds = Math.Clamp(request.Adds, 1, MaxAdds);
        var capacity = Math.Clamp(request.Capacity, 0, MaxAdds);
        var rounds = Math.Clamp(request.Rounds, 1, MaxRounds);

        var runs = new List<ListBenchmarkRun>
        {
            Measure("default", 0, adds, rounds),
            Measure("preallocated", capacity, adds, rounds),
        };

        return new ListBenchmarkResult(runs, adds, capacity, rounds, RuntimeNote());
    }

    /// <summary>
    /// Three passes rather than one, because the three questions interfere with each other.
    /// Reading <c>Capacity</c> after every <c>Add</c> is what makes the resize count a
    /// measurement instead of a restatement of the doubling rule, but it also puts a property
    /// call in the middle of the loop being timed. So the shape is observed once, the
    /// allocations are counted once (they are deterministic, so once is enough), and only then
    /// is a completely unobserved loop handed to the clock.
    /// </summary>
    private static ListBenchmarkRun Measure(string id, int capacity, int adds, int rounds)
    {
        var (resizeCount, finalCapacity, growth) = Shape(capacity, adds);
        var allocatedBytes = Allocated(capacity, adds);
        var (best, median) = Time(capacity, adds, rounds);

        return new ListBenchmarkRun(
            id,
            Construction(capacity),
            Code(capacity, adds),
            best,
            median,
            allocatedBytes,
            resizeCount,
            finalCapacity,
            growth);
    }

    /// <summary>
    /// Watches the capacity change during a real build. The first allocation (0 -> 4) is
    /// recorded in the sequence but not counted as a resize: it has nothing to copy, and the
    /// page's own explanation treats it as the initial allocation rather than a resize.
    /// </summary>
    private static (int ResizeCount, int FinalCapacity, IReadOnlyList<GrowthStep> Growth) Shape(
        int capacity,
        int adds)
    {
        var list = NewList(capacity);
        var previous = list.Capacity;
        var growth = new List<GrowthStep>();
        var resizeCount = 0;

        for (var i = 0; i < adds; i++)
        {
            list.Add(i);

            var current = list.Capacity;
            if (current == previous)
            {
                continue;
            }

            if (previous > 0)
            {
                resizeCount++;
            }

            if (growth.Count < MaxGrowthSteps)
            {
                growth.Add(new GrowthStep(list.Count, previous, current));
            }

            previous = current;
        }

        return (resizeCount, list.Capacity, growth);
    }

    /// <summary>
    /// Bytes for one build, from the runtime's own accounting. Deterministic - the same inputs
    /// allocate the same arrays every time - so unlike the timing this needs no repetition.
    /// </summary>
    private static long Allocated(int capacity, int adds)
    {
        // One untimed build first. The very first execution pays one-off costs that belong to
        // neither variant, and attributing them to whichever ran first would be misleading.
        Build(capacity, adds);

        var before = GC.GetAllocatedBytesForCurrentThread();
        Build(capacity, adds);
        var total = GC.GetAllocatedBytesForCurrentThread() - before;

        // Never negative, even if the counter behaves oddly on a given runtime.
        return Math.Max(0, total);
    }

    /// <summary>
    /// Returns the fastest and the median round, both in milliseconds per build. The best is
    /// the sample least disturbed by the scheduler and the GC; the median sitting next to it
    /// is what shows the reader whether the spread was wide enough to distrust either.
    /// </summary>
    private static (double Best, double Median) Time(int capacity, int adds, int rounds)
    {
        Build(capacity, adds);

        var samples = new double[rounds];

        for (var round = 0; round < rounds; round++)
        {
            var repeats = 0;
            var start = Stopwatch.GetTimestamp();
            double elapsedMs;

            do
            {
                Build(capacity, adds);
                repeats++;
                elapsedMs = ElapsedMs(start);
            }
            while (elapsedMs < MinRoundMs && repeats < MaxRepeatsPerRound);

            samples[round] = elapsedMs / repeats;
        }

        Array.Sort(samples);
        return (samples[0], Median(samples));
    }

    /// <summary>
    /// The operation being measured: construct, fill, done. Nothing is observed inside the
    /// loop.
    ///
    /// <see cref="Consume"/> is called once after the loop rather than once per <c>Add</c>.
    /// The allocation probe consumes per iteration because there the iteration *is* the
    /// operation; here a non-inlined call on every <c>Add</c> would cost more than the
    /// <c>Add</c> does and would drown out the difference this exists to show.
    /// </summary>
    private static void Build(int capacity, int adds)
    {
        var list = NewList(capacity);

        for (var i = 0; i < adds; i++)
        {
            list.Add(i);
        }

        Consume(list.Count);
    }

    /// <summary>
    /// A capacity of zero is not special-cased away: <c>new List&lt;int&gt;(0)</c> and
    /// <c>new List&lt;int&gt;()</c> genuinely behave the same, and showing two identical
    /// columns is the honest answer to "what does preallocating nothing buy me".
    /// </summary>
    private static List<int> NewList(int capacity) =>
        capacity > 0 ? new List<int>(capacity) : new List<int>();

    /// <summary>
    /// The constructor call as written in C#. Both the card's label and the snippet under it
    /// come from here, so they cannot drift apart - and a requested capacity of zero shows as
    /// <c>new List&lt;int&gt;()</c> in both, which is what <see cref="NewList"/> genuinely ran.
    /// </summary>
    private static string Construction(int capacity) =>
        capacity > 0 ? $"new List<int>({capacity})" : "new List<int>()";

    private static string Code(int capacity, int adds) =>
        $"var list = {Construction(capacity)};\n"
            + $"for (var i = 0; i < {adds}; i++)\n"
            + "{\n"
            + "    list.Add(i);\n"
            + "}";

    private static double ElapsedMs(long start) =>
        (Stopwatch.GetTimestamp() - start) * 1000.0 / Stopwatch.Frequency;

    private static double Median(double[] sorted) =>
        sorted.Length % 2 == 1
            ? sorted[sorted.Length / 2]
            : (sorted[(sorted.Length / 2) - 1] + sorted[sorted.Length / 2]) / 2.0;

    /// <summary>
    /// Prevents the build loops being elided. <see cref="MethodImplOptions.NoInlining"/> so
    /// the call itself cannot be reasoned away either.
    /// </summary>
    [MethodImpl(MethodImplOptions.NoInlining)]
    private static void Consume(int value) => sink += value;

    private static string RuntimeNote() =>
        $"Measured by {System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription} "
            + "in your browser. Allocated bytes and resize counts are exact and repeatable; the "
            + "timings are not, because browsers deliberately coarsen their clocks. Read the "
            + "ratio, not the millisecond.";
}
