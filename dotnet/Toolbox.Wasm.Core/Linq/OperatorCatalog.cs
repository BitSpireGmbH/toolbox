using System.Globalization;

namespace Toolbox.Wasm.Core.Linq;

/// <summary>
/// Where an operator can appear in a C# query expression. Used only to decide whether
/// the chain has a faithful query-syntax form; chains that don't get no query syntax
/// at all rather than an approximation.
/// </summary>
internal enum QueryRole
{
    /// <summary>Not expressible as a clause (Take, Skip, Distinct, Reverse, …).</summary>
    None,
    Where,
    OrderBy,
    Select,
}

/// <summary>
/// One palette entry, bundling everything that must stay in step: the metadata the
/// browser renders, the lambda that actually runs, and the C# that gets shown to the
/// user. Keeping them in one place is what stops the generated code from drifting away
/// from the code that produced the trace.
/// </summary>
internal sealed record OperatorDefinition(
    LinqOperatorInfo Info,
    Func<IEnumerable<object?>, LinqOperatorSpec, IEnumerable<object?>> Apply,
    // (spec, rangeVariable) => ".Where(n => n > 3)"
    Func<LinqOperatorSpec, string, string> ToCode,
    QueryRole QueryRole,
    // (spec, rangeVariable) => "where n > 3". Null when QueryRole is None.
    Func<LinqOperatorSpec, string, string>? ToQueryClause = null);

/// <summary>A terminal operator, and how to run it against the traced pipeline.</summary>
internal sealed record TerminalDefinition(
    LinqTerminalInfo Info,
    // Null for "none": the query is built and deliberately never enumerated.
    Func<IEnumerable<object?>, string>? Execute,
    Func<string> ToCode);

/// <summary>
/// The fixed set of operators and terminals the tool offers.
///
/// The palette is deliberately closed. The alternative - letting the user type C# -
/// means shipping Roslyn, and the lesson here (when does each element move) needs a
/// real runtime far more than it needs arbitrary source.
///
/// Every element in every pipeline is an <c>int</c>. That is not a simplification for
/// its own sake: it means no chain the palette can build is capable of a type error, so
/// a beginner exploring combinations can never land on a message telling them they got
/// it wrong. <see cref="LinqPipelineRunnerTests"/> pins that property across every pair.
/// </summary>
public static class OperatorCatalog
{
    internal const string NumbersSource = "numbers";

    private static readonly string[] AllSources = [NumbersSource];

    // Palette headings. Operators are grouped by what they do to the sequence;
    // terminals by whether they can stop early, which is the thing this tool is about.
    private const string Filtering = "Filtering";
    private const string Changing = "Changing each number";
    private const string TakingSkipping = "Taking & skipping";
    private const string Reordering = "Reordering";

    private const string RunsNothing = "Runs nothing";
    private const string StopsEarly = "Can stop early";
    private const string NeedsEvery = "Needs every number";

    /// <summary>Bounds the source so a trace stays renderable.</summary>
    internal const int MinCount = 1;
    internal const int MaxCount = 200;

    internal const string RangeVariable = "n";
    internal const string SourceVariable = "numbers";

    internal static IEnumerable<object?> CreateSource(LinqSourceSpec spec)
    {
        var count = Math.Clamp(spec.Count, MinCount, MaxCount);
        return Enumerable.Range(1, count).Select(number => (object?)number);
    }

    internal static string SourceDeclaration(LinqSourceSpec spec)
    {
        var count = Math.Clamp(spec.Count, MinCount, MaxCount);
        return $"var numbers = Enumerable.Range(1, {count.ToString(CultureInfo.InvariantCulture)});";
    }

    // --- operators ----------------------------------------------------------

    private static readonly OperatorDefinition[] OperatorList =
    [
        // -- Filtering --
        Streaming(
            "where-greater-than", "Where(n => n > N)", Filtering,
            "Keeps only the numbers bigger than N. Checks them one at a time, as they arrive.",
            argKind: "number", defaultNumber: 3,
            apply: (source, spec) => source.Where(x => ToInt(x) > Arg(spec, 3)),
            code: (spec, v) => $".Where({v} => {v} > {Arg(spec, 3)})",
            role: QueryRole.Where,
            clause: (spec, v) => $"where {v} > {Arg(spec, 3)}"),

        Streaming(
            "where-even", "Where(n => n % 2 == 0)", Filtering,
            "Keeps only the even numbers. Checks them one at a time, as they arrive.",
            argKind: null,
            apply: (source, _) => source.Where(x => ToInt(x) % 2 == 0),
            code: (_, v) => $".Where({v} => {v} % 2 == 0)",
            role: QueryRole.Where,
            clause: (_, v) => $"where {v} % 2 == 0"),

        Streaming(
            "distinct", "Distinct()", Filtering,
            "Drops repeats. Still streams, but has to remember everything it has handed over.",
            argKind: null,
            apply: (source, _) => source.Distinct(),
            code: (_, _) => ".Distinct()",
            role: QueryRole.None),

        // -- Changing each number --
        Streaming(
            "select-double", "Select(n => n * 2)", Changing,
            "Doubles each number. Works on one number at a time, only when asked.",
            argKind: null,
            apply: (source, _) => source.Select(x => (object?)(ToInt(x) * 2)),
            code: (_, v) => $".Select({v} => {v} * 2)",
            role: QueryRole.Select,
            clause: (_, v) => $"select {v} * 2"),

        Streaming(
            "select-square", "Select(n => n * n)", Changing,
            "Squares each number. Works on one number at a time, only when asked.",
            argKind: null,
            apply: (source, _) => source.Select(x => (object?)(ToInt(x) * ToInt(x))),
            code: (_, v) => $".Select({v} => {v} * {v})",
            role: QueryRole.Select,
            clause: (_, v) => $"select {v} * {v}"),

        Streaming(
            "select-mod", "Select(n => n % N)", Changing,
            "Keeps the remainder after dividing by N - the quickest way to create repeats for Distinct.",
            argKind: "number", defaultNumber: 3,
            apply: (source, spec) => source.Select(x => (object?)(ToInt(x) % Modulus(spec))),
            code: (spec, v) => $".Select({v} => {v} % {Modulus(spec)})",
            role: QueryRole.Select,
            clause: (spec, v) => $"select {v} % {Modulus(spec)}"),

        // -- Taking & skipping --
        Streaming(
            "take", "Take(N)", TakingSkipping,
            "Stops the whole pipeline as soon as it has N numbers.",
            argKind: "number", defaultNumber: 3,
            apply: (source, spec) => source.Take(Arg(spec, 3)),
            code: (spec, _) => $".Take({Arg(spec, 3)})",
            role: QueryRole.None),

        Streaming(
            "take-while", "TakeWhile(n => n < N)", TakingSkipping,
            "Takes numbers until one fails the test, then stops - even if later ones would have passed.",
            argKind: "number", defaultNumber: 4,
            apply: (source, spec) => source.TakeWhile(x => ToInt(x) < Arg(spec, 4)),
            code: (spec, v) => $".TakeWhile({v} => {v} < {Arg(spec, 4)})",
            role: QueryRole.None),

        Streaming(
            "skip", "Skip(N)", TakingSkipping,
            "Ignores the first N numbers - but they still have to be fetched first.",
            argKind: "number", defaultNumber: 2,
            apply: (source, spec) => source.Skip(Arg(spec, 2)),
            code: (spec, _) => $".Skip({Arg(spec, 2)})",
            role: QueryRole.None),

        Streaming(
            "skip-while", "SkipWhile(n => n < N)", TakingSkipping,
            "Skips numbers until one fails the test, then lets every later one through.",
            argKind: "number", defaultNumber: 3,
            apply: (source, spec) => source.SkipWhile(x => ToInt(x) < Arg(spec, 3)),
            code: (spec, v) => $".SkipWhile({v} => {v} < {Arg(spec, 3)})",
            role: QueryRole.None),

        // -- Reordering --
        Buffering(
            "order-by-asc", "OrderBy(n => n)", Reordering,
            "Sorts smallest first - so it has to fetch every number before it can hand over even one.",
            apply: (source, _) => source.OrderBy(ToInt),
            code: (_, v) => $".OrderBy({v} => {v})",
            role: QueryRole.OrderBy,
            clause: (_, v) => $"orderby {v}"),

        Buffering(
            "order-by-desc", "OrderByDescending(n => n)", Reordering,
            "Sorts biggest first - so it has to fetch every number before it can hand over even one.",
            apply: (source, _) => source.OrderByDescending(ToInt),
            code: (_, v) => $".OrderByDescending({v} => {v})",
            role: QueryRole.OrderBy,
            clause: (_, v) => $"orderby {v} descending"),

        Buffering(
            "reverse", "Reverse()", Reordering,
            "Flips the order - so the last number has to be known before the first can come out.",
            apply: (source, _) => source.Reverse(),
            code: (_, _) => ".Reverse()",
            role: QueryRole.None),
    ];

    private static readonly Dictionary<string, OperatorDefinition> OperatorsById =
        OperatorList.ToDictionary(definition => definition.Info.Id, StringComparer.Ordinal);

    // --- terminals ----------------------------------------------------------

    private static readonly TerminalDefinition[] TerminalList =
    [
        new(
            new LinqTerminalInfo("none", "(nothing)", AllSources,
                "Builds the query and never runs it. Nothing happens at all.", RunsNothing),
            Execute: null,
            ToCode: () => "// Nothing has run: `query` is only a description of the work."),

        new(
            new LinqTerminalInfo("first", "First()", AllSources,
                "Stops at the very first number - and throws if there isn't one.", StopsEarly),
            Execute: sequence => Render(sequence.First()),
            ToCode: () => "var result = query.First();"),

        new(
            new LinqTerminalInfo("any", "Any()", AllSources,
                "Asks 'is there at least one?' - the cheapest question you can ask.", StopsEarly),
            Execute: sequence => Render(sequence.Any()),
            ToCode: () => "var result = query.Any();"),

        new(
            new LinqTerminalInfo("toList", "ToList()", AllSources,
                "Fetches everything and puts it in a list.", NeedsEvery),
            Execute: sequence => Describe(sequence.ToList()),
            ToCode: () => "var result = query.ToList();"),

        new(
            new LinqTerminalInfo("foreach", "foreach (…) { }", AllSources,
                "A plain loop - and exactly what ToList() does on the inside.", NeedsEvery),
            Execute: Consume,
            ToCode: () => "foreach (var item in query)\n{\n    Console.WriteLine(item);\n}"),

        new(
            new LinqTerminalInfo("last", "Last()", AllSources,
                "Gets the final number - which means fetching every single one first.", NeedsEvery),
            Execute: sequence => Render(sequence.Last()),
            ToCode: () => "var result = query.Last();"),

        new(
            new LinqTerminalInfo("count", "Count()", AllSources,
                "Counts them, which means fetching every one.", NeedsEvery),
            Execute: sequence => Render(sequence.Count()),
            ToCode: () => "var result = query.Count();"),

        new(
            new LinqTerminalInfo("sum", "Sum()", AllSources,
                "Adds them all up, which means fetching every one.", NeedsEvery),
            Execute: sequence => Render(sequence.Sum(ToInt)),
            ToCode: () => "var result = query.Sum();"),

        new(
            new LinqTerminalInfo("max", "Max()", AllSources,
                "Finds the biggest, which means looking at every one.", NeedsEvery),
            Execute: sequence => Render(sequence.Max(ToInt)),
            ToCode: () => "var result = query.Max();"),
    ];

    private static readonly Dictionary<string, TerminalDefinition> TerminalsById =
        TerminalList.ToDictionary(definition => definition.Info.Id, StringComparer.Ordinal);

    // --- lookup -------------------------------------------------------------

    /// <summary>The whole palette, as the browser renders it.</summary>
    public static LinqCatalog Describe() => new(
        [new LinqSourceInfo(NumbersSource, "Numbers", "int")],
        [.. OperatorList.Select(definition => definition.Info)],
        [.. TerminalList.Select(definition => definition.Info)]);

    internal static OperatorDefinition? FindOperator(string? id) =>
        OperatorsById.GetValueOrDefault(id ?? string.Empty);

    internal static TerminalDefinition? FindTerminal(string? id) =>
        TerminalsById.GetValueOrDefault(id ?? string.Empty);

    // --- helpers ------------------------------------------------------------

    private static OperatorDefinition Streaming(
        string id,
        string label,
        string group,
        string hint,
        string? argKind,
        Func<IEnumerable<object?>, LinqOperatorSpec, IEnumerable<object?>> apply,
        Func<LinqOperatorSpec, string, string> code,
        QueryRole role,
        Func<LinqOperatorSpec, string, string>? clause = null,
        double? defaultNumber = null) =>
        new(
            new LinqOperatorInfo(
                id, label, "streaming", argKind, defaultNumber, null, AllSources, hint, group),
            apply,
            code,
            role,
            clause);

    private static OperatorDefinition Buffering(
        string id,
        string label,
        string group,
        string hint,
        Func<IEnumerable<object?>, LinqOperatorSpec, IEnumerable<object?>> apply,
        Func<LinqOperatorSpec, string, string> code,
        QueryRole role,
        Func<LinqOperatorSpec, string, string>? clause = null) =>
        new(
            new LinqOperatorInfo(
                id, label, "buffering", null, null, null, AllSources, hint, group),
            apply,
            code,
            role,
            clause);

    private static int Arg(LinqOperatorSpec spec, int fallback) =>
        spec.Number is { } value && double.IsFinite(value)
            ? (int)Math.Clamp(value, -1_000_000, 1_000_000)
            : fallback;

    /// <summary>
    /// Never zero. The user can type 0 into the box, and `n % 0` throws
    /// <see cref="DivideByZeroException"/> - which would be the one way the palette
    /// could produce a failure, breaking the guarantee that anything you assemble here
    /// runs. Falling back to 1 keeps a typo harmless, and the generated C# shows the
    /// same value so the code still matches what ran.
    /// </summary>
    private static int Modulus(LinqOperatorSpec spec)
    {
        var value = Arg(spec, 3);
        return value == 0 ? 1 : value;
    }

    private static int ToInt(object? value) =>
        value is int number ? number : Convert.ToInt32(value, CultureInfo.InvariantCulture);

    private static string Render(object? value) => ValueRenderer.Render(value, 200);

    private static string Describe(IReadOnlyCollection<object?> items) =>
        $"[{string.Join(", ", items.Select(item => ValueRenderer.Render(item, 40)))}]  ({items.Count} items)";

    /// <summary>
    /// A real foreach over the pipeline. Written out rather than delegating to ToList
    /// so the generated C# and the executed code stay honest about each other.
    /// </summary>
    private static string Consume(IEnumerable<object?> sequence)
    {
        var seen = 0;
        foreach (var _ in sequence)
        {
            seen++;
        }

        return $"{seen} number(s) written to the console";
    }
}
