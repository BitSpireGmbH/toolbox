using System.Text.Json.Serialization;

namespace Toolbox.Wasm.Core.Diagnostics;

/// <summary>
/// What the browser sends to have a slice measured. The input and offsets are the ones
/// the user actually chose in the visualiser, not a canned benchmark - the point is that
/// lengthening the slice makes <c>Substring</c> cost more while the span stays flat, and
/// that only lands if the numbers move with the controls on screen.
/// </summary>
public sealed class SliceAllocationRequest
{
    public string Input { get; set; } = string.Empty;
    public int Start { get; set; }
    public int Length { get; set; }

    /// <summary>
    /// Repetitions per sample. A single call is far too small to read: the measurement
    /// granularity and any one-off setup swamp it. Averaging over many gives a stable
    /// per-operation figure.
    /// </summary>
    public int Iterations { get; set; } = 2000;
}

/// <summary>One measured operation.</summary>
public sealed record AllocationSample(
    string Id,
    string Label,
    /// <summary>Total bytes attributed to the loop, as reported by the GC.</summary>
    long TotalBytes,
    /// <summary>Bytes per single operation - what the UI actually shows.</summary>
    long BytesPerOperation,
    /// <summary>The C# that was measured, so the number is attributable to a line of code.</summary>
    string Code);

/// <summary>
/// Mirrors the TypeScript <c>SliceAllocation</c>.
///
/// <see cref="RuntimeNote"/> exists because these are Mono-on-WebAssembly numbers, not
/// CoreCLR-on-x64 ones. The lesson - that slicing allocates nothing and materialising
/// does - is identical on both, but the exact byte counts are not, and a tool whose whole
/// claim is "these are real measurements" has to say which runtime measured them.
/// </summary>
public sealed record SliceAllocationResult(
    IReadOnlyList<AllocationSample> Samples,
    int Iterations,
    string RuntimeNote,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Error = null);
