using System.Diagnostics;

namespace Toolbox.Wasm.Core.Linq;

/// <summary>Raised to abort a runaway enumeration. Caught by <see cref="LinqPipelineRunner"/>.</summary>
internal sealed class TraceLimitReachedException : Exception;

internal enum TraceEventKind
{
    Pulled,
    Yielded,
    Exhausted,
}

/// <summary>
/// Collects events in the order they actually happen, with a hard cap and a wall-clock
/// guard.
///
/// The cap is enforced by throwing rather than by silently dropping events: a partial
/// log that still *looks* complete would teach the wrong lesson, and the terminal
/// operator has to be stopped somehow. <see cref="LinqPipelineRunner"/> catches the
/// throw and reports the run as truncated.
/// </summary>
internal sealed class TraceLog
{
    /// <summary>Enough for every demo several times over; small enough to render.</summary>
    internal const int MaxEvents = 2000;

    private const int MaxRenderedLength = 40;
    private static readonly TimeSpan Budget = TimeSpan.FromSeconds(2);

    private readonly List<LinqTraceEvent> events = [];
    private readonly Stopwatch clock = Stopwatch.StartNew();

    /// <summary>Which enumeration this is - 0, or 1 for the second pass of a double enumeration.</summary>
    internal int Pass { get; set; }

    internal bool Truncated { get; private set; }

    internal IReadOnlyList<LinqTraceEvent> Events => events;

    internal void Record(int stage, TraceEventKind kind, object? value, bool hasValue)
    {
        if (events.Count >= MaxEvents || clock.Elapsed > Budget)
        {
            Truncated = true;
            throw new TraceLimitReachedException();
        }

        events.Add(new LinqTraceEvent(
            events.Count,
            stage,
            ToWireKind(kind),
            hasValue ? ValueRenderer.Render(value, MaxRenderedLength) : null,
            Pass));
    }

    private static string ToWireKind(TraceEventKind kind) => kind switch
    {
        TraceEventKind.Pulled => "pulled",
        TraceEventKind.Yielded => "yielded",
        _ => "exhausted",
    };
}

/// <summary>
/// A pass-through decorator that records every <c>MoveNext</c> crossing it.
///
/// One of these is spliced in after the source and after every operator, so a pull
/// from the terminal cascades down the chain (<c>pulled</c> at descending stages) and
/// the element travels back up (<c>yielded</c> at ascending stages). That cascade *is*
/// the interleaving the tool exists to show - it is observed, not reconstructed.
///
/// Deliberately typed over <c>object?</c> rather than generic: the pipeline boxes so
/// that <c>Select</c> can change element type without a generic explosion. Boxing
/// affects none of the semantics on display (deferral, interleaving, short-circuiting,
/// buffering), and the operators doing the work are the genuine <see cref="Enumerable"/>
/// ones.
/// </summary>
internal sealed class TracingEnumerable(IEnumerable<object?> inner, int stage, TraceLog log)
    : IEnumerable<object?>
{
    public IEnumerator<object?> GetEnumerator() =>
        new TracingEnumerator(inner.GetEnumerator(), stage, log);

    System.Collections.IEnumerator System.Collections.IEnumerable.GetEnumerator() => GetEnumerator();

    private sealed class TracingEnumerator(IEnumerator<object?> inner, int stage, TraceLog log)
        : IEnumerator<object?>
    {
        public object? Current => inner.Current;

        public bool MoveNext()
        {
            log.Record(stage, TraceEventKind.Pulled, null, hasValue: false);

            if (inner.MoveNext())
            {
                log.Record(stage, TraceEventKind.Yielded, inner.Current, hasValue: true);
                return true;
            }

            log.Record(stage, TraceEventKind.Exhausted, null, hasValue: false);
            return false;
        }

        public void Reset() => inner.Reset();

        public void Dispose() => inner.Dispose();
    }
}
