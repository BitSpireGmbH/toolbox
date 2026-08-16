using System.Text.Json.Serialization;

namespace Toolbox.Wasm.Core.Collections;

/// <summary>
/// What the browser sends to have a <c>List&lt;int&gt;</c> build measured. The counts are the
/// ones the user actually chose in the visualiser, not a canned benchmark - the whole point
/// is that raising the preallocated capacity to meet the add count makes the resizes vanish
/// in front of them, and that only lands if the numbers move with the controls on screen.
/// </summary>
public sealed class ListBenchmarkRequest
{
    /// <summary>How many <c>Add</c> calls each variant performs.</summary>
    public int Adds { get; set; } = 10_000;

    /// <summary>
    /// The capacity handed to <c>new List&lt;int&gt;(capacity)</c>. Zero is allowed and is not
    /// a mistake: it is the honest way to show that preallocating nothing is the same as not
    /// preallocating at all.
    /// </summary>
    public int Capacity { get; set; } = 10_000;

    /// <summary>
    /// Timed repetitions. A single round is unreadable - browser timer resolution is clamped
    /// for Spectre mitigation, and one round catches whatever the scheduler happened to be
    /// doing. Several rounds give something to take a best and a median from.
    /// </summary>
    public int Rounds { get; set; } = 5;
}

/// <summary>
/// One observed reallocation of the backing array. Recorded by watching
/// <c>List&lt;T&gt;.Capacity</c> change during a real build, so the sequence is measured
/// rather than derived from the doubling rule.
/// </summary>
/// <param name="AtCount">The item count at which the capacity changed.</param>
/// <param name="FromCapacity">Capacity before. Zero means this was the first array, so there
/// was nothing to copy.</param>
/// <param name="ToCapacity">Capacity after.</param>
public sealed record GrowthStep(int AtCount, int FromCapacity, int ToCapacity);

/// <summary>One measured variant - either the default list or the preallocated one.</summary>
public sealed record ListBenchmarkRun(
    /// <summary><c>default</c> or <c>preallocated</c>.</summary>
    string Id,
    string Label,
    /// <summary>The C# that was measured, so a number is attributable to a line of code.</summary>
    string Code,
    /// <summary>Fastest round, in milliseconds per build. The least-disturbed sample.</summary>
    double BestElapsedMs,
    /// <summary>Median round. Shown next to the best so a wide spread is visible.</summary>
    double MedianElapsedMs,
    /// <summary>Bytes attributed to one build, as reported by the GC.</summary>
    long AllocatedBytes,
    /// <summary>
    /// Reallocations that had to copy existing elements. Deliberately excludes the very first
    /// array (0 -> 4), which allocates but copies nothing - the page's own explanation draws
    /// that same line, and counting it as a resize would overstate the cost of the default.
    /// </summary>
    int ResizeCount,
    int FinalCapacity,
    /// <summary>Every observed capacity change, including the first allocation.</summary>
    IReadOnlyList<GrowthStep> Growth);

/// <summary>
/// Mirrors the TypeScript <c>ListBenchmarkResult</c>.
///
/// <see cref="RuntimeNote"/> exists because these are Mono-on-WebAssembly numbers, not
/// CoreCLR-on-x64 ones, and because browsers clamp timer resolution. The lesson - that
/// preallocating collapses many allocations and copies into one - is identical on both, but
/// the exact figures are not, and a tool whose whole claim is "these are real measurements"
/// has to say which runtime measured them and which of them to trust.
/// </summary>
public sealed record ListBenchmarkResult(
    IReadOnlyList<ListBenchmarkRun> Runs,
    /// <summary>The add count actually used, after clamping.</summary>
    int Adds,
    /// <summary>The capacity actually used, after clamping.</summary>
    int Capacity,
    int Rounds,
    string RuntimeNote,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Error = null);
