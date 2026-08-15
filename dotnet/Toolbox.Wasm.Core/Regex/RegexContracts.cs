using System.Text.Json.Serialization;

namespace Toolbox.Wasm.Core.Regex;

/// <summary>
/// Mirrors the <c>RegexOptionsModel</c> interface in
/// <c>src/app/services/regex-tester.service.ts</c>. Every member is optional on the
/// wire so the TypeScript side can add a toggle without breaking older payloads.
/// </summary>
public sealed class RegexOptionsModel
{
    public bool IgnoreCase { get; set; }
    public bool Multiline { get; set; }
    public bool Singleline { get; set; }
    public bool IgnorePatternWhitespace { get; set; }
    public bool ExplicitCapture { get; set; }
    public bool CultureInvariant { get; set; }
    public bool RightToLeft { get; set; }

    /// <summary>
    /// No JavaScript equivalent at all - the linear-time engine. Off by default
    /// because it rejects several constructs (lookaround, backreferences) that the
    /// backtracking engine accepts.
    /// </summary>
    public bool NonBacktracking { get; set; }

    /// <summary>
    /// Guards against catastrophic backtracking. A pattern that exceeds this is
    /// reported as an error rather than being allowed to hang the browser tab.
    /// </summary>
    public int MatchTimeoutMs { get; set; } = 1000;
}

/// <summary>Mirrors <c>RegexGroupResult</c>.</summary>
public sealed record RegexGroupResult(string Name, string Value, int Index);

/// <summary>Mirrors <c>RegexMatchResult</c>.</summary>
public sealed record RegexMatchResult(
    string Value,
    int Index,
    int Length,
    IReadOnlyList<RegexGroupResult> Groups);

/// <summary>
/// Mirrors <c>RegexEvaluation</c>. <c>EngineWarning</c> exists only so the shape
/// matches the TypeScript interface - the .NET engine never populates it, because
/// there is nothing left to warn about.
/// </summary>
public sealed record RegexEvaluation(
    IReadOnlyList<RegexMatchResult> Matches,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Error = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? EngineWarning = null,
    bool Truncated = false);

/// <summary>Mirrors <c>RegexReplaceResult</c>.</summary>
public sealed record RegexReplaceResult(
    string Result,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Error = null);
