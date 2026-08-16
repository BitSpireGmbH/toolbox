using Toolbox.Wasm.Core.Layout;
using Xunit;

namespace Toolbox.Wasm.Tests;

/// <summary>
/// The parser is hand-rolled rather than Roslyn-backed, so what it can and cannot read is
/// a design decision rather than an accident. These pin both halves - especially the
/// refusals, because a member read wrongly would shift every offset after it without
/// saying anything.
/// </summary>
public class StructParserTests
{
    private static IReadOnlyList<ParsedStruct> Parse(string source, out List<string> diagnostics)
    {
        diagnostics = [];
        return StructParser.Parse(source, diagnostics);
    }

    [Fact]
    public void ReadsFieldsInDeclarationOrder()
    {
        var parsed = Parse("struct S { public int Id; public long Ticks; }", out var diagnostics);

        Assert.Empty(diagnostics);
        var fields = Assert.Single(parsed).Fields;
        Assert.Equal(["Id", "Ticks"], fields.Select(field => field.Name));
        Assert.Equal(["int", "long"], fields.Select(field => field.Type));
    }

    [Fact]
    public void ReadsAutoPropertiesBecauseTheirBackingFieldsTakeSpace()
    {
        var parsed = Parse(
            "struct S { public int Id { get; set; } public string Name { get; init; } public byte Flag { get; } }",
            out var diagnostics);

        Assert.Empty(diagnostics);
        Assert.Equal(["Id", "Name", "Flag"], Assert.Single(parsed).Fields.Select(field => field.Name));
    }

    [Fact]
    public void SkipsMembersThatOccupyNoInstanceSpace()
    {
        var parsed = Parse(
            """
            struct S
            {
                public const int Limit = 10;
                public static int Shared;
                public int Doubled => Id * 2;
                public int Id;
            }
            """,
            out var diagnostics);

        Assert.Empty(diagnostics);
        Assert.Equal(["Id"], Assert.Single(parsed).Fields.Select(field => field.Name));
    }

    [Fact]
    public void ReadsSeveralFieldsFromOneDeclaration()
    {
        var parsed = Parse("struct S { public int A, B, C; }", out _);

        Assert.Equal(["A", "B", "C"], Assert.Single(parsed).Fields.Select(field => field.Name));
    }

    [Fact]
    public void IgnoresComments()
    {
        var parsed = Parse(
            """
            struct S
            {
                // public int Commented;
                /* public int AlsoCommented; */
                public int Real;
            }
            """,
            out var diagnostics);

        Assert.Empty(diagnostics);
        Assert.Equal(["Real"], Assert.Single(parsed).Fields.Select(field => field.Name));
    }

    [Fact]
    public void ReadsStructLayoutAndPack()
    {
        var parsed = Parse(
            "[StructLayout(LayoutKind.Explicit, Pack = 2)] struct S { public int A; }",
            out _);

        var declaration = Assert.Single(parsed);
        Assert.Equal("Explicit", declaration.Kind);
        Assert.Equal(2, declaration.Pack);
    }

    [Fact]
    public void DefaultsToSequentialWhichIsWhatCSharpApplies()
    {
        var declaration = Assert.Single(Parse("struct S { public int A; }", out _));

        Assert.Equal("Sequential", declaration.Kind);
        Assert.Equal(0, declaration.Pack);
    }

    [Fact]
    public void DoesNotLetOneStructsAttributeLeakOntoTheNext()
    {
        var parsed = Parse(
            """
            [StructLayout(LayoutKind.Explicit)]
            struct First { [FieldOffset(0)] public int A; }

            struct Second { public int B; }
            """,
            out _);

        Assert.Equal("Explicit", parsed[0].Kind);
        Assert.Equal("Sequential", parsed[1].Kind);
    }

    [Fact]
    public void ReadsFieldOffset()
    {
        var parsed = Parse(
            "[StructLayout(LayoutKind.Explicit)] struct S { [FieldOffset(4)] public int A; }",
            out _);

        Assert.Equal(4, Assert.Single(Assert.Single(parsed).Fields).ExplicitOffset);
    }

    [Fact]
    public void ReadsFixedSizeBuffers()
    {
        var parsed = Parse("struct S { public fixed byte Buffer[16]; }", out var diagnostics);

        Assert.Empty(diagnostics);
        Assert.Equal("byte[16]", Assert.Single(Assert.Single(parsed).Fields).Type);
    }

    [Fact]
    public void ReadsSeveralStructsFromOnePaste()
    {
        var parsed = Parse(
            "public readonly struct A { public int X; } internal struct B { public long Y; }",
            out _);

        Assert.Equal(["A", "B"], parsed.Select(declaration => declaration.Name));
    }

    [Fact]
    public void ReportsAPrimaryConstructorRatherThanGuessingAtItsFields()
    {
        // The captured parameters become compiler-named fields whose order is not part of
        // any contract, so inventing offsets for them would be fiction.
        Parse("readonly record struct S(int Id, string Name);", out var diagnostics);

        Assert.Contains(diagnostics, message => message.Contains("primary constructor"));
    }

    [Fact]
    public void ReportsWhenThereIsNoStructAtAll()
    {
        Parse("public class NotAStruct { public int Id; }", out var diagnostics);

        Assert.Contains(diagnostics, message => message.Contains("No struct declaration"));
    }

    [Fact]
    public void ReportsAMemberItCannotRead()
    {
        // Silently dropping this would shift every offset after it.
        Parse("struct S { public int Id; public int Method(int a) { return a; } }", out var diagnostics);

        Assert.NotEmpty(diagnostics);
    }

    [Fact]
    public void EmptySourceProducesNothingAndSaysNothing()
    {
        Assert.Empty(Parse("   ", out var diagnostics));
        Assert.Empty(diagnostics);
    }
}
