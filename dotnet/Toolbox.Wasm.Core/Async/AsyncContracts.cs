using System.Text.Json.Serialization;

namespace Toolbox.Wasm.Core.Async;

/// <param name="ClassicStateMachine">What the compiler generates without runtime async.</param>
/// <param name="RuntimeAsyncStateMachine">With runtime-async=on; null means the method is flagged MethodImplOptions.Async instead.</param>
public sealed record AsyncMethodShape(string Signature, string? ClassicStateMachine, string? RuntimeAsyncStateMachine);

public sealed record AsyncScenario(string Id, string Title, string Code, IReadOnlyList<string> Log, string Takeaway);

/// <param name="Kind"><c>run</c> (working on a thread), <c>block</c> (waiting but still holding it) or <c>wait</c> (holding none, so <paramref name="ThreadId"/> is null).</param>
public sealed record TimelineSegment(string Task, string Kind, double StartMs, double EndMs, int? ThreadId, string Label);

public sealed record ThreadTimeline(IReadOnlyList<TimelineSegment> Segments, double TotalMs, int ThreadCount);

/// <param name="RuntimeAsyncError">Why the running runtime refused to execute runtime-async code, or null if it ran it.</param>
/// <param name="RuntimeAsyncStack">Empty when <paramref name="RuntimeAsyncError"/> is set.</param>
public sealed record AsyncExplanation(
    string? RuntimeAsyncError,
    IReadOnlyList<AsyncMethodShape> Shapes,
    IReadOnlyList<string> ClassicStack,
    IReadOnlyList<string> RuntimeAsyncStack,
    IReadOnlyList<string> ExceptionStack,
    IReadOnlyList<AsyncScenario> Scenarios);

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(AsyncExplanation))]
[JsonSerializable(typeof(ThreadTimeline))]
public sealed partial class AsyncJsonContext : JsonSerializerContext;
