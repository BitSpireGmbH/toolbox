using System.Text.Json.Serialization;

namespace Toolbox.Wasm.Core.Serialization;

/// <summary>
/// Mirrors the <c>NamingRequest</c> interface in
/// <c>src/app/services/json-naming.service.ts</c>.
///
/// The browser sends the C# property names it is about to generate and gets back what
/// <see cref="System.Text.Json.JsonSerializerOptions.PropertyNamingPolicy"/> would
/// actually call them on the wire. Batched rather than one call per name, because the
/// generator resolves every property of a payload at once and a per-name interop hop
/// would dominate the cost of the work itself.
/// </summary>
public sealed class NamingRequest
{
    /// <summary>
    /// One of the names in <see cref="NamingPolicyResolver"/>. Anything else - including
    /// the absent case - means "no policy", i.e. the property name is used verbatim,
    /// which is what <c>System.Text.Json</c> itself does with a null policy.
    /// </summary>
    public string? Policy { get; set; }

    public IReadOnlyList<string> Names { get; set; } = [];
}

/// <summary>
/// Mirrors <c>NamingResult</c>. <c>Names</c> maps each requested property name to the
/// JSON name the real policy produces; a name the policy leaves alone still appears, so
/// the caller never has to decide what a missing entry means.
/// </summary>
public sealed record NamingResult(
    string Policy,
    IReadOnlyDictionary<string, string> Names);

/// <summary>
/// Mirrors <c>NamingPolicyInfo</c>. Published so the TypeScript dropdown is built from
/// the policies the runtime actually has rather than a hand-kept list that can drift out
/// of step with the .NET version being shipped.
/// </summary>
public sealed record NamingPolicyInfo(string Id, string Label, string Example);

/// <summary>
/// Mirrors the <c>RoundTripOptions</c> interface in
/// <c>src/app/services/json-round-trip.service.ts</c>. Each member maps onto one real
/// <see cref="System.Text.Json.JsonReaderOptions"/> or
/// <see cref="System.Text.Json.JsonWriterOptions"/> setting; the defaults here are
/// <c>System.Text.Json</c>'s own, so an empty payload behaves like an unconfigured
/// serializer rather than like the tool's preferences.
/// </summary>
public sealed class RoundTripOptions
{
    public bool AllowTrailingCommas { get; set; }

    /// <summary>
    /// Maps to <see cref="System.Text.Json.JsonCommentHandling"/>. Off by default, which
    /// is why a JSON file with a <c>//</c> comment in it fails to load.
    /// </summary>
    public bool SkipComments { get; set; }

    /// <summary>0 means "the default", which is 64 - not "unlimited".</summary>
    public int MaxDepth { get; set; }

    public bool WriteIndented { get; set; } = true;
    public int IndentSize { get; set; } = 2;
    public bool IndentWithTabs { get; set; }

    /// <summary>
    /// Switches to <c>JavaScriptEncoder.UnsafeRelaxedJsonEscaping</c>. The default encoder
    /// escapes <c>+</c>, <c>&lt;</c>, <c>&amp;</c> and everything non-ASCII, which is the
    /// single most common "System.Text.Json corrupted my output" report.
    /// </summary>
    public bool RelaxedEscaping { get; set; }
}

/// <summary>
/// Mirrors <c>RoundTripError</c>. The position is the point of running the real reader:
/// .NET says which line and which byte within it, rather than only that something failed.
/// Both are nullable because <see cref="System.Text.Json.JsonException"/> leaves them
/// unset for failures that are not tied to a position in the payload.
/// </summary>
public sealed record RoundTripError(string Message, long? LineNumber, long? BytePositionInLine);

/// <summary>
/// Mirrors <c>RoundTripNote</c>. A place where .NET and JavaScript genuinely disagree
/// about a value, located by JSON path.
/// </summary>
public sealed record RoundTripNote(string Path, string Kind, string Detail, string Raw);

/// <summary>
/// Mirrors <c>RoundTripResult</c>. Exactly one of <c>Output</c> and <c>Error</c> is set.
/// </summary>
public sealed record RoundTripResult(
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Output,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] RoundTripError? Error,
    IReadOnlyList<RoundTripNote> Notes);
