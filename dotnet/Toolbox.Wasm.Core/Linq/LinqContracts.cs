using System.Text.Json.Serialization;

namespace Toolbox.Wasm.Core.Linq;

/// <summary>
/// Which of the two built-in sequences a pipeline runs over. Kept as a string on the
/// wire rather than an enum: source-generated serialization handles strings without
/// the extra converter registration an enum would need, and the set is closed enough
/// that a typo shows up immediately in the operator-catalog filtering.
/// </summary>
public sealed class LinqSourceSpec
{
    /// <summary><c>numbers</c> or <c>people</c>.</summary>
    public string Kind { get; set; } = "numbers";

    /// <summary>
    /// How many elements the source yields. Only honoured for <c>numbers</c> - the
    /// people list is a fixed cast, because the demos refer to specific names.
    /// </summary>
    public int Count { get; set; } = 8;
}

/// <summary>
/// One step in the chain. <see cref="Number"/> and <see cref="Text"/> are the
/// user-editable parameter; which (if either) applies is declared by the catalog
/// entry this <see cref="Id"/> refers to.
/// </summary>
public sealed class LinqOperatorSpec
{
    public string Id { get; set; } = string.Empty;
    public double? Number { get; set; }
    public string? Text { get; set; }
}

/// <summary>
/// Mirrors the TypeScript <c>LinqPipelineSpec</c>. Everything the browser sends to
/// describe a query - deliberately a *spec* rather than source code, so that a Roslyn
/// front-end could later produce the same shape without the tracing layer changing.
/// </summary>
public sealed class LinqPipelineSpec
{
    public LinqSourceSpec Source { get; set; } = new();
    public List<LinqOperatorSpec> Operators { get; set; } = [];

    /// <summary>
    /// The terminal operator, or <c>none</c> to build the query and never enumerate it -
    /// which is the whole point of the first demo, not an error state.
    /// </summary>
    public string Terminal { get; set; } = "toList";

    /// <summary>Runs the terminal twice over the same query, to expose double enumeration.</summary>
    public bool EnumerateTwice { get; set; }
}

/// <summary>
/// One probe point. Stage 0 is always the source; stage N is the output of the Nth
/// operator. <see cref="Kind"/> is <c>source</c>, <c>streaming</c> or <c>buffering</c> -
/// the distinction the timeline exists to make visible.
/// </summary>
public sealed record LinqStage(int Index, string Label, string Kind);

/// <summary>
/// A single observed enumeration event. <see cref="Kind"/> is <c>pulled</c> (a
/// <c>MoveNext</c> arrived from downstream), <c>yielded</c> (an element left this
/// stage) or <c>exhausted</c> (the stage reported it was done).
/// </summary>
public sealed record LinqTraceEvent(
    int Step,
    int Stage,
    string Kind,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Value,
    int Pass);

/// <summary>
/// Headline numbers, so the lesson survives without reading every event.
/// <see cref="ShortCircuited"/> means the terminal stopped before the source ran out -
/// the thing <c>First</c>/<c>Any</c>/<c>Take</c> are supposed to do.
/// </summary>
public sealed record LinqStats(
    int SourcePulls,
    int SourceYields,
    int TotalEvents,
    bool ShortCircuited);

/// <summary>Mirrors the TypeScript <c>LinqRunResult</c>.</summary>
public sealed record LinqRunResult(
    IReadOnlyList<LinqStage> Stages,
    IReadOnlyList<LinqTraceEvent> Events,
    string MethodSyntax,
    // Null when the chain has no single-expression query-syntax equivalent, which is
    // most of them. Emitting an approximation would defeat the point of the tool.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? QuerySyntax,
    string ResultText,
    LinqStats Stats,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Error = null,
    bool Truncated = false);

/// <summary>
/// A palette entry. The browser builds its operator list from this rather than from a
/// hand-kept TypeScript copy, so the label, the parameter metadata, the generated C#
/// and the lambda that actually runs can never drift apart.
/// </summary>
public sealed record LinqOperatorInfo(
    string Id,
    string Label,
    // "streaming" or "buffering".
    string Kind,
    // "number", "text", or null when the operator takes no parameter.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? ArgKind,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] double? DefaultNumber,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? DefaultText,
    // Which source kinds this operator can be applied to.
    IReadOnlyList<string> Sources,
    // One line on what makes this operator interesting. Shown as help text.
    string Hint,
    // Heading the palette files this under, e.g. "Filtering". A flat list of a dozen
    // operators is a wall; grouped by what they do to the sequence, it is scannable.
    string Group);

/// <summary>
/// A terminal-operator palette entry. The groups deliberately split on the thing this
/// tool teaches - whether the operator can stop early or has to see every element -
/// rather than on return type.
/// </summary>
public sealed record LinqTerminalInfo(
    string Id,
    string Label,
    IReadOnlyList<string> Sources,
    string Hint,
    string Group);

/// <summary>A source palette entry.</summary>
public sealed record LinqSourceInfo(string Kind, string Label, string ElementType);

/// <summary>Everything the browser needs to render the palette.</summary>
public sealed record LinqCatalog(
    IReadOnlyList<LinqSourceInfo> Sources,
    IReadOnlyList<LinqOperatorInfo> Operators,
    IReadOnlyList<LinqTerminalInfo> Terminals);
