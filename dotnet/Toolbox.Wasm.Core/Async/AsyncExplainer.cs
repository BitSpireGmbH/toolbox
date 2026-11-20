using System.Diagnostics.CodeAnalysis;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Text.Json;

namespace Toolbox.Wasm.Core.Async;

/// <summary>
/// Runs every async/await scenario for real and reports what the runtime did. Each
/// scenario's displayed code mirrors its method in <see cref="Scenarios"/> line for line,
/// including the real suspension at <c>await Task.Yield()</c>.
/// </summary>
public static class AsyncExplainer
{
    public static async Task<string> ExplainJsonAsync() =>
        JsonSerializer.Serialize(await ExplainAsync(), AsyncJsonContext.Default.AsyncExplanation);

    public static async Task<AsyncExplanation> ExplainAsync()
    {
        var (runtimeAsyncStack, runtimeAsyncError) = await TryRuntimeAsync();
        var classic = DescribeShapes(typeof(Shapes));
        var runtimeAsync = DescribeShapes(RuntimeAsyncCompiled.Shapes);

        return new AsyncExplanation(
            runtimeAsyncError,
            [.. classic.Zip(runtimeAsync, (before, after) => new AsyncMethodShape(before.Signature, before.StateMachine, after.StateMachine))],
            Lines(await StackProbe.OuterAsync()),
            runtimeAsyncStack,
            Lines(StackProbe.ThrowingStackTrace()),
            [await ThrowBeforeAwait(), await AwaitVersusWait(), await WhenAll(), await AsyncVoid(), await Cancellation()]);
    }

    /// <summary>Mono, which runs this in the browser, rejects runtime-async methods when they are first called.</summary>
    private static async Task<(List<string> Stack, string? Error)> TryRuntimeAsync()
    {
        try
        {
            return (Lines(await RuntimeAsyncCompiled.CaptureStackAsync()), null);
        }
        catch (Exception exception)
        {
            return ([], $"{exception.GetType().Name}: {exception.Message}");
        }
    }

    private static List<(string Signature, string? StateMachine)> DescribeShapes(
        [DynamicallyAccessedMembers(DynamicallyAccessedMemberTypes.PublicMethods)] Type shapes) =>
        [.. shapes
            .GetMethods(BindingFlags.Public | BindingFlags.Static | BindingFlags.DeclaredOnly)
            .OrderBy(method => method.MetadataToken)
            .Select(method =>
            {
                var stateMachine = method.GetCustomAttribute<StateMachineAttribute>()?.StateMachineType;
                return (
                    $"async {ReturnTypeName(method.ReturnType)} {method.Name}()",
                    (method.MethodImplementationFlags & MethodImplAttributes.Async) != 0 || stateMachine is null
                        ? null
                        : $"{stateMachine.Name} ({(stateMachine.IsValueType ? "struct" : "class")})");
            })];

    private static string ReturnTypeName(Type type) => type switch
    {
        _ when type == typeof(void) => "void",
        _ when type == typeof(int) => "int",
        { IsGenericType: true } => $"{type.Name[..type.Name.IndexOf('`', StringComparison.Ordinal)]}<{string.Join(", ", type.GetGenericArguments().Select(ReturnTypeName))}>",
        _ => type.Name,
    };

    private static async Task<AsyncScenario> ThrowBeforeAwait()
    {
        List<string> log = [];

        var task = Scenarios.ValidateAsync(null);
        log.Add($"ValidateAsync(null) returned a Task without throwing. task.Status = {task.Status}");

        try
        {
            _ = Scenarios.ValidateEager(null);
        }
        catch (ArgumentNullException)
        {
            log.Add("ValidateEager(null) threw ArgumentNullException at the call site");
        }

        try
        {
            await task;
        }
        catch (ArgumentNullException)
        {
            log.Add("await task threw the ArgumentNullException - only now");
        }

        return new AsyncScenario(
            "throw-before-await",
            "A throw before the first await",
            """
            async Task ValidateAsync(string? name)
            {
                // runs before any await
                ArgumentNullException.ThrowIfNull(name);
                await SaveAsync(name);
            }

            Task ValidateEager(string? name) // no async
            {
                ArgumentNullException.ThrowIfNull(name);
                return SaveAsync(name);
            }

            var task = ValidateAsync(null); // no throw: stored in task
            ValidateEager(null);            // throws right here
            await task;                     // throws now
            """,
            log,
            "An async method never throws at the call site, not even for code before its first await: the exception is stored in the returned Task. It surfaces when someone awaits the task (or calls .Wait()/.Result). If nobody ever does, it is silently lost - the only trace is the TaskScheduler.UnobservedTaskException event when the task is garbage collected. Validate eagerly in a non-async wrapper if callers must fail fast.");
    }

    private static async Task<AsyncScenario> AwaitVersusWait()
    {
        List<string> log = [];
        var task = Task.FromException<int>(new InvalidOperationException("boom"));

        await Record(log, "await task", async () => await task);
        await Record(log, "task.Wait()", () => { task.Wait(); return Task.CompletedTask; });
        await Record(log, "task.Result", () => { _ = task.Result; return Task.CompletedTask; });
        await Record(log, "task.GetAwaiter().GetResult()", () => { task.GetAwaiter().GetResult(); return Task.CompletedTask; });

        return new AsyncScenario(
            "await-vs-wait",
            "await vs .Wait() and .Result",
            """
            // Already failed, so blocking returns at once
            var task = Task.FromException<int>(
                new InvalidOperationException("boom"));

            await task;                    // InvalidOperation
            task.Wait();                   // Aggregate
            _ = task.Result;               // Aggregate
            task.GetAwaiter().GetResult(); // InvalidOperation
            """,
            log,
            ".Wait() and .Result wrap the failure in an AggregateException, so catch (InvalidOperationException) misses it. await and GetAwaiter().GetResult() throw the original. On a task that is still running, .Wait() and .Result also block the thread - which deadlocks under a UI-style SynchronizationContext, and throws in the browser, where there is only one thread. Prefer await all the way up.");
    }

    private static async Task<AsyncScenario> WhenAll()
    {
        List<string> log = [];
        var all = Task.WhenAll(
            Scenarios.FailAsync(new InvalidOperationException("first failure")),
            Scenarios.FailAsync(new TimeoutException("second failure")));

        try
        {
            await all;
        }
        catch (Exception exception)
        {
            log.Add($"await all threw only {exception.GetType().Name}: \"{exception.Message}\"");
        }

        var inner = all.Exception!.InnerExceptions;
        log.Add($"all.Exception.InnerExceptions holds {inner.Count}: {string.Join(", ", inner.Select(e => $"{e.GetType().Name} \"{e.Message}\""))}");

        return new AsyncScenario(
            "when-all",
            "Task.WhenAll with two failures",
            """
            async Task FailAsync(Exception exception)
            {
                await Task.Yield();
                throw exception;
            }

            var all = Task.WhenAll(
                FailAsync(new InvalidOperationException("first failure")),
                FailAsync(new TimeoutException("second failure")));

            try { await all; }
            catch (Exception e) { } // InvalidOperation only

            all.Exception!.InnerExceptions; // both
            """,
            log,
            "await rethrows only the first exception, so a catch block sees one failure. The others are not lost - they are still in all.Exception.InnerExceptions - but nothing reads them unless you do. Log that collection when every failure matters.");
    }

    private static async Task<AsyncScenario> AsyncVoid()
    {
        List<string> log = [];
        var context = new RecordingContext(log);
        var previous = SynchronizationContext.Current;
        SynchronizationContext.SetSynchronizationContext(context);
        try
        {
            try
            {
                Scenarios.FireAndForget();
                log.Add("FireAndForget() returned to the caller. Its catch block will never run");
            }
            catch (InvalidOperationException)
            {
                log.Add("The caller caught the exception");
            }
        }
        finally
        {
            SynchronizationContext.SetSynchronizationContext(previous);
        }

        context.RunPending();

        var task = Scenarios.FireAndReturnAsync();
        log.Add($"FireAndReturnAsync() returned a Task (Status = {task.Status})");
        try
        {
            await task;
        }
        catch (InvalidOperationException exception)
        {
            log.Add($"await task threw {exception.GetType().Name} into the caller's catch block");
        }

        return new AsyncScenario(
            "async-void",
            "async void vs async Task",
            """
            async void FireAndForget()
            {
                await Task.Yield();
                throw new InvalidOperationException("from async void");
            }

            async Task FireAndReturnAsync()
            {
                await Task.Yield();
                throw new InvalidOperationException("from async Task");
            }

            try { FireAndForget(); }
            catch (InvalidOperationException) { } // never runs

            var task = FireAndReturnAsync(); // stored in task
            try { await task; }
            catch (InvalidOperationException) { } // runs
            """,
            log,
            "Callback #1 is the rest of FireAndForget after await Task.Yield(). It throws, and since async void has no Task to store the exception in, the method's builder posts callback #2, which rethrows it on the context. That is the SynchronizationContext to the SynchronizationContext current when the method was called - in a desktop UI that is the UI thread, where it crashes the app; with no context it is thrown on a thread pool thread, which crashes the process. This page installs a recording context to catch it instead. Use async void only for event handlers, and wrap their body in try/catch.");
    }

    private static async Task<AsyncScenario> Cancellation()
    {
        List<string> log = [];
        using var source = new CancellationTokenSource();
        source.Cancel();
        var token = source.Token;

        var task = Scenarios.WorkAsync(token);
        log.Add($"WorkAsync(token) returned while suspended at await Task.Yield(). task.Status = {task.Status}");
        try
        {
            await task;
        }
        catch (OperationCanceledException exception) when (exception.CancellationToken == token)
        {
            log.Add($"await task threw {exception.GetType().Name}, and the when filter matched our token");
        }

        log.Add($"task.Status = {task.Status}, task.IsFaulted = {task.IsFaulted}, task.Exception is {(task.Exception is null ? "null" : "set")}");

        return new AsyncScenario(
            "cancellation",
            "Cancellation is not a failure",
            """
            async Task WorkAsync(CancellationToken token)
            {
                await Task.Yield();
                token.ThrowIfCancellationRequested();
            }

            var task = WorkAsync(token); // token is cancelled
            try { await task; } // throws OperationCanceled
            catch (OperationCanceledException e)
                when (e.CancellationToken == token) { }

            task.Status; // Canceled, not Faulted
            """,
            log,
            "An OperationCanceledException that escapes an async method puts the Task in the Canceled state, not Faulted, and task.Exception stays null. await still throws, so catch it separately from real errors - and check e.CancellationToken: a cancellation from a token you did not cancel (an HttpClient timeout, for example) is a real failure.");
    }

    private static async Task Record(List<string> log, string expression, Func<Task> action)
    {
        try
        {
            await action();
            log.Add($"{expression} completed without throwing");
        }
        catch (Exception exception)
        {
            var inner = exception is AggregateException aggregate
                ? $" wrapping {string.Join(", ", aggregate.InnerExceptions.Select(e => e.GetType().Name))}"
                : string.Empty;
            log.Add($"{expression} threw {exception.GetType().Name}{inner}");
        }
    }

    private static List<string> Lines(string text) =>
        [.. text.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(line => line.StartsWith("at ", StringComparison.Ordinal) ? line[3..] : line)
            .Where(line => !line.StartsWith("---", StringComparison.Ordinal))
            .TakeWhile(line => !line.Contains(nameof(AsyncExplainer) + ".", StringComparison.Ordinal) && !line.Contains(nameof(RuntimeAsyncCompiled) + ".", StringComparison.Ordinal))
            .Select(line => line.Split(" in ")[0].Replace(typeof(AsyncExplainer).Namespace + ".", string.Empty, StringComparison.Ordinal))];

    private static class Scenarios
    {
        public static async Task ValidateAsync(string? name)
        {
            ArgumentNullException.ThrowIfNull(name);
            await SaveAsync(name);
        }

        public static Task ValidateEager(string? name)
        {
            ArgumentNullException.ThrowIfNull(name);
            return SaveAsync(name);
        }

        private static async Task SaveAsync(string name) => await Task.Yield();

        public static async Task FailAsync(Exception exception)
        {
            await Task.Yield();
            throw exception;
        }

        public static async void FireAndForget()
        {
            await Task.Yield();
            throw new InvalidOperationException("from async void");
        }

        public static async Task FireAndReturnAsync()
        {
            await Task.Yield();
            throw new InvalidOperationException("from async Task");
        }

        public static async Task WorkAsync(CancellationToken token)
        {
            await Task.Yield();
            token.ThrowIfCancellationRequested();
        }
    }

    /// <summary>
    /// A minimal UI-style message loop: posted callbacks queue up and run one by one on the
    /// thread that pumps them, like a WinForms or WPF dispatcher. Each runs under a catch,
    /// because left alone the rethrown exception would take the .NET runtime in the browser down.
    /// </summary>
    private sealed class RecordingContext(List<string> log) : SynchronizationContext
    {
        private readonly Queue<(int Number, SendOrPostCallback Callback, object? State)> queue = new();
        private int posted;

        public override void OperationStarted() => log.Add("SynchronizationContext.OperationStarted(): the async void method registered with the context");

        public override void OperationCompleted() => log.Add("SynchronizationContext.OperationCompleted(): the async void method has finished");

        public override void Post(SendOrPostCallback d, object? state)
        {
            posted++;
            log.Add($"SynchronizationContext.Post(): callback #{posted} queued on the context");
            queue.Enqueue((posted, d, state));
        }

        public void RunPending()
        {
            var previous = Current;
            SetSynchronizationContext(this);
            try
            {
                while (queue.TryDequeue(out var item))
                {
                    log.Add($"The context runs callback #{item.Number}");
                    try
                    {
                        item.Callback(item.State);
                    }
                    catch (Exception exception)
                    {
                        log.Add($"Callback #{item.Number} threw {exception.GetType().Name}: \"{exception.Message}\" on the context. Only this page's context caught it - a real one would crash the app");
                    }
                }
            }
            finally
            {
                SetSynchronizationContext(previous);
            }
        }
    }
}
