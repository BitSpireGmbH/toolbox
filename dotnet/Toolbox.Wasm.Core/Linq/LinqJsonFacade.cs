using System.Text.Json;

namespace Toolbox.Wasm.Core.Linq;

/// <summary>
/// String-in / string-out wrapper around <see cref="LinqPipelineRunner"/>.
///
/// JSImport/JSExport cannot marshal complex objects, so everything crossing into
/// JavaScript does so as JSON. Keeping that translation here rather than in the interop
/// assembly means the serialization contract the browser actually depends on is covered
/// by plain unit tests.
/// </summary>
public static class LinqJsonFacade
{
    public static string Run(string specJson)
    {
        LinqPipelineSpec spec;
        try
        {
            spec = JsonSerializer.Deserialize(specJson ?? string.Empty, LinqJsonContext.Default.LinqPipelineSpec)
                ?? new LinqPipelineSpec();
        }
        catch (JsonException ex)
        {
            // A malformed spec is a programming error on the TypeScript side, not
            // something the user can trigger. Report it rather than silently running a
            // default pipeline, which would look like the UI ignoring the controls.
            return Serialize(new LinqRunResult(
                [],
                [],
                MethodSyntax: string.Empty,
                QuerySyntax: null,
                ResultText: string.Empty,
                new LinqStats(0, 0, 0, false),
                Error: $"The pipeline description could not be read: {ex.Message}"));
        }

        return Serialize(LinqPipelineRunner.Run(spec));
    }

    /// <returns>The operator palette, so the browser never keeps its own copy.</returns>
    public static string GetCatalog() =>
        JsonSerializer.Serialize(OperatorCatalog.Describe(), LinqJsonContext.Default.LinqCatalog);

    private static string Serialize(LinqRunResult result) =>
        JsonSerializer.Serialize(result, LinqJsonContext.Default.LinqRunResult);
}
