using System.Diagnostics;

namespace Toolbox.Wasm.Core.Async;

/// <summary>
/// Runs three tasks concurrently and records, for each, when it occupied a thread and when it
/// was only waiting. In the browser every run segment reports the same thread, which is the
/// whole point: concurrency without one thread per task.
///
/// With <c>blocking</c> the waits hold the thread instead, the way <c>Thread.Sleep</c> or
/// <c>.Result</c> would. The browser cannot put its only thread to sleep, so that wait spins
/// for the same time - to the thread, the effect is identical.
/// </summary>
public static class TimelineProbe
{
    public const int WorkMs = 8;

    private static readonly (string Name, int[] Waits)[] Workers =
    [
        ("A", [120, 60]),
        ("B", [40, 100]),
        ("C", [80, 40]),
    ];

    public static string RunJson(ThreadTimeline timeline) =>
        System.Text.Json.JsonSerializer.Serialize(timeline, AsyncJsonContext.Default.ThreadTimeline);

    public static async Task<ThreadTimeline> RunAsync(bool blocking)
    {
        var clock = Stopwatch.StartNew();
        List<TimelineSegment> segments = [];

        await Task.WhenAll(Workers.Select(worker => WorkAsync(worker.Name, worker.Waits, blocking, clock, segments)));

        var threads = segments.Where(s => s.Kind == "run").Select(s => s.ThreadId).Distinct().Count();
        return new ThreadTimeline([.. segments.OrderBy(s => s.StartMs)], clock.Elapsed.TotalMilliseconds, threads);
    }

    private static async Task WorkAsync(string name, int[] waits, bool blocking, Stopwatch clock, List<TimelineSegment> segments)
    {
        for (var step = 0; step <= waits.Length; step++)
        {
            var start = clock.Elapsed.TotalMilliseconds;
            Spin(clock, WorkMs);

            var label = step == 0 ? "starts" : step == waits.Length ? "resumes, finishes" : "resumes";
            Add(segments, new TimelineSegment(name, "run", start, clock.Elapsed.TotalMilliseconds, Environment.CurrentManagedThreadId, label));

            if (step == waits.Length)
            {
                return;
            }

            var waitStart = clock.Elapsed.TotalMilliseconds;
            if (blocking)
            {
                Spin(clock, waits[step]);
                Add(segments, new TimelineSegment(name, "block", waitStart, clock.Elapsed.TotalMilliseconds, Environment.CurrentManagedThreadId, $"Thread.Sleep({waits[step]})"));
            }
            else
            {
                await Task.Delay(waits[step]);
                Add(segments, new TimelineSegment(name, "wait", waitStart, clock.Elapsed.TotalMilliseconds, null, $"await Task.Delay({waits[step]})"));
            }
        }
    }

    private static void Spin(Stopwatch clock, int milliseconds)
    {
        var start = clock.Elapsed.TotalMilliseconds;
        while (clock.Elapsed.TotalMilliseconds - start < milliseconds)
        {
        }
    }

    private static void Add(List<TimelineSegment> segments, TimelineSegment segment)
    {
        lock (segments)
        {
            segments.Add(segment);
        }
    }
}
