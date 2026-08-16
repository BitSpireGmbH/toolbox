namespace Toolbox.Wasm.Core.Layout;

/// <summary>How much space a type takes and what boundary it has to start on.</summary>
public readonly record struct TypeShape(int Size, int Alignment);

/// <summary>
/// Sizes and alignments for the types the calculator understands without being shown a
/// declaration.
///
/// The values are not folklore: <c>LayoutRuntimeParityTests</c> derives each one from the
/// running .NET runtime - size from <c>Unsafe.SizeOf&lt;T&gt;()</c>, alignment from what a
/// <c>{ byte, T }</c> probe struct actually measures - and fails if this table disagrees.
/// The test host is 64-bit, so that grounding covers the two 64-bit targets exactly; the
/// 32-bit targets differ only in pointer size and are reported with a caveat.
/// </summary>
public static class TypeCatalog
{
    /// <summary>Types whose shape never changes with the target.</summary>
    private static readonly Dictionary<string, TypeShape> Fixed = new(StringComparer.Ordinal)
    {
        ["bool"] = new(1, 1),
        ["byte"] = new(1, 1),
        ["sbyte"] = new(1, 1),
        ["char"] = new(2, 2),
        ["short"] = new(2, 2),
        ["ushort"] = new(2, 2),
        ["int"] = new(4, 4),
        ["uint"] = new(4, 4),
        ["float"] = new(4, 4),
        ["long"] = new(8, 8),
        ["ulong"] = new(8, 8),
        ["double"] = new(8, 8),

        // Four int32 fields, so it aligns like an int rather than like its own size.
        ["decimal"] = new(16, 8),

        // Well-known BCL structs, by their real field layout rather than by reputation.
        ["Guid"] = new(16, 4),
        ["DateTime"] = new(8, 8),
        ["DateTimeOffset"] = new(16, 8),
        ["TimeSpan"] = new(8, 8),
        ["DateOnly"] = new(4, 4),
        ["TimeOnly"] = new(8, 8),
        ["Half"] = new(2, 2),
        ["Int128"] = new(16, 16),
        ["UInt128"] = new(16, 16),
    };

    /// <summary>
    /// Aliases for the framework names of the primitives, so a struct written with
    /// <c>Int32</c> rather than <c>int</c> still resolves.
    /// </summary>
    private static readonly Dictionary<string, string> Aliases = new(StringComparer.Ordinal)
    {
        ["Boolean"] = "bool",
        ["Byte"] = "byte",
        ["SByte"] = "sbyte",
        ["Char"] = "char",
        ["Int16"] = "short",
        ["UInt16"] = "ushort",
        ["Int32"] = "int",
        ["UInt32"] = "uint",
        ["Single"] = "float",
        ["Int64"] = "long",
        ["UInt64"] = "ulong",
        ["Double"] = "double",
        ["Decimal"] = "decimal",
    };

    /// <summary>
    /// Named types that are a GC reference. The rest are recognised by shape: an array, a
    /// generic like <c>List&lt;T&gt;</c>, or a nullable reference.
    ///
    /// Kept apart from <see cref="PointerSizedValues"/> because the distinction decides
    /// far more than size: a struct holding a GC reference is reordered by the runtime,
    /// while one holding an <c>nint</c> is not.
    /// </summary>
    private static readonly HashSet<string> References = new(StringComparer.Ordinal)
    {
        "object", "string", "dynamic",
    };

    /// <summary>One pointer wide, but not a GC reference.</summary>
    private static readonly HashSet<string> PointerSizedValues = new(StringComparer.Ordinal)
    {
        "nint", "nuint", "IntPtr", "UIntPtr",
    };

    /// <summary>4 on the 32-bit targets, 8 on the 64-bit ones.</summary>
    public static int PointerSize(LayoutTarget target) =>
        target is LayoutTarget.X86 or LayoutTarget.Wasm32 ? 4 : 8;

    /// <summary>
    /// The shape of <paramref name="type"/>, or <c>null</c> if it is a struct the user has
    /// not declared and the catalog does not know.
    /// </summary>
    public static TypeShape? Resolve(string type, LayoutTarget target)
    {
        var name = Normalize(type);

        if (IsReferenceShaped(name) || PointerSizedValues.Contains(name))
        {
            var pointer = PointerSize(target);
            return new TypeShape(pointer, pointer);
        }

        // A nullable value type is a Nullable<T>, which is a real struct with a bool in
        // front of the value - which is why int? is eight bytes and not five.
        if (name.EndsWith('?'))
        {
            var inner = Resolve(name[..^1], target);
            return inner is null ? null : Wrap(inner.Value);
        }

        if (Aliases.TryGetValue(name, out var alias))
        {
            name = alias;
        }

        return Fixed.TryGetValue(name, out var shape) ? shape : null;
    }

    /// <summary>The shape of <c>Nullable&lt;T&gt;</c> given the shape of <c>T</c>.</summary>
    public static TypeShape Wrap(TypeShape inner)
    {
        // struct Nullable<T> { bool hasValue; T value; } - the bool is padded out to the
        // value's alignment, so the wrapper costs a whole slot rather than one byte.
        var size = Align(inner.Alignment + inner.Size, inner.Alignment);
        return new TypeShape(size, inner.Alignment);
    }

    /// <summary>Rounds <paramref name="offset"/> up to the next multiple of <paramref name="alignment"/>.</summary>
    public static int Align(int offset, int alignment) =>
        alignment <= 1 ? offset : (offset + alignment - 1) / alignment * alignment;

    /// <summary>
    /// Whether the type is a GC reference: <c>object</c>, <c>string</c>, an array, or a
    /// generic like <c>List&lt;T&gt;</c>.
    ///
    /// This is the question that decides whether the struct gets laid out as written,
    /// because a struct containing one is reordered by the runtime - see
    /// <see cref="LayoutCalculator"/>.
    /// </summary>
    public static bool IsReferenceShaped(string type)
    {
        var name = Normalize(type);

        return References.Contains(name)
            || name.EndsWith("[]", StringComparison.Ordinal)
            || name.Contains('<', StringComparison.Ordinal);
    }

    /// <summary>
    /// Whether the type is one of the built-in primitives, which auto layout groups into
    /// size buckets. Everything else that is a value - <c>decimal</c>, <c>Guid</c>,
    /// <c>DateTime</c>, a user struct - is placed after those buckets instead.
    /// </summary>
    public static bool IsPrimitive(string type)
    {
        var name = Normalize(type);

        if (PointerSizedValues.Contains(name))
        {
            return true;
        }

        if (Aliases.TryGetValue(name, out var alias))
        {
            name = alias;
        }

        return name is "bool" or "byte" or "sbyte" or "char" or "short" or "ushort"
            or "int" or "uint" or "long" or "ulong" or "float" or "double";
    }

    /// <summary>
    /// Strips the parts that do not change layout: namespace qualifiers, and the trailing
    /// <c>?</c> of a nullable *reference* type. A nullable value type is left alone -
    /// <c>int?</c> is a <c>Nullable&lt;int&gt;</c> and is genuinely a different struct.
    /// </summary>
    private static string Normalize(string type)
    {
        var name = type.Trim();

        var lastDot = name.LastIndexOf('.');
        if (lastDot >= 0 && !name.Contains('<', StringComparison.Ordinal))
        {
            name = name[(lastDot + 1)..];
        }

        if (name.EndsWith('?') && IsReferenceShaped(name[..^1]))
        {
            name = name[..^1];
        }

        return name;
    }
}
