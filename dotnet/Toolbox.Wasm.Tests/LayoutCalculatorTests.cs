using Toolbox.Wasm.Core.Layout;
using Xunit;

namespace Toolbox.Wasm.Tests;

/// <summary>
/// The behaviour around the numbers: padding accounting, the reorder suggestion, targets,
/// and the cases where the tool has to say it does not know. The numbers themselves are
/// checked against the running runtime in <see cref="LayoutRuntimeParityTests"/>.
/// </summary>
public class LayoutCalculatorTests
{
    private static StructLayout Layout(string source, LayoutTarget target = LayoutTarget.X64) =>
        LayoutCalculator.Calculate(source, target).Structs[^1];

    [Fact]
    public void PaddingIsReportedPerFieldAndInTotal()
    {
        var layout = Layout("struct S { public byte Flag; public long Ticks; }");

        Assert.Equal(0, layout.Fields[0].PaddingBefore);
        Assert.Equal(7, layout.Fields[1].PaddingBefore);
        Assert.Equal(7, layout.PaddingBytes);
        Assert.Equal(16, layout.Size);
    }

    [Fact]
    public void TrailingPaddingCountsTowardsTheTotal()
    {
        // long then byte: nothing between them, but the struct still rounds up to 16.
        var layout = Layout("struct S { public long Ticks; public byte Flag; }");

        Assert.Equal(7, layout.TrailingPadding);
        Assert.Equal(7, layout.PaddingBytes);
        Assert.Equal(16, layout.Size);
    }

    [Fact]
    public void AnEmptyStructStillTakesAByte()
    {
        var layout = Layout("struct S { }");

        Assert.Equal(1, layout.Size);
        Assert.Empty(layout.Fields);
    }

    [Fact]
    public void SuggestsAnOrderThatRemovesPadding()
    {
        var layout = Layout("struct S { public byte A; public long B; public byte C; }");

        Assert.Equal(24, layout.Size);
        Assert.NotNull(layout.Suggestion);
        Assert.Equal(["B", "A", "C"], layout.Suggestion.FieldOrder);
        Assert.Equal(16, layout.Suggestion.Size);
    }

    [Fact]
    public void SuggestsNothingWhenTheLayoutIsAlreadyTight()
    {
        Assert.Null(Layout("struct S { public int A; public int B; }").Suggestion);
    }

    [Fact]
    public void SuggestsNothingWhenTheRuntimeIsChoosingTheOrderAnyway()
    {
        // Reordering the source would change nothing, so offering it would be a lie about
        // what the user controls.
        Assert.Null(Layout("struct S { public byte A; public string R; public long B; }").Suggestion);
    }

    [Fact]
    public void PackTightensAlignmentAndIsReported()
    {
        var layout = Layout("[StructLayout(LayoutKind.Sequential, Pack = 1)] struct S { public byte Flag; public long Ticks; }");

        Assert.Equal(1, layout.Pack);
        Assert.Equal(1, layout.Fields[1].Offset);
        Assert.Equal(9, layout.Size);
        Assert.Equal(0, layout.PaddingBytes);
    }

    [Fact]
    public void PackIsCalledOutAsIgnoredWhenTheRuntimeReorders()
    {
        var layout = Layout("[StructLayout(LayoutKind.Sequential, Pack = 1)] struct S { public byte A; public string R; }");

        Assert.Contains(layout.Notes, note => note.Contains("Pack = 1 has no effect"));
    }

    [Fact]
    public void ExplicitOffsetsAreTakenVerbatimAndOverlapsAreFlagged()
    {
        var layout = Layout(
            "[StructLayout(LayoutKind.Explicit)] struct S { [FieldOffset(0)] public int AsInt; [FieldOffset(0)] public float AsFloat; }");

        Assert.Equal("Explicit", layout.Kind);
        Assert.All(layout.Fields, field => Assert.True(field.IsExplicit));
        Assert.False(layout.Fields[0].Overlaps);
        Assert.True(layout.Fields[1].Overlaps);
        Assert.Contains(layout.Notes, note => note.Contains("share the same bytes"));
    }

    [Fact]
    public void AReferenceIsCalledOutAsTheReasonTheOrderChanged()
    {
        var layout = Layout("struct S { public int Id; public string Name; }");

        Assert.Equal("Auto", layout.Kind);
        Assert.Contains(layout.Notes, note => note.Contains("holds a GC reference"));
    }

    [Fact]
    public void ExplicitAutoIsCalledOutAsRuntimeDetermined()
    {
        var layout = Layout("[StructLayout(LayoutKind.Auto)] struct S { public byte A; public long B; }");

        Assert.Contains(layout.Notes, note => note.Contains("LayoutKind.Auto"));
    }

    [Theory]
    [InlineData(LayoutTarget.X64, 8)]
    [InlineData(LayoutTarget.Arm64, 8)]
    [InlineData(LayoutTarget.X86, 4)]
    [InlineData(LayoutTarget.Wasm32, 4)]
    public void PointerSizedFieldsFollowTheChosenTarget(LayoutTarget target, int expected)
    {
        Assert.Equal(expected, Layout("struct S { public nint Handle; }", target).Size);
    }

    [Fact]
    public void ThirtyTwoBitTargetsCarryACaveat()
    {
        Assert.NotEmpty(LayoutCalculator.Calculate("struct S { }", LayoutTarget.Wasm32).Caveats);
        Assert.Empty(LayoutCalculator.Calculate("struct S { }", LayoutTarget.X64).Caveats);
    }

    [Fact]
    public void AnUnknownFieldTypeIsReportedRatherThanGuessedAt()
    {
        // Guessing costs either 8 bytes (class) or the struct's real size, and the two are
        // not close. Saying so beats a confident wrong number.
        var result = LayoutCalculator.Calculate("struct S { public MyThing Thing; }", LayoutTarget.X64);

        Assert.Contains(result.Diagnostics, message => message.Contains("MyThing"));
        Assert.Empty(result.Structs[0].Fields);
    }

    [Fact]
    public void ANestedStructIsResolvedEvenWhenDeclaredAfterwards()
    {
        var result = LayoutCalculator.Calculate(
            "struct Outer { public byte Flag; public Inner Inner; } struct Inner { public long Ticks; }",
            LayoutTarget.X64);

        Assert.Empty(result.Diagnostics);
        Assert.Equal(16, result.Structs[0].Size);
    }

    [Fact]
    public void FixedBuffersAreLaidOutAsRepeatedElements()
    {
        var layout = Layout("struct S { public fixed byte Buffer[16]; public int Tag; }");

        Assert.Equal(16, layout.Fields[0].Size);
        Assert.Equal(1, layout.Fields[0].Alignment);
        Assert.Equal(16, layout.Fields[1].Offset);
        Assert.Equal(20, layout.Size);
    }

    [Fact]
    public void ASelfReferencingPasteTerminatesRatherThanRecursingForever()
    {
        // Not legal C#, but a paste can still describe it, and the tool has to answer.
        var result = LayoutCalculator.Calculate("struct A { public B B; } struct B { public A A; }", LayoutTarget.X64);

        Assert.Equal(2, result.Structs.Count);
    }
}
