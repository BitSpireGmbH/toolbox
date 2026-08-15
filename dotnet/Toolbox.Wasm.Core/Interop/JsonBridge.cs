using System.Text.Json;
using System.Text.Json.Serialization.Metadata;

namespace Toolbox.Wasm.Core.Interop;

/// <summary>
/// The one thing every JSON facade needs and none of them should hand-roll: reading a
/// payload that arrived across the JavaScript boundary without letting a
/// <see cref="JsonException"/> escape.
///
/// A throw here would surface in the browser as an opaque interop failure rather than as
/// something the tool can render, so every facade has to catch it. They differ in what
/// they do next - the LINQ runner reports the parse error, the Regex evaluator degrades
/// to defaults - which is why this deliberately stops at "read it safely" and does not
/// try to unify the recovery too.
///
/// Takes <see cref="JsonTypeInfo{T}"/> rather than being generic over the context, so it
/// stays reflection-free and survives trimming.
/// </summary>
public static class JsonBridge
{
    /// <summary>
    /// Reads <paramref name="json"/>, or returns <paramref name="fallback"/> if it is
    /// absent or malformed. For facades whose sensible response to a bad payload is to
    /// carry on with defaults.
    /// </summary>
    public static T ReadOrDefault<T>(string? json, JsonTypeInfo<T> typeInfo, T fallback)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return fallback;
        }

        try
        {
            return JsonSerializer.Deserialize(json, typeInfo) ?? fallback;
        }
        catch (JsonException)
        {
            return fallback;
        }
    }

    /// <summary>
    /// Reads <paramref name="json"/>, reporting why it failed instead of swallowing it.
    /// For facades that would rather show the user an error than quietly act on a default
    /// - running a default pipeline looks like the UI ignoring its own controls.
    /// </summary>
    public static bool TryRead<T>(
        string? json,
        JsonTypeInfo<T> typeInfo,
        out T value,
        out string? error)
    {
        value = default!;
        error = null;

        try
        {
            var parsed = JsonSerializer.Deserialize(json ?? string.Empty, typeInfo);
            if (parsed is null)
            {
                error = "The payload was empty.";
                return false;
            }

            value = parsed;
            return true;
        }
        catch (JsonException ex)
        {
            error = ex.Message;
            return false;
        }
    }
}
