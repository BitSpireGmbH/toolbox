using System.Globalization;

namespace Toolbox.Wasm.Core.Linq;

/// <summary>
/// Builds a pipeline out of real <see cref="Enumerable"/> operators, splices a probe in
/// after every stage, runs the terminal, and hands back the observed event log.
///
/// Nothing here simulates LINQ. The operators are the BCL's own; the terminal drives
/// them; the trace is whatever actually happened on the way through. That is the only
/// reason the tool can claim to teach deferred execution rather than assert it.
///
/// Deliberately free of any WebAssembly or interop dependency - it targets plain
/// net10.0 so the semantics can be asserted in unit tests without a browser.
/// </summary>
public static class LinqPipelineRunner
{
    public static LinqRunResult Run(LinqPipelineSpec spec)
    {
        var steps = new List<(OperatorDefinition Definition, LinqOperatorSpec Spec)>();
        foreach (var operatorSpec in spec.Operators)
        {
            var definition = OperatorCatalog.FindOperator(operatorSpec.Id);
            if (definition is null)
            {
                return Failure($"Unknown operator '{operatorSpec.Id}'.");
            }

            steps.Add((definition, operatorSpec));
        }

        var terminal = OperatorCatalog.FindTerminal(spec.Terminal);
        if (terminal is null)
        {
            return Failure($"Unknown terminal operator '{spec.Terminal}'.");
        }

        var rangeVariable = OperatorCatalog.RangeVariable;
        var stages = BuildStages(spec, steps, rangeVariable);
        var log = new TraceLog();

        // Built once and reused, so that a second pass genuinely re-enumerates the same
        // query object rather than a fresh one - which is exactly the bug being shown.
        var query = BuildQuery(spec, steps, log);

        var resultText = Execute(terminal, query, spec.EnumerateTwice, log, out var truncated);

        return new LinqRunResult(
            stages,
            log.Events,
            BuildMethodSyntax(spec, steps, terminal, rangeVariable),
            BuildQuerySyntax(spec, steps, terminal, rangeVariable),
            resultText,
            BuildStats(log.Events),
            Error: null,
            Truncated: truncated || log.Truncated);
    }

    // --- execution ----------------------------------------------------------

    private static IEnumerable<object?> BuildQuery(
        LinqPipelineSpec spec,
        List<(OperatorDefinition Definition, LinqOperatorSpec Spec)> steps,
        TraceLog log)
    {
        IEnumerable<object?> current = new TracingEnumerable(
            OperatorCatalog.CreateSource(spec.Source), 0, log);

        for (var index = 0; index < steps.Count; index++)
        {
            var (definition, operatorSpec) = steps[index];
            current = new TracingEnumerable(definition.Apply(current, operatorSpec), index + 1, log);
        }

        return current;
    }

    private static string Execute(
        TerminalDefinition terminal,
        IEnumerable<object?> query,
        bool enumerateTwice,
        TraceLog log,
        out bool truncated)
    {
        truncated = false;

        if (terminal.Execute is null)
        {
            // Not an error, and not an empty result - the point of the whole demo.
            return "Nothing ran. The query has been built but never enumerated.";
        }

        try
        {
            var first = terminal.Execute(query);

            if (!enumerateTwice)
            {
                return first;
            }

            log.Pass = 1;
            var second = terminal.Execute(query);
            return $"Pass 1: {first}\nPass 2: {second}\n\nThe source was pulled all over again - "
                + "a query is a recipe, not a cached result.";
        }
        catch (TraceLimitReachedException)
        {
            truncated = true;
            return "Stopped early: this pipeline produced more steps than the visualizer can show.";
        }
        catch (Exception ex) when (IsUserVisibleFailure(ex))
        {
            // e.g. First() on an empty sequence. Worth showing as the outcome rather
            // than as a tool error - it is the behaviour being demonstrated.
            return $"{ex.GetType().Name}: {ex.Message}";
        }
    }

    /// <summary>
    /// Failures the composed query can legitimately produce. Anything else is a bug in
    /// the catalog and should surface as a crash rather than being dressed up as output.
    /// </summary>
    private static bool IsUserVisibleFailure(Exception ex) =>
        ex is InvalidOperationException or FormatException or OverflowException or ArgumentException;

    // --- reporting ----------------------------------------------------------

    private static IReadOnlyList<LinqStage> BuildStages(
        LinqPipelineSpec spec,
        List<(OperatorDefinition Definition, LinqOperatorSpec Spec)> steps,
        string rangeVariable)
    {
        var stages = new List<LinqStage>
        {
            new(0, DescribeSource(spec), "source"),
        };

        for (var index = 0; index < steps.Count; index++)
        {
            var (definition, operatorSpec) = steps[index];

            // Labelled from the generated code so the stage header shows the argument
            // the user actually chose, not the catalog's placeholder.
            stages.Add(new LinqStage(
                index + 1,
                definition.ToCode(operatorSpec, rangeVariable).TrimStart('.'),
                definition.Info.Kind));
        }

        return stages;
    }

    private static string DescribeSource(LinqPipelineSpec spec)
    {
        var count = Math.Clamp(spec.Source.Count, OperatorCatalog.MinCount, OperatorCatalog.MaxCount);
        return $"numbers (1..{count.ToString(CultureInfo.InvariantCulture)})";
    }

    private static LinqStats BuildStats(IReadOnlyList<LinqTraceEvent> events)
    {
        var sourcePulls = 0;
        var sourceYields = 0;
        var sourceExhausted = false;

        foreach (var traceEvent in events)
        {
            if (traceEvent.Stage != 0)
            {
                continue;
            }

            switch (traceEvent.Kind)
            {
                case "pulled":
                    sourcePulls++;
                    break;
                case "yielded":
                    sourceYields++;
                    break;
                default:
                    sourceExhausted = true;
                    break;
            }
        }

        // "Short-circuited" means the terminal stopped asking before the source ran
        // out - what Take/First/Any exist to do. No events at all is the deferred case,
        // which is a different lesson and not a short circuit.
        return new LinqStats(sourcePulls, sourceYields, events.Count, events.Count > 0 && !sourceExhausted);
    }

    // --- code generation ----------------------------------------------------

    private static string BuildMethodSyntax(
        LinqPipelineSpec spec,
        List<(OperatorDefinition Definition, LinqOperatorSpec Spec)> steps,
        TerminalDefinition terminal,
        string rangeVariable)
    {
        var lines = new List<string> { OperatorCatalog.SourceDeclaration(spec.Source), string.Empty };
        const string sourceVariable = OperatorCatalog.SourceVariable;

        if (steps.Count == 0)
        {
            lines.Add($"var query = {sourceVariable};");
        }
        else
        {
            lines.Add($"var query = {sourceVariable}");
            for (var index = 0; index < steps.Count; index++)
            {
                var (definition, operatorSpec) = steps[index];
                var fragment = definition.ToCode(operatorSpec, rangeVariable);
                lines.Add($"    {fragment}{(index == steps.Count - 1 ? ";" : string.Empty)}");
            }
        }

        lines.Add(string.Empty);
        lines.Add(terminal.ToCode());

        return string.Join("\n", lines);
    }

    /// <summary>
    /// Query syntax only when the chain genuinely maps onto a single query expression:
    /// any number of <c>where</c>, then at most one <c>orderby</c>, then at most one
    /// <c>select</c>. Take/Skip/Reverse have no clause form, and a second projection
    /// would need an <c>into</c> continuation, so those return null and the UI says so.
    /// Emitting almost-right C# would undercut the one promise the tool makes.
    /// </summary>
    private static string? BuildQuerySyntax(
        LinqPipelineSpec spec,
        List<(OperatorDefinition Definition, LinqOperatorSpec Spec)> steps,
        TerminalDefinition terminal,
        string rangeVariable)
    {
        if (steps.Count == 0 || steps.Any(step => step.Definition.QueryRole == QueryRole.None))
        {
            return null;
        }

        var roles = steps.Select(step => step.Definition.QueryRole).ToList();
        if (roles.Count(role => role == QueryRole.OrderBy) > 1
            || roles.Count(role => role == QueryRole.Select) > 1)
        {
            return null;
        }

        for (var index = 1; index < roles.Count; index++)
        {
            if (Rank(roles[index]) < Rank(roles[index - 1]))
            {
                return null;
            }
        }

        const string sourceVariable = OperatorCatalog.SourceVariable;
        var lines = new List<string>
        {
            OperatorCatalog.SourceDeclaration(spec.Source),
            string.Empty,
            "var query =",
            $"    from {rangeVariable} in {sourceVariable}",
        };

        foreach (var (definition, operatorSpec) in steps)
        {
            lines.Add($"    {definition.ToQueryClause!(operatorSpec, rangeVariable)}");
        }

        // A query expression must end in select (or group), so supply the identity
        // projection when the chain had no Select of its own.
        if (roles.All(role => role != QueryRole.Select))
        {
            lines.Add($"    select {rangeVariable}");
        }

        lines[^1] += ";";
        lines.Add(string.Empty);
        lines.Add(terminal.ToCode());

        return string.Join("\n", lines);
    }

    private static int Rank(QueryRole role) => role switch
    {
        QueryRole.Where => 0,
        QueryRole.OrderBy => 1,
        _ => 2,
    };

    private static LinqRunResult Failure(string message) => new(
        [],
        [],
        MethodSyntax: string.Empty,
        QuerySyntax: null,
        ResultText: string.Empty,
        new LinqStats(0, 0, 0, false),
        Error: message);
}
