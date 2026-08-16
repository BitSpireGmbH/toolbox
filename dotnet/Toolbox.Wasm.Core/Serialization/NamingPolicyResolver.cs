using System.Text.Json;

namespace Toolbox.Wasm.Core.Serialization;

/// <summary>
/// Hands out the real <see cref="JsonNamingPolicy"/> instances rather than
/// reimplementing them.
///
/// This exists because the reimplementation is the thing that goes wrong. The obvious
/// camelCase - lowercase the first character - disagrees with
/// <see cref="JsonNamingPolicy.CamelCase"/> on every name that starts with a run of
/// capitals: <c>IPAddress</c> is <c>ipAddress</c> and not <c>iPAddress</c>, <c>ID</c> is
/// <c>id</c> and not <c>iD</c>. A generator that guesses wrong emits a
/// <c>[JsonPropertyName]</c> that was not needed, or omits one that was, and the bug only
/// shows up at runtime in the consuming app.
/// </summary>
public static class NamingPolicyResolver
{
    /// <summary>The wire value meaning "use the property name verbatim".</summary>
    public const string None = "None";

    /// <summary>
    /// The catalogue the TypeScript dropdown is built from. Each example is deliberately
    /// a name the naive implementation gets wrong, so the list doubles as the evidence
    /// that the real policy is running.
    /// </summary>
    public static IReadOnlyList<NamingPolicyInfo> Catalog { get; } =
    [
        new(None, "None (verbatim)", "IPAddress"),
        new("CamelCase", "camelCase", Describe(JsonNamingPolicy.CamelCase)),
        new("SnakeCaseLower", "snake_case", Describe(JsonNamingPolicy.SnakeCaseLower)),
        new("SnakeCaseUpper", "SNAKE_CASE", Describe(JsonNamingPolicy.SnakeCaseUpper)),
        new("KebabCaseLower", "kebab-case", Describe(JsonNamingPolicy.KebabCaseLower)),
        new("KebabCaseUpper", "KEBAB-CASE", Describe(JsonNamingPolicy.KebabCaseUpper)),
    ];

    /// <summary>
    /// The policy for <paramref name="id"/>, or <c>null</c> for
    /// <see cref="None"/> and for anything unrecognised.
    ///
    /// An unknown id degrades to no policy rather than throwing: the ids come from a
    /// TypeScript dropdown, and a stale deployment sending one this runtime does not know
    /// should leave the names alone, not break the tool.
    /// </summary>
    public static JsonNamingPolicy? Resolve(string? id) => id switch
    {
        "CamelCase" => JsonNamingPolicy.CamelCase,
        "SnakeCaseLower" => JsonNamingPolicy.SnakeCaseLower,
        "SnakeCaseUpper" => JsonNamingPolicy.SnakeCaseUpper,
        "KebabCaseLower" => JsonNamingPolicy.KebabCaseLower,
        "KebabCaseUpper" => JsonNamingPolicy.KebabCaseUpper,
        _ => null,
    };

    /// <summary>
    /// Normalises <paramref name="id"/> to the value that will be echoed back, so the
    /// caller can tell an honoured policy from one this runtime did not recognise.
    /// </summary>
    public static string Normalize(string? id) => Resolve(id) is null ? None : id!;

    /// <summary>
    /// Applies the policy to every name. Duplicates in <paramref name="names"/> collapse
    /// rather than throw - the caller is describing a set of properties, and asking for
    /// the same one twice is not an error.
    /// </summary>
    public static Dictionary<string, string> Apply(string? id, IEnumerable<string> names)
    {
        var policy = Resolve(id);
        var result = new Dictionary<string, string>(StringComparer.Ordinal);

        foreach (var name in names)
        {
            if (name is null)
            {
                continue;
            }

            result[name] = policy is null ? name : policy.ConvertName(name);
        }

        return result;
    }

    private static string Describe(JsonNamingPolicy policy) => policy.ConvertName("IPAddress");
}
