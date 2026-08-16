namespace Toolbox.Wasm.Core.Layout;

/// <summary>
/// Places the fields of a parsed struct at their real offsets.
///
/// The sequential rules are short: a field starts at the next multiple of its own
/// alignment (capped by <c>Pack</c>), the struct's alignment is the largest of its fields'
/// (also capped by <c>Pack</c>), and the total size is rounded up to that.
///
/// The part people get wrong is when those rules do not apply at all. C# makes every
/// struct <c>LayoutKind.Sequential</c> by default, but CoreCLR ignores that the moment the
/// struct contains a GC reference anywhere in its fields, and lays it out automatically
/// instead. So `struct S { int Id; string Name; }` is not four bytes then a pointer - it
/// is the pointer first, at offset 0. See <see cref="PlaceAutomatically"/>.
/// </summary>
public static class LayoutCalculator
{
    /// <summary>An empty struct still occupies a byte, so that two of them have distinct addresses.</summary>
    private const int EmptyStructSize = 1;

    /// <summary>Where a field goes in the auto-layout order.</summary>
    private enum FieldClass
    {
        /// <summary>A GC reference. Placed first, so the GC can find it cheaply.</summary>
        Reference,

        /// <summary>A built-in primitive. Bucketed by size, widest first.</summary>
        Primitive,

        /// <summary>Any other value: decimal, Guid, DateTime, a user struct. Placed last.</summary>
        Composite,
    }

    public static LayoutResult Calculate(string source, LayoutTarget target)
    {
        var diagnostics = new List<string>();
        var parsed = StructParser.Parse(source, diagnostics);

        var declared = parsed.ToDictionary(item => item.Name, StringComparer.Ordinal);
        var known = new Dictionary<string, TypeShape>(StringComparer.Ordinal);
        var layouts = new List<StructLayout>();

        // Seed every declared name first, so a struct can reference one declared further
        // down the same paste. The second pass replaces each estimate with the real answer.
        foreach (var declaration in parsed)
        {
            known[declaration.Name] = Estimate(declaration, target, known, declared);
        }

        foreach (var declaration in parsed)
        {
            var layout = Calculate(declaration, target, known, declared, diagnostics);
            known[declaration.Name] = new TypeShape(layout.Size, layout.Alignment);
            layouts.Add(layout);
        }

        return new LayoutResult(target.ToString(), layouts, diagnostics, Caveats(target));
    }

    private static StructLayout Calculate(
        ParsedStruct declaration,
        LayoutTarget target,
        IReadOnlyDictionary<string, TypeShape> known,
        IReadOnlyDictionary<string, ParsedStruct> declared,
        List<string> diagnostics)
    {
        var notes = new List<string>();

        var resolved = new List<(ParsedField Field, TypeShape Shape)>();
        foreach (var field in declaration.Fields)
        {
            if (Resolve(field.Type, target, known) is { } shape)
            {
                resolved.Add((field, shape));
            }
            else
            {
                diagnostics.Add(
                    $"`{declaration.Name}.{field.Name}`: unknown type `{field.Type}`. Paste its declaration if it is a struct, or write it as `object` if it is a class - the two lay out differently and guessing would be worse than saying so.");
            }
        }

        var holdsReference = HoldsReference(declaration, declared, []);
        var kind = EffectiveKind(declaration, holdsReference, notes);

        return kind == "Explicit"
            ? PlaceExplicitly(declaration, resolved, notes)
            : kind == "Auto"
                ? PlaceAutomatically(declaration, resolved, target, notes)
                : PlaceSequentially(declaration, resolved, notes);
    }

    /// <summary>
    /// What the runtime will actually do, which is not always what the declaration asks
    /// for. Records the difference as a note rather than silently substituting one for the
    /// other.
    /// </summary>
    private static string EffectiveKind(ParsedStruct declaration, bool holdsReference, List<string> notes)
    {
        if (declaration.Kind == "Explicit")
        {
            return "Explicit";
        }

        if (declaration.Kind == "Auto")
        {
            notes.Add("LayoutKind.Auto lets the runtime choose. These are CoreCLR's offsets today; nothing guarantees them across runtimes or versions, so do not marshal or persist this struct.");
            return "Auto";
        }

        if (holdsReference)
        {
            notes.Add("This struct holds a GC reference, so CoreCLR lays it out automatically and ignores the sequential order you wrote - references first, then the primitives widest-first. The offsets below are real, but they are not a contract: do not marshal or persist this struct.");
            return "Auto";
        }

        return "Sequential";
    }

    /// <summary>Fields in declaration order, each rounded up to its own alignment.</summary>
    private static StructLayout PlaceSequentially(
        ParsedStruct declaration,
        IReadOnlyList<(ParsedField Field, TypeShape Shape)> resolved,
        List<string> notes)
    {
        var (fields, size, alignment, padding, trailing) = Pack(resolved, declaration.Pack);

        return new StructLayout(
            declaration.Name,
            "Sequential",
            size,
            alignment,
            padding,
            declaration.Pack,
            fields,
            trailing,
            Suggest(resolved, declaration.Pack, size),
            notes);
    }

    /// <summary>
    /// CoreCLR's own order: every GC reference first, then the primitives bucketed by size
    /// widest-first, then everything else in declaration order.
    ///
    /// Derived by measuring the runtime rather than from documentation - see
    /// <c>LayoutRuntimeParityTests</c>, which declares each of these structs for real and
    /// compares against <c>Unsafe.ByteOffset</c>.
    /// </summary>
    private static StructLayout PlaceAutomatically(
        ParsedStruct declaration,
        IReadOnlyList<(ParsedField Field, TypeShape Shape)> resolved,
        LayoutTarget target,
        List<string> notes)
    {
        var ordered = resolved
            .Select((entry, index) => (entry.Field, entry.Shape, Index: index, Class: Classify(entry.Field.Type)))
            .OrderBy(entry => entry.Class)
            // Only the primitives are size-sorted; the other two groups keep declaration
            // order, so the key is constant within them.
            .ThenByDescending(entry => entry.Class == FieldClass.Primitive ? entry.Shape.Size : 0)
            .ThenBy(entry => entry.Index)
            .Select(entry => (entry.Field, entry.Shape))
            .ToArray();

        if (declaration.Pack > 0)
        {
            notes.Add($"Pack = {declaration.Pack} has no effect here: the runtime is choosing the layout, so it is not honouring the packing request either.");
        }

        // Pack is deliberately not applied - the runtime is not honouring the declaration.
        var (fields, size, alignment, padding, trailing) = Pack(ordered, 0);
        _ = target;

        return new StructLayout(
            declaration.Name,
            "Auto",
            size,
            alignment,
            padding,
            declaration.Pack,
            fields,
            trailing,
            // No suggestion: the runtime has already ordered these, so reordering the
            // source would change nothing.
            null,
            notes);
    }

    /// <summary>Offsets taken verbatim from <c>[FieldOffset]</c>, overlaps included.</summary>
    private static StructLayout PlaceExplicitly(
        ParsedStruct declaration,
        IReadOnlyList<(ParsedField Field, TypeShape Shape)> resolved,
        List<string> notes)
    {
        var placed = new List<LayoutField>();
        var occupied = new List<(int Start, int End)>();
        var end = 0;
        var alignment = 1;

        foreach (var (field, shape) in resolved)
        {
            if (field.ExplicitOffset is not { } offset)
            {
                notes.Add($"`{field.Name}` has no [FieldOffset]. Under LayoutKind.Explicit that does not compile, so it is left out below.");
                continue;
            }

            alignment = Math.Max(alignment, shape.Alignment);
            var fieldEnd = offset + shape.Size;
            var overlaps = occupied.Any(range => offset < range.End && range.Start < fieldEnd);
            occupied.Add((offset, fieldEnd));

            placed.Add(new LayoutField(field.Name, field.Type, offset, shape.Size, shape.Alignment, 0, true, overlaps));
            end = Math.Max(end, fieldEnd);
        }

        if (placed.Any(field => field.Overlaps))
        {
            notes.Add("Overlapping fields share the same bytes. That is legal under LayoutKind.Explicit and is how a C-style union is written - but it is also what a wrong offset looks like.");
        }

        var size = placed.Count == 0 ? EmptyStructSize : TypeCatalog.Align(end, alignment);

        // Gaps between explicit offsets are the user's, so they are reported as unused
        // rather than as padding the compiler inserted.
        var used = placed.Sum(field => field.Size);

        return new StructLayout(
            declaration.Name,
            "Explicit",
            size,
            alignment,
            Math.Max(0, size - used),
            declaration.Pack,
            placed,
            size - end,
            null,
            notes);
    }

    /// <summary>The shared placement loop: walk the fields in order, aligning as you go.</summary>
    private static (IReadOnlyList<LayoutField> Fields, int Size, int Alignment, int Padding, int Trailing) Pack(
        IReadOnlyList<(ParsedField Field, TypeShape Shape)> fields,
        int declaredPack)
    {
        var pack = declaredPack > 0 ? declaredPack : int.MaxValue;
        var placed = new List<LayoutField>();
        var offset = 0;
        var alignment = 1;
        var padding = 0;

        foreach (var (field, shape) in fields)
        {
            var effectiveAlignment = Math.Min(shape.Alignment, pack);
            alignment = Math.Max(alignment, effectiveAlignment);

            var start = TypeCatalog.Align(offset, effectiveAlignment);
            var paddingBefore = start - offset;
            padding += paddingBefore;

            placed.Add(new LayoutField(
                field.Name, field.Type, start, shape.Size, shape.Alignment, paddingBefore, false, false));

            offset = start + shape.Size;
        }

        if (placed.Count == 0)
        {
            return (placed, EmptyStructSize, 1, 0, 0);
        }

        var size = TypeCatalog.Align(offset, alignment);
        var trailing = size - offset;
        return (placed, size, alignment, padding + trailing, trailing);
    }

    private static FieldClass Classify(string type) =>
        TypeCatalog.IsReferenceShaped(type) ? FieldClass.Reference
        : TypeCatalog.IsPrimitive(type) ? FieldClass.Primitive
        : FieldClass.Composite;

    /// <summary>
    /// A field order with less padding, if there is one worth showing. Only offered for
    /// genuinely sequential structs - anywhere else the offsets are not the source order's
    /// to give.
    /// </summary>
    private static LayoutSuggestion? Suggest(
        IReadOnlyList<(ParsedField Field, TypeShape Shape)> resolved,
        int pack,
        int currentSize)
    {
        if (resolved.Count < 2)
        {
            return null;
        }

        // Widest alignment first: once the strictest field starts at zero, every later one
        // already sits on a boundary it is happy with.
        var reordered = resolved
            .OrderByDescending(entry => entry.Shape.Alignment)
            .ThenByDescending(entry => entry.Shape.Size)
            .ToArray();

        var (_, size, _, padding, _) = Pack(reordered, pack);

        return size < currentSize
            ? new LayoutSuggestion(reordered.Select(entry => entry.Field.Name).ToArray(), size, padding)
            : null;
    }

    /// <summary>
    /// Whether a GC reference is reachable from this struct's fields. Transitive, because
    /// a reference buried in a nested struct triggers auto layout for the outer one too.
    /// </summary>
    private static bool HoldsReference(
        ParsedStruct declaration,
        IReadOnlyDictionary<string, ParsedStruct> declared,
        HashSet<string> visiting)
    {
        // A struct cannot contain itself, but a malformed paste can still describe a
        // cycle, and this must terminate on one.
        if (!visiting.Add(declaration.Name))
        {
            return false;
        }

        foreach (var field in declaration.Fields)
        {
            if (TypeCatalog.IsReferenceShaped(field.Type))
            {
                return true;
            }

            var bare = field.Type.TrimEnd('?');
            if (declared.TryGetValue(bare, out var nested) && HoldsReference(nested, declared, visiting))
            {
                return true;
            }
        }

        return false;
    }

    /// <summary>
    /// A first-pass shape for a struct whose fields may reference structs not laid out
    /// yet. Deliberately crude: it only has to stop a forward reference resolving to
    /// nothing, and the second pass replaces it with the real answer.
    /// </summary>
    private static TypeShape Estimate(
        ParsedStruct declaration,
        LayoutTarget target,
        IReadOnlyDictionary<string, TypeShape> known,
        IReadOnlyDictionary<string, ParsedStruct> declared)
    {
        _ = declared;

        var resolved = declaration.Fields
            .Select(field => (Field: field, Shape: Resolve(field.Type, target, known)))
            .Where(entry => entry.Shape is not null)
            .Select(entry => (entry.Field, Shape: entry.Shape!.Value))
            .ToArray();

        var (_, size, alignment, _, _) = Pack(resolved, declaration.Pack);
        return new TypeShape(size, alignment);
    }

    private static TypeShape? Resolve(
        string type,
        LayoutTarget target,
        IReadOnlyDictionary<string, TypeShape> known)
    {
        // A fixed-size buffer is n copies of its element laid end to end, and it aligns
        // like one element rather than like the whole block.
        if (type.EndsWith(']') && type.LastIndexOf('[') is var open && open > 0)
        {
            var length = type[(open + 1)..^1];
            if (int.TryParse(length, out var count))
            {
                var element = Resolve(type[..open], target, known);
                return element is null
                    ? null
                    : new TypeShape(element.Value.Size * count, element.Value.Alignment);
            }
        }

        if (TypeCatalog.Resolve(type, target) is { } shape)
        {
            return shape;
        }

        var bare = type.TrimEnd('?');
        if (!known.TryGetValue(bare, out var declared))
        {
            return null;
        }

        // A declared struct written as `MyStruct?` is a Nullable<MyStruct>, same as for
        // the built-in value types.
        return bare.Length == type.Length ? declared : TypeCatalog.Wrap(declared);
    }

    private static IReadOnlyList<string> Caveats(LayoutTarget target) =>
        target is LayoutTarget.X86 or LayoutTarget.Wasm32
            ? [
                "32-bit target: references and nint are 4 bytes rather than 8.",
                "Best effort. The alignment CoreCLR gives long and double on a 32-bit runtime is an implementation detail, and the parity suite runs on a 64-bit host, so it cannot pin this target the way it pins x64.",
              ]
            : [];
}
