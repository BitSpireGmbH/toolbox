namespace Toolbox.Wasm.Core.Layout;

using System.Text.RegularExpressions;

// `Toolbox.Wasm.Core.Regex` is a namespace in this assembly, so inside `Toolbox.Wasm.Core`
// the bare name resolves to it rather than to the type. The alias has to live *inside* the
// namespace declaration to win, because enclosing-namespace members are searched before a
// compilation-unit alias.
using Regex = System.Text.RegularExpressions.Regex;

/// <summary>A field the layout engine has to place, as written in the source.</summary>
public sealed record ParsedField(string Name, string Type, int? ExplicitOffset);

/// <summary>One struct declaration, reduced to what affects layout.</summary>
public sealed record ParsedStruct(
    string Name,
    string Kind,
    int Pack,
    IReadOnlyList<ParsedField> Fields);

/// <summary>
/// Reads C# struct declarations far enough to lay them out, and no further.
///
/// Hand-rolled rather than Roslyn-backed: a real parser would be the right tool, but it
/// costs several megabytes of lazily-loaded compiler for a job that is regular in
/// practice. The trade is stated rather than hidden - anything this cannot read becomes a
/// diagnostic, so the calculator never quietly lays out a struct it misread.
/// </summary>
public static partial class StructParser
{
    public static IReadOnlyList<ParsedStruct> Parse(string source, List<string> diagnostics)
    {
        var cleaned = StripComments(source ?? string.Empty);
        var structs = new List<ParsedStruct>();

        foreach (var declaration in FindDeclarations(cleaned, diagnostics))
        {
            structs.Add(declaration);
        }

        if (structs.Count == 0 && !string.IsNullOrWhiteSpace(cleaned))
        {
            diagnostics.Add("No struct declaration found. Paste a `struct` - classes are laid out by the runtime and have no fixed offsets.");
        }

        return structs;
    }

    private static IEnumerable<ParsedStruct> FindDeclarations(string source, List<string> diagnostics)
    {
        foreach (Match header in StructHeader().Matches(source))
        {
            var name = header.Groups["name"].Value;

            // Reported before anything else, and the whole declaration is then skipped: a
            // primary constructor's captured parameters become compiler-named fields whose
            // order is not part of any contract, so laying out only the explicit members
            // would be a confident answer to a different struct.
            if (header.Groups["primary"].Success)
            {
                diagnostics.Add(
                    $"`{name}` has a primary constructor. Its parameters become compiler-generated fields whose order is not guaranteed, so it is not laid out. Rewrite them as ordinary fields to see the offsets.");
                continue;
            }

            var after = header.Index + header.Length;
            var bodyStart = source.IndexOf('{', after);
            var terminator = source.IndexOf(';', after);

            if (bodyStart < 0 || (terminator >= 0 && terminator < bodyStart))
            {
                // `struct S;` - legal since C# 12, and simply has no fields.
                yield return new ParsedStruct(name, ReadStructLayoutAttribute(source[..header.Index]).Kind, 0, []);
                continue;
            }

            var bodyEnd = FindMatchingBrace(source, bodyStart);
            if (bodyEnd < 0)
            {
                diagnostics.Add($"`{name}` has an unbalanced `{{`.");
                continue;
            }

            var fields = ParseFields(source[(bodyStart + 1)..bodyEnd], name, diagnostics);
            var (kind, pack) = ReadStructLayoutAttribute(source[..header.Index]);

            yield return new ParsedStruct(name, kind, pack, fields);
        }
    }

    private static List<ParsedField> ParseFields(string body, string structName, List<string> diagnostics)
    {
        var fields = new List<ParsedField>();

        foreach (var member in SplitMembers(body))
        {
            var text = member.Trim();
            if (text.Length == 0)
            {
                continue;
            }

            // Nothing here occupies instance space: statics live off the instance,
            // consts are baked into call sites, and a computed property has no field.
            if (StaticOrConst().IsMatch(text) || text.Contains("=>", StringComparison.Ordinal))
            {
                continue;
            }

            var explicitOffset = FieldOffset().Match(text) is { Success: true } offset
                ? int.Parse(offset.Groups["value"].Value)
                : (int?)null;

            var declaration = StripAttributes(text);

            if (FixedBuffer().Match(declaration) is { Success: true } buffer)
            {
                var length = int.Parse(buffer.Groups["length"].Value);
                fields.Add(new ParsedField(
                    buffer.Groups["name"].Value,
                    $"{buffer.Groups["type"].Value}[{length}]",
                    explicitOffset));
                continue;
            }

            if (AutoProperty().Match(declaration) is { Success: true } property)
            {
                fields.Add(new ParsedField(
                    property.Groups["name"].Value,
                    property.Groups["type"].Value,
                    explicitOffset));
                continue;
            }

            if (Field().Match(declaration) is { Success: true } field)
            {
                // `int a, b;` declares two fields, and both take space.
                foreach (var name in field.Groups["names"].Value.Split(','))
                {
                    var bare = name.Split('=')[0].Trim();
                    if (bare.Length > 0)
                    {
                        fields.Add(new ParsedField(bare, field.Groups["type"].Value, explicitOffset));
                    }
                }

                continue;
            }

            if (LooksLikeAMember().IsMatch(declaration))
            {
                diagnostics.Add($"`{structName}`: could not read `{Summarize(declaration)}`, so it is not included.");
            }
        }

        return fields;
    }

    /// <summary>
    /// Splits a struct body on the semicolons and braces that end a member, so that a
    /// property's <c>{ get; set; }</c> stays with its declaration.
    /// </summary>
    private static IEnumerable<string> SplitMembers(string body)
    {
        var depth = 0;
        var start = 0;

        for (var i = 0; i < body.Length; i++)
        {
            switch (body[i])
            {
                case '{':
                    depth++;
                    break;

                case '}':
                    depth--;
                    if (depth == 0)
                    {
                        yield return body[start..(i + 1)];
                        start = i + 1;
                    }
                    break;

                case ';' when depth == 0:
                    yield return body[start..i];
                    start = i + 1;
                    break;
            }
        }

        if (start < body.Length)
        {
            yield return body[start..];
        }
    }

    /// <summary>
    /// Reads <c>[StructLayout(...)]</c> from the text preceding the declaration. Only the
    /// attribute nearest the declaration counts, which is why this searches backwards.
    /// </summary>
    private static (string Kind, int Pack) ReadStructLayoutAttribute(string preceding)
    {
        // Sequential is the default the C# compiler applies to every struct that does not
        // say otherwise - not Auto, which is the default for classes.
        var kind = "Sequential";
        var pack = 0;

        var matches = StructLayoutAttribute().Matches(preceding);
        if (matches.Count > 0)
        {
            var attribute = matches[^1];

            // Only honour it if nothing but attributes and whitespace separate it from the
            // declaration; otherwise it belongs to an earlier type in the same paste.
            var between = preceding[(attribute.Index + attribute.Length)..];
            if (IsOnlyAttributesOrWhitespace(between))
            {
                kind = attribute.Groups["kind"].Value;

                if (attribute.Groups["pack"].Success)
                {
                    pack = int.Parse(attribute.Groups["pack"].Value);
                }
            }
        }

        return (kind, pack);
    }

    private static bool IsOnlyAttributesOrWhitespace(string text)
    {
        var depth = 0;

        foreach (var character in text)
        {
            if (character == '[')
            {
                depth++;
            }
            else if (character == ']')
            {
                depth--;
            }
            else if (depth == 0 && !char.IsWhiteSpace(character))
            {
                return false;
            }
        }

        return true;
    }

    private static int FindMatchingBrace(string source, int openIndex)
    {
        var depth = 0;

        for (var i = openIndex; i < source.Length; i++)
        {
            if (source[i] == '{')
            {
                depth++;
            }
            else if (source[i] == '}' && --depth == 0)
            {
                return i;
            }
        }

        return -1;
    }

    private static string StripComments(string source) =>
        BlockComment().Replace(LineComment().Replace(source, string.Empty), string.Empty);

    private static string StripAttributes(string member) =>
        Attribute().Replace(member, string.Empty).Trim();

    private static string Summarize(string declaration)
    {
        var collapsed = Whitespace().Replace(declaration, " ").Trim();
        return collapsed.Length <= 60 ? collapsed : collapsed[..57] + "...";
    }

    [GeneratedRegex(@"//[^\r\n]*")]
    private static partial Regex LineComment();

    [GeneratedRegex(@"/\*.*?\*/", RegexOptions.Singleline)]
    private static partial Regex BlockComment();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();

    [GeneratedRegex(@"^\s*\[[^\]]*\]\s*", RegexOptions.Multiline)]
    private static partial Regex Attribute();

    [GeneratedRegex(
        @"(?<modifiers>(?:\b(?:public|internal|private|protected|readonly|ref|partial|unsafe|record)\b\s+)*)" +
        @"struct\s+(?<name>\w+)\s*(?<primary>\([^)]*\))?")]
    private static partial Regex StructHeader();

    [GeneratedRegex(
        @"\[\s*StructLayout\s*\(\s*LayoutKind\.(?<kind>Sequential|Explicit|Auto)" +
        @"(?:[^)]*?\bPack\s*=\s*(?<pack>\d+))?[^)]*\)\s*\]")]
    private static partial Regex StructLayoutAttribute();

    [GeneratedRegex(@"\[\s*FieldOffset\s*\(\s*(?<value>\d+)\s*\)\s*\]")]
    private static partial Regex FieldOffset();

    [GeneratedRegex(@"\b(?:static|const)\b")]
    private static partial Regex StaticOrConst();

    [GeneratedRegex(
        @"^(?:\b(?:public|internal|private|protected|readonly|required|volatile|unsafe)\b\s+)*" +
        @"fixed\s+(?<type>\w+)\s+(?<name>\w+)\s*\[\s*(?<length>\d+)\s*\]")]
    private static partial Regex FixedBuffer();

    [GeneratedRegex(
        @"^(?:\b(?:public|internal|private|protected|readonly|required|unsafe)\b\s+)*" +
        @"(?<type>[\w.]+(?:\s*<[^>]*>)?(?:\s*\[\s*\])?\s*\??)\s+(?<name>\w+)\s*\{\s*get\s*;")]
    private static partial Regex AutoProperty();

    [GeneratedRegex(
        @"^(?:\b(?:public|internal|private|protected|readonly|required|volatile|unsafe)\b\s+)*" +
        @"(?<type>[\w.]+(?:\s*<[^>]*>)?(?:\s*\[\s*\])?\s*\??)\s+(?<names>\w+(?:\s*=[^,;]+)?(?:\s*,\s*\w+(?:\s*=[^,;]+)?)*)\s*$")]
    private static partial Regex Field();

    [GeneratedRegex(@"^\s*(?:public|internal|private|protected|readonly|required|volatile|unsafe|\w+\s+\w+)")]
    private static partial Regex LooksLikeAMember();
}
