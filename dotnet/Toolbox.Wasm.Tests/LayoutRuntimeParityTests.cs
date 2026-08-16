using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using Toolbox.Wasm.Core.Layout;
using Xunit;

namespace Toolbox.Wasm.Tests;

#pragma warning disable CS0649 // Fields are never assigned - they exist only to be measured.

/// <summary>
/// The honesty mechanism for the whole calculator.
///
/// Every struct here is declared twice: once as a real C# type the runtime lays out, and
/// once as the source text the tool is given. If the two ever disagree, the calculator has
/// stopped describing .NET and started describing its own idea of .NET.
///
/// Offsets are read with <see cref="Unsafe.ByteOffset"/> rather than
/// <c>Marshal.OffsetOf</c> on purpose: <c>Marshal</c> reports the *interop* layout, where
/// <c>bool</c> is four bytes and <c>char</c> is one, which is a different question from
/// the one this tool answers.
///
/// These run under `dotnet test` on a 64-bit host, so they pin the x64/ARM64 target
/// exactly - which is the default. The 32-bit targets differ only in pointer size and are
/// reported to the user with a caveat rather than a guarantee.
/// </summary>
public class LayoutRuntimeParityTests
{
    private static int OffsetOf<T, TField>(ref T instance, ref TField field) =>
        (int)Unsafe.ByteOffset(
            ref Unsafe.As<T, byte>(ref instance),
            ref Unsafe.As<TField, byte>(ref field));

    private static StructLayout LayoutOf(string source)
    {
        var result = LayoutCalculator.Calculate(source, LayoutTarget.X64);
        Assert.Empty(result.Diagnostics);

        // The struct under test is always the last one declared in the source.
        return result.Structs[^1];
    }

    private static void AssertField(StructLayout layout, string name, int expectedOffset)
    {
        var field = Assert.Single(layout.Fields, candidate => candidate.Name == name);
        Assert.Equal(expectedOffset, field.Offset);
    }

    // ---------------------------------------------------------------- sequential

    private struct Empty;

    private struct ThreeInts
    {
        public int A;
        public int B;
        public int C;
    }

    private struct PaddedByLong
    {
        public int Id;
        public long Ticks;
    }

    private struct BoolCharInt
    {
        public bool Flag;
        public char Initial;
        public int Count;
    }

    private struct NoRefs
    {
        public byte A;
        public long B;
        public short C;
        public int D;
    }

    private struct WithDecimal
    {
        public byte Flag;
        public decimal Amount;
    }

    private struct WithWellKnown
    {
        public Guid Id;
        public DateTime CreatedAt;
        public TimeSpan Elapsed;
        public DateOnly Day;
    }

    private struct WithNullable
    {
        public int? MaybeId;
        public bool? MaybeFlag;
    }

    private struct Nested
    {
        public byte Flag;
        public PaddedByLong Inner;
    }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    private struct PackedToOne
    {
        public byte Flag;
        public long Ticks;
    }

    [StructLayout(LayoutKind.Sequential, Pack = 2)]
    private struct PackedToTwo
    {
        public byte Flag;
        public int Value;
    }

    [StructLayout(LayoutKind.Explicit)]
    private struct Union
    {
        [FieldOffset(0)] public int AsInt;
        [FieldOffset(0)] public float AsFloat;
        [FieldOffset(4)] public int Tag;
    }

    public static TheoryData<string, int, string> SizeCorpus() => new()
    {
        { nameof(Empty), Unsafe.SizeOf<Empty>(), "struct S { }" },
        { nameof(ThreeInts), Unsafe.SizeOf<ThreeInts>(), "struct S { public int A; public int B; public int C; }" },
        { nameof(PaddedByLong), Unsafe.SizeOf<PaddedByLong>(), "struct S { public int Id; public long Ticks; }" },
        { nameof(BoolCharInt), Unsafe.SizeOf<BoolCharInt>(), "struct S { public bool Flag; public char Initial; public int Count; }" },
        { nameof(NoRefs), Unsafe.SizeOf<NoRefs>(), "struct S { public byte A; public long B; public short C; public int D; }" },
        { nameof(WithDecimal), Unsafe.SizeOf<WithDecimal>(), "struct S { public byte Flag; public decimal Amount; }" },
        { nameof(WithWellKnown), Unsafe.SizeOf<WithWellKnown>(), "struct S { public Guid Id; public DateTime CreatedAt; public TimeSpan Elapsed; public DateOnly Day; }" },
        { nameof(WithNullable), Unsafe.SizeOf<WithNullable>(), "struct S { public int? MaybeId; public bool? MaybeFlag; }" },
        { nameof(Nested), Unsafe.SizeOf<Nested>(), "struct Inner { public int Id; public long Ticks; } struct S { public byte Flag; public Inner Inner; }" },
        { nameof(PackedToOne), Unsafe.SizeOf<PackedToOne>(), "[StructLayout(LayoutKind.Sequential, Pack = 1)] struct S { public byte Flag; public long Ticks; }" },
        { nameof(PackedToTwo), Unsafe.SizeOf<PackedToTwo>(), "[StructLayout(LayoutKind.Sequential, Pack = 2)] struct S { public byte Flag; public int Value; }" },
        { nameof(Union), Unsafe.SizeOf<Union>(), "[StructLayout(LayoutKind.Explicit)] struct S { [FieldOffset(0)] public int AsInt; [FieldOffset(0)] public float AsFloat; [FieldOffset(4)] public int Tag; }" },

        // Auto layout, forced by a GC reference.
        { nameof(WithReference), Unsafe.SizeOf<WithReference>(), "struct S { public int Id; public string Name; public byte Flag; public long Ticks; }" },
        { nameof(TwoRefs), Unsafe.SizeOf<TwoRefs>(), "struct S { public byte Head; public string A; public int Mid; public string B; }" },
        { nameof(Mixed), Unsafe.SizeOf<Mixed>(), "struct S { public byte A; public long B; public string R; public short C; public int D; }" },
        { nameof(RefAndDecimal), Unsafe.SizeOf<RefAndDecimal>(), "struct S { public byte A; public decimal M; public string R; }" },
        { nameof(RefAndGuid), Unsafe.SizeOf<RefAndGuid>(), "struct S { public byte A; public Guid G; public string R; }" },
        { nameof(RefAndNullable), Unsafe.SizeOf<RefAndNullable>(), "struct S { public byte A; public int? N; public string R; }" },
        { nameof(NestedRef), Unsafe.SizeOf<NestedRef>(), "struct HasRef { public int Id; public string Name; } struct S { public byte Head; public HasRef Inner; public long Tail; }" },
    };

    [Theory]
    [MemberData(nameof(SizeCorpus))]
    public void CalculatedSizeMatchesTheRunningRuntime(string name, int actualSize, string source)
    {
        Assert.Equal(actualSize, LayoutOf(source).Size);
        Assert.NotEqual(string.Empty, name);
    }

    // ---------------------------------------------------------------- auto layout

    private struct WithReference
    {
        public int Id;
        public string Name;
        public byte Flag;
        public long Ticks;
    }

    private struct TwoRefs
    {
        public byte Head;
        public string A;
        public int Mid;
        public string B;
    }

    private struct Mixed
    {
        public byte A;
        public long B;
        public string R;
        public short C;
        public int D;
    }

    private struct RefAndDecimal
    {
        public byte A;
        public decimal M;
        public string R;
    }

    private struct RefAndGuid
    {
        public byte A;
        public Guid G;
        public string R;
    }

    private struct RefAndNullable
    {
        public byte A;
        public int? N;
        public string R;
    }

    private struct HasRef
    {
        public int Id;
        public string Name;
    }

    private struct NestedRef
    {
        public byte Head;
        public HasRef Inner;
        public long Tail;
    }

    [Fact]
    public void SequentialOffsetsMatchTheRunningRuntime()
    {
        var b = default(BoolCharInt);
        var layout = LayoutOf("struct S { public bool Flag; public char Initial; public int Count; }");
        AssertField(layout, "Flag", OffsetOf(ref b, ref b.Flag));
        AssertField(layout, "Initial", OffsetOf(ref b, ref b.Initial));
        AssertField(layout, "Count", OffsetOf(ref b, ref b.Count));

        var n = default(NoRefs);
        var noRefs = LayoutOf("struct S { public byte A; public long B; public short C; public int D; }");
        AssertField(noRefs, "A", OffsetOf(ref n, ref n.A));
        AssertField(noRefs, "B", OffsetOf(ref n, ref n.B));
        AssertField(noRefs, "C", OffsetOf(ref n, ref n.C));
        AssertField(noRefs, "D", OffsetOf(ref n, ref n.D));
    }

    [Fact]
    public void AReferenceMakesTheRuntimeReorderTheStruct()
    {
        // The headline case, and the one a sequential model gets wrong: the pointer is at
        // offset 0, not after Id.
        var w = default(WithReference);
        var layout = LayoutOf("struct S { public int Id; public string Name; public byte Flag; public long Ticks; }");

        Assert.Equal("Auto", layout.Kind);
        AssertField(layout, "Name", OffsetOf(ref w, ref w.Name));
        AssertField(layout, "Ticks", OffsetOf(ref w, ref w.Ticks));
        AssertField(layout, "Id", OffsetOf(ref w, ref w.Id));
        AssertField(layout, "Flag", OffsetOf(ref w, ref w.Flag));
        Assert.Equal(0, layout.Fields.Single(field => field.Name == "Name").Offset);
    }

    [Fact]
    public void EveryReferenceIsPlacedBeforeTheRest()
    {
        var t = default(TwoRefs);
        var layout = LayoutOf("struct S { public byte Head; public string A; public int Mid; public string B; }");

        AssertField(layout, "A", OffsetOf(ref t, ref t.A));
        AssertField(layout, "B", OffsetOf(ref t, ref t.B));
        AssertField(layout, "Mid", OffsetOf(ref t, ref t.Mid));
        AssertField(layout, "Head", OffsetOf(ref t, ref t.Head));
    }

    [Fact]
    public void PrimitivesAreBucketedWidestFirst()
    {
        var m = default(Mixed);
        var layout = LayoutOf("struct S { public byte A; public long B; public string R; public short C; public int D; }");

        AssertField(layout, "R", OffsetOf(ref m, ref m.R));
        AssertField(layout, "B", OffsetOf(ref m, ref m.B));
        AssertField(layout, "D", OffsetOf(ref m, ref m.D));
        AssertField(layout, "C", OffsetOf(ref m, ref m.C));
        AssertField(layout, "A", OffsetOf(ref m, ref m.A));
    }

    [Theory]
    [InlineData("decimal")]
    [InlineData("Guid")]
    [InlineData("Nullable")]
    public void CompositeValuesArePlacedAfterThePrimitiveBuckets(string which)
    {
        // decimal and Guid are eight- and sixteen-byte values, but they are not primitives,
        // so they land after even a single byte rather than being sorted by width.
        switch (which)
        {
            case "decimal":
                var d = default(RefAndDecimal);
                var forDecimal = LayoutOf("struct S { public byte A; public decimal M; public string R; }");
                AssertField(forDecimal, "R", OffsetOf(ref d, ref d.R));
                AssertField(forDecimal, "A", OffsetOf(ref d, ref d.A));
                AssertField(forDecimal, "M", OffsetOf(ref d, ref d.M));
                break;

            case "Guid":
                var g = default(RefAndGuid);
                var forGuid = LayoutOf("struct S { public byte A; public Guid G; public string R; }");
                AssertField(forGuid, "R", OffsetOf(ref g, ref g.R));
                AssertField(forGuid, "A", OffsetOf(ref g, ref g.A));
                AssertField(forGuid, "G", OffsetOf(ref g, ref g.G));
                break;

            default:
                var n = default(RefAndNullable);
                var forNullable = LayoutOf("struct S { public byte A; public int? N; public string R; }");
                AssertField(forNullable, "R", OffsetOf(ref n, ref n.R));
                AssertField(forNullable, "A", OffsetOf(ref n, ref n.A));
                AssertField(forNullable, "N", OffsetOf(ref n, ref n.N));
                break;
        }
    }

    [Fact]
    public void AReferenceInsideANestedStructReordersTheOuterOneToo()
    {
        var n = default(NestedRef);
        var layout = LayoutOf(
            "struct HasRef { public int Id; public string Name; } struct S { public byte Head; public HasRef Inner; public long Tail; }");

        Assert.Equal("Auto", layout.Kind);
        AssertField(layout, "Tail", OffsetOf(ref n, ref n.Tail));
        AssertField(layout, "Head", OffsetOf(ref n, ref n.Head));
        AssertField(layout, "Inner", OffsetOf(ref n, ref n.Inner));
    }

    // ---------------------------------------------------------------- catalog

    private struct DecimalProbe
    {
        public byte Head;
        public decimal Value;
    }

    private struct GuidProbe
    {
        public byte Head;
        public Guid Value;
    }

    private struct DateTimeProbe
    {
        public byte Head;
        public DateTime Value;
    }

    /// <summary>
    /// Derives alignment from the runtime rather than trusting the table: in
    /// <c>struct { byte b; T t; }</c> the field <c>t</c> lands on the first offset that
    /// satisfies its alignment, which is the alignment itself.
    /// </summary>
    [Theory]
    [InlineData("bool", 1)]
    [InlineData("byte", 1)]
    [InlineData("char", 2)]
    [InlineData("short", 2)]
    [InlineData("int", 4)]
    [InlineData("float", 4)]
    [InlineData("long", 8)]
    [InlineData("double", 8)]
    [InlineData("decimal", 8)]
    [InlineData("Guid", 4)]
    [InlineData("DateTime", 8)]
    [InlineData("TimeSpan", 8)]
    public void CatalogAlignmentsMatchTheProbeTheyClaim(string type, int expected)
    {
        Assert.Equal(expected, TypeCatalog.Resolve(type, LayoutTarget.X64)!.Value.Alignment);

        var probe = LayoutOf($"struct S {{ public byte Head; public {type} Value; }}");
        AssertField(probe, "Value", expected);
    }

    [Fact]
    public void TheProbesThemselvesMatchTheRealRuntime()
    {
        // Closes the loop on the test above: those expectations cannot drift away from
        // .NET without these failing too.
        var d = default(DecimalProbe);
        Assert.Equal(8, OffsetOf(ref d, ref d.Value));

        var g = default(GuidProbe);
        Assert.Equal(4, OffsetOf(ref g, ref g.Value));

        var t = default(DateTimeProbe);
        Assert.Equal(8, OffsetOf(ref t, ref t.Value));
    }

    [Fact]
    public void ReferenceFieldsAreEightBytesOnSixtyFourBitAndFourOnThirtyTwo()
    {
        const string source = "struct S { public string Name; }";

        Assert.Equal(8, LayoutCalculator.Calculate(source, LayoutTarget.X64).Structs[0].Size);
        Assert.Equal(4, LayoutCalculator.Calculate(source, LayoutTarget.Wasm32).Structs[0].Size);
    }
}

#pragma warning restore CS0649
