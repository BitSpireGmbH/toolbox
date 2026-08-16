using System.Text.Json.Serialization;

namespace Toolbox.Wasm.Core.Layout;

/// <summary>
/// Which machine the reported layout describes.
///
/// This has to be a choice rather than a measurement. The runtime doing the calculating is
/// <c>browser-wasm</c>, where <c>IntPtr.Size</c> is 4, so a struct holding a <c>string</c>
/// lays out differently in the tab than it does on the x64 or ARM64 machine the user
/// actually ships to. Measuring would give a real answer to the wrong question.
/// </summary>
public enum LayoutTarget
{
    /// <summary>64-bit. The default, and the one the parity tests run against.</summary>
    X64,

    /// <summary>64-bit; identical to <see cref="X64"/> under these rules.</summary>
    Arm64,

    /// <summary>32-bit. Best effort - see <see cref="LayoutResult.Caveats"/>.</summary>
    X86,

    /// <summary>32-bit, and what this very calculation is running on.</summary>
    Wasm32,
}

/// <summary>
/// Mirrors the <c>LayoutRequest</c> interface in
/// <c>src/app/services/struct-layout.service.ts</c>.
/// </summary>
public sealed class LayoutRequest
{
    /// <summary>One or more C# struct declarations, as pasted.</summary>
    public string Source { get; set; } = string.Empty;

    /// <summary>A <see cref="LayoutTarget"/> name; unknown values fall back to x64.</summary>
    public string Target { get; set; } = nameof(LayoutTarget.X64);
}

/// <summary>Mirrors <c>LayoutField</c>. A real field, or the padding before one.</summary>
public sealed record LayoutField(
    string Name,
    string Type,
    int Offset,
    int Size,
    int Alignment,
    // Padding inserted *before* this field to satisfy its alignment.
    int PaddingBefore,
    // True when the offset came from [FieldOffset] rather than from packing.
    bool IsExplicit,
    // True when this field's bytes overlap another's - legal, but rarely intended.
    bool Overlaps);

/// <summary>Mirrors <c>StructLayout</c>.</summary>
public sealed record StructLayout(
    string Name,
    string Kind,
    int Size,
    int Alignment,
    int PaddingBytes,
    int Pack,
    IReadOnlyList<LayoutField> Fields,
    // Trailing padding added to round the struct up to its alignment.
    int TrailingPadding,
    // Field order that minimises padding, and what it saves. Absent when the layout is
    // already optimal, or when reordering would not be honoured.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] LayoutSuggestion? Suggestion,
    IReadOnlyList<string> Notes);

/// <summary>Mirrors <c>LayoutSuggestion</c>.</summary>
public sealed record LayoutSuggestion(
    IReadOnlyList<string> FieldOrder,
    int Size,
    int PaddingBytes);

/// <summary>Mirrors <c>LayoutResult</c>.</summary>
public sealed record LayoutResult(
    string Target,
    IReadOnlyList<StructLayout> Structs,
    // Parse problems. Not keyed to a position: the input is short enough to re-read.
    IReadOnlyList<string> Diagnostics,
    // What this answer does not guarantee on the chosen target. Always populated for the
    // 32-bit targets, whose long/double alignment is a CoreCLR implementation detail the
    // parity suite cannot pin.
    IReadOnlyList<string> Caveats);
