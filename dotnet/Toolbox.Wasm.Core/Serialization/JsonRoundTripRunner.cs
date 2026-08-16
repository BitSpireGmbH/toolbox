using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;

namespace Toolbox.Wasm.Core.Serialization;

/// <summary>
/// Reads a payload with <see cref="JsonDocument"/> and writes it back out with
/// <see cref="Utf8JsonWriter"/>, under whichever <see cref="JsonSerializerOptions"/> the
/// user picked.
///
/// This is the reader/writer layer on purpose, not <c>JsonSerializer.Deserialize&lt;T&gt;</c>.
/// Binding into the model the tool just generated would need a C# compiler in the browser,
/// and the toolbox deliberately does not ship one. What is left is still the half people
/// actually get caught by - which characters get escaped, where a parse error really is,
/// and what happens to a number too big for a double - and it is genuinely .NET's answer
/// rather than JavaScript's.
/// </summary>
public static class JsonRoundTripRunner
{
    /// <summary>
    /// Values larger than this lose precision when JavaScript parses them, so the numbers
    /// in the result travel as strings. 2^53 - 1.
    /// </summary>
    private const long JavaScriptSafeInteger = 9007199254740991;

    public static RoundTripResult Run(string payload, RoundTripOptions options)
    {
        var documentOptions = new JsonDocumentOptions
        {
            AllowTrailingCommas = options.AllowTrailingCommas,
            CommentHandling = options.SkipComments ? JsonCommentHandling.Skip : JsonCommentHandling.Disallow,
            MaxDepth = options.MaxDepth,
        };

        JsonDocument document;
        try
        {
            document = JsonDocument.Parse(payload ?? string.Empty, documentOptions);
        }
        catch (JsonException ex)
        {
            // The position is the whole reason to run the real reader: .NET reports the
            // line and the byte offset within it, which is more than "Unexpected token"
            // and is what the user needs to find the character that broke it.
            return new RoundTripResult(
                null,
                new RoundTripError(ex.Message, ex.LineNumber, ex.BytePositionInLine),
                []);
        }

        using (document)
        {
            var output = Write(document.RootElement, options);
            var notes = Inspect(document.RootElement);
            return new RoundTripResult(output, null, notes);
        }
    }

    private static string Write(JsonElement root, RoundTripOptions options)
    {
        var writerOptions = new JsonWriterOptions
        {
            Indented = options.WriteIndented,
            // The escaping question people actually hit: the default encoder escapes '+',
            // '<', '&' and every non-ASCII character, which is why a perfectly valid
            // payload comes back full of & and looks corrupted.
            Encoder = options.RelaxedEscaping ? JavaScriptEncoder.UnsafeRelaxedJsonEscaping : null,
        };

        if (options.WriteIndented)
        {
            writerOptions.IndentCharacter = options.IndentWithTabs ? '\t' : ' ';
            writerOptions.IndentSize = options.IndentWithTabs ? 1 : Math.Clamp(options.IndentSize, 1, 8);
        }

        using var buffer = new MemoryStream();
        using (var writer = new Utf8JsonWriter(buffer, writerOptions))
        {
            root.WriteTo(writer);
        }

        return Encoding.UTF8.GetString(buffer.ToArray());
    }

    /// <summary>
    /// Points out the values where .NET and JavaScript genuinely disagree, rather than
    /// listing everything in the payload. Each note is something the user would otherwise
    /// only discover in production.
    /// </summary>
    private static IReadOnlyList<RoundTripNote> Inspect(JsonElement root)
    {
        var notes = new List<RoundTripNote>();
        Walk(root, "$", notes);
        return notes;
    }

    private static void Walk(JsonElement element, string path, List<RoundTripNote> notes)
    {
        // A deliberate ceiling: past this the panel stops being a hint and starts being a
        // second document to read.
        if (notes.Count >= 20)
        {
            return;
        }

        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                foreach (var property in element.EnumerateObject())
                {
                    Walk(property.Value, $"{path}.{property.Name}", notes);
                }
                break;

            case JsonValueKind.Array:
                var index = 0;
                foreach (var item in element.EnumerateArray())
                {
                    Walk(item, $"{path}[{index++}]", notes);
                }
                break;

            case JsonValueKind.Number:
                InspectNumber(element, path, notes);
                break;
        }
    }

    private static void InspectNumber(JsonElement element, string path, List<RoundTripNote> notes)
    {
        var raw = element.GetRawText();

        // An integer beyond 2^53 survives .NET's long intact but is already damaged by the
        // time JavaScript has finished parsing it - which is exactly why this check cannot
        // live on the TypeScript side of the boundary.
        if (element.TryGetInt64(out var asLong))
        {
            if (Math.Abs(asLong) > JavaScriptSafeInteger)
            {
                notes.Add(new RoundTripNote(
                    path,
                    "precision",
                    $"Exact as a C# long. JavaScript reads it as {Invariant((double)asLong)}.",
                    raw));
            }

            return;
        }

        // Out of range for one of the two types - nothing useful to compare.
        if (!element.TryGetDouble(out var asDouble) || !element.TryGetDecimal(out var exact))
        {
            return;
        }

        // Compared as decimals rather than as text so that 1.50 and 1.5 count as equal:
        // trailing zeros are a scale difference, not a loss of precision.
        if (!decimal.TryParse(
                Invariant(asDouble),
                System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture,
                out var viaDouble) || viaDouble == exact)
        {
            return;
        }

        notes.Add(new RoundTripNote(
            path,
            "precision",
            $"Bound as double this becomes {Invariant(asDouble)}; decimal keeps {raw}.",
            raw));
    }

    /// <summary>The shortest text that round-trips back to the same double.</summary>
    private static string Invariant(double value) =>
        value.ToString("R", System.Globalization.CultureInfo.InvariantCulture);
}
