using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Versioning;
using Toolbox.Wasm.Core.Regex;

namespace Toolbox.Wasm;

/// <summary>
/// The JavaScript-facing surface, reached from TypeScript as
/// <c>exports.Toolbox.Wasm.RegexInterop.Evaluate(...)</c>.
///
/// Intentionally nothing but marshalling. JSImport/JSExport cannot pass complex
/// objects, so options arrive as a JSON string and results leave as one; the real
/// work (and its tests) lives in Toolbox.Wasm.Core, which has no browser dependency.
///
/// The class must be partial - the interop source generator adds to it.
/// </summary>
[SupportedOSPlatform("browser")]
public static partial class RegexInterop
{
    /// <returns>JSON matching the TypeScript <c>RegexEvaluation</c> interface.</returns>
    [JSExport]
    internal static string Evaluate(string pattern, string testInput, string optionsJson) =>
        RegexJsonFacade.Evaluate(pattern, testInput, optionsJson);

    /// <returns>JSON matching the TypeScript <c>RegexReplaceResult</c> interface.</returns>
    [JSExport]
    internal static string Replace(
        string pattern,
        string testInput,
        string replacement,
        string optionsJson) =>
        RegexJsonFacade.Replace(pattern, testInput, replacement, optionsJson);
}
