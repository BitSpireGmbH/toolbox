using System.Text.Json;
using Toolbox.Wasm.Core.Async;
using Xunit;

namespace Toolbox.Wasm.Tests;

public class AsyncExplainerTests
{
    private static readonly AsyncExplanation Explanation = AsyncExplainer.ExplainAsync().GetAwaiter().GetResult();

    private static AsyncScenario Scenario(string id) => Explanation.Scenarios.Single(s => s.Id == id);

    [Fact]
    public void RuntimeAsync_RemovesStateMachinesExceptForAsyncVoidAndIterators()
    {
        var byName = Explanation.Shapes.ToDictionary(s => s.Signature);

        Assert.All(Explanation.Shapes, shape => Assert.NotNull(shape.ClassicStateMachine));
        Assert.Null(byName["async Task SaveAsync()"].RuntimeAsyncStateMachine);
        Assert.Null(byName["async Task<int> CountAsync()"].RuntimeAsyncStateMachine);
        Assert.Null(byName["async ValueTask FlushAsync()"].RuntimeAsyncStateMachine);
        Assert.StartsWith("<OnClick>d__", byName["async void OnClick()"].RuntimeAsyncStateMachine);
        Assert.StartsWith("<ReadAllAsync>d__", byName["async IAsyncEnumerable<int> ReadAllAsync()"].RuntimeAsyncStateMachine);
    }

    [Fact]
    public void Stacks_ShowStateMachinePlumbingOnlyWithoutRuntimeAsync()
    {
        Assert.Null(Explanation.RuntimeAsyncError);
        Assert.Contains(Explanation.ClassicStack, line => line.Contains("AsyncMethodBuilderCore.Start"));
        Assert.Equal(["StackProbe.InnerAsync()", "StackProbe.MiddleAsync()", "StackProbe.OuterAsync()"], Explanation.RuntimeAsyncStack);
        Assert.Contains("ThrowInnerAsync", Explanation.ExceptionStack[0]);
    }

    [Fact]
    public void Scenarios_ReportWhatTheRuntimeActuallyDid()
    {
        Assert.Contains("task.Status = Faulted", Scenario("throw-before-await").Log[0]);
        Assert.Equal("await task threw the ArgumentNullException - only now", Scenario("throw-before-await").Log[2]);
        Assert.Equal(
            [
                "await task threw InvalidOperationException",
                "task.Wait() threw AggregateException wrapping InvalidOperationException",
                "task.Result threw AggregateException wrapping InvalidOperationException",
                "task.GetAwaiter().GetResult() threw InvalidOperationException",
            ],
            Scenario("await-vs-wait").Log);
        Assert.Contains("InnerExceptions holds 2", Scenario("when-all").Log[1]);
        var asyncVoid = Scenario("async-void").Log;
        Assert.StartsWith("SynchronizationContext.OperationStarted()", asyncVoid[0]);
        Assert.StartsWith("SynchronizationContext.Post()", asyncVoid[1]);
        Assert.StartsWith("FireAndForget() returned to the caller", asyncVoid[2]);
        Assert.Contains(asyncVoid, line => line.Contains("threw InvalidOperationException: \"from async void\""));
        Assert.Equal("await task threw InvalidOperationException into the caller's catch block", asyncVoid[^1]);

        var cancellation = Scenario("cancellation").Log;
        Assert.Contains("the when filter matched", cancellation[1]);
        Assert.Contains("task.Status = Canceled, task.IsFaulted = False, task.Exception is null", cancellation[2]);
    }

    [Fact]
    public async Task Json_IsCamelCase()
    {
        var root = JsonDocument.Parse(await AsyncExplainer.ExplainJsonAsync()).RootElement;
        Assert.Equal(JsonValueKind.Null, root.GetProperty("runtimeAsyncError").ValueKind);
        Assert.Equal(5, root.GetProperty("scenarios").GetArrayLength());
    }
}

public class TimelineProbeTests
{
    [Fact]
    public async Task EveryTaskAlternatesBetweenRunningAndWaiting()
    {
        var timeline = await TimelineProbe.RunAsync(blocking: false);

        foreach (var task in new[] { "A", "B", "C" })
        {
            var kinds = timeline.Segments.Where(s => s.Task == task).OrderBy(s => s.StartMs).Select(s => s.Kind);
            Assert.Equal(["run", "wait", "run", "wait", "run"], kinds);
        }

        Assert.All(timeline.Segments.Where(s => s.Kind == "wait"), s => Assert.Null(s.ThreadId));
        Assert.All(timeline.Segments.Where(s => s.Kind == "run"), s => Assert.NotNull(s.ThreadId));
        Assert.InRange(timeline.ThreadCount, 1, 15);
    }
}

public class TimelineProbeBlockingTests
{
    [Fact]
    public async Task BlockingRunsEachTaskToCompletionBeforeTheNextStarts()
    {
        var timeline = await TimelineProbe.RunAsync(blocking: true);

        Assert.Equal(["A", "B", "C"], timeline.Segments.Select(s => s.Task).Distinct());
        Assert.Equal(
            timeline.Segments.Select(s => s.Task),
            timeline.Segments.OrderBy(s => s.Task, StringComparer.Ordinal).Select(s => s.Task));
        Assert.All(timeline.Segments, s => Assert.NotEqual("wait", s.Kind));
        Assert.Equal(1, timeline.ThreadCount);
        Assert.True(timeline.TotalMs >= 440, $"blocking should take at least the sum of all waits, took {timeline.TotalMs}");
    }

    [Fact]
    public void Json_IsCamelCase()
    {
        var json = TimelineProbe.RunJson(new ThreadTimeline([new TimelineSegment("A", "wait", 0, 1, null, "x")], 1, 1));
        Assert.Contains("\"startMs\":0", json, StringComparison.Ordinal);
        Assert.Contains("\"threadCount\":1", json, StringComparison.Ordinal);
    }
}
