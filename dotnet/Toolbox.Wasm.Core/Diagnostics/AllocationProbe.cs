using System.Runtime.CompilerServices;

namespace Toolbox.Wasm.Core.Diagnostics;

/// <summary>
/// Measures what slicing a string actually allocates, using the runtime's own accounting
/// (<see cref="GC.GetAllocatedBytesForCurrentThread"/>).
///
/// The Span&lt;T&gt; Visualizer used to print "1 allocation" and "0 allocations" as static
/// text. Those numbers were correct, but the tool was asserting them rather than showing
/// them - which is exactly the gap the .NET runtime in the browser closes. Now the page
/// reports what this measured.
///
/// Deliberately free of any WebAssembly or interop dependency - it targets plain net10.0
/// so the behaviour can be asserted in unit tests without a browser.
/// </summary>
public static class AllocationProbe
{
    /// <summary>Keeps the loops from being optimised into nothing.</summary>
    private static long sink;

    /// <summary>
    /// Guards against a pathological request making the browser sit still. Each iteration
    /// is a handful of instructions, so this is far more headroom than any demo needs.
    /// </summary>
    private const int MaxIterations = 200_000;

    public static SliceAllocationResult MeasureSlice(SliceAllocationRequest request)
    {
        var input = request.Input ?? string.Empty;
        var iterations = Math.Clamp(request.Iterations, 1, MaxIterations);

        if (request.Start < 0 || request.Length < 0 || request.Start + request.Length > input.Length)
        {
            return new SliceAllocationResult(
                [],
                iterations,
                RuntimeNote(),
                $"The slice [{request.Start}..{request.Start + request.Length}] does not fit "
                    + $"inside a string of length {input.Length}.");
        }

        var start = request.Start;
        var length = request.Length;

        var samples = new List<AllocationSample>
        {
            Measure(
                "substring",
                "s.Substring(start, length)",
                $"var part = s.Substring({start}, {length});",
                iterations,
                () =>
                {
                    var part = input.Substring(start, length);
                    Consume(part.Length);
                }),

            Measure(
                "span-slice",
                "s.AsSpan(start, length)",
                $"ReadOnlySpan<char> part = s.AsSpan({start}, {length});",
                iterations,
                () =>
                {
                    var part = input.AsSpan(start, length);
                    Consume(part.Length);
                }),

            // The honest counterweight. Span is not magic - it defers the copy, it does not
            // abolish it. The moment you materialise the slice back into a string you pay
            // exactly what Substring charged in the first place.
            Measure(
                "span-tostring",
                "s.AsSpan(start, length).ToString()",
                $"string part = s.AsSpan({start}, {length}).ToString();",
                iterations,
                () =>
                {
                    var part = input.AsSpan(start, length).ToString();
                    Consume(part.Length);
                }),
        };

        return new SliceAllocationResult(samples, iterations, RuntimeNote());
    }

    private static AllocationSample Measure(
        string id,
        string label,
        string code,
        int iterations,
        Action body)
    {
        // One untimed call first. The very first execution of a method pays one-off costs
        // that belong to neither operation, and attributing them to the span row would make
        // "zero allocations" look false.
        body();

        var before = GC.GetAllocatedBytesForCurrentThread();
        for (var i = 0; i < iterations; i++)
        {
            body();
        }

        var total = GC.GetAllocatedBytesForCurrentThread() - before;

        // Never negative, even if the counter behaves oddly on a given runtime.
        total = Math.Max(0, total);

        return new AllocationSample(id, label, total, total / iterations, code);
    }

    /// <summary>
    /// Prevents the loop bodies being elided. <see cref="MethodImplOptions.NoInlining"/>
    /// so the call itself cannot be reasoned away either.
    /// </summary>
    [MethodImpl(MethodImplOptions.NoInlining)]
    private static void Consume(int value) => sink += value;

    private static string RuntimeNote() =>
        $"Measured by {System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription} "
            + "in your browser. Byte counts are this runtime's; the shape of the result is the "
            + "same on desktop .NET, the exact numbers are not.";
}
