using System.Text.Json;
using Toolbox.Wasm.Core.Interop;

namespace Toolbox.Wasm.Core.Regex;

/// <summary>
/// String-in / string-out wrapper around <see cref="RegexEvaluator"/>.
///
/// JSImport/JSExport cannot marshal complex objects, so everything crossing into
/// JavaScript does so as JSON. Keeping that translation here rather than in the
/// interop assembly means the serialization contract the browser actually depends
/// on is covered by plain unit tests.
/// </summary>
public static class RegexJsonFacade
{
    public static string Evaluate(string pattern, string testInput, string optionsJson)
    {
        var options = ParseOptions(optionsJson);
        var result = RegexEvaluator.Evaluate(pattern ?? string.Empty, testInput ?? string.Empty, options);
        return JsonSerializer.Serialize(result, RegexJsonContext.Default.RegexEvaluation);
    }

    public static string Replace(string pattern, string testInput, string replacement, string optionsJson)
    {
        var options = ParseOptions(optionsJson);
        var result = RegexEvaluator.Replace(
            pattern ?? string.Empty,
            testInput ?? string.Empty,
            replacement ?? string.Empty,
            options);
        return JsonSerializer.Serialize(result, RegexJsonContext.Default.RegexReplaceResult);
    }

    /// <summary>
    /// A malformed options payload is a programming error on the TypeScript side, not
    /// something the user can trigger. Falling back to defaults keeps the tool usable
    /// instead of turning it into an opaque failure.
    /// </summary>
    private static RegexOptionsModel ParseOptions(string optionsJson) =>
        JsonBridge.ReadOrDefault(
            optionsJson,
            RegexJsonContext.Default.RegexOptionsModel,
            new RegexOptionsModel());
}
