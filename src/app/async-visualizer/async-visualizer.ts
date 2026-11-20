import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DOCUMENT, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { CodeBlockComponent } from '../shared/code-block/code-block.component';
import { DotnetRuntimeService, invokeWasm } from '../services/dotnet-runtime.service';
import { StepCodeComponent, type CodeMarker } from './step-code';
import { ThreadTimelineComponent, type ThreadTimeline, type TimelineSegment } from './thread-timeline';

/** Mirrors `dotnet/Toolbox.Wasm.Core/Async/AsyncContracts.cs`, pinned by `AsyncExplainerTests`. */
export interface AsyncMethodShape {
  signature: string;
  classicStateMachine: string | null;
  /** Null means the method is flagged `MethodImplOptions.Async` instead. */
  runtimeAsyncStateMachine: string | null;
}

export interface AsyncScenario {
  id: string;
  title: string;
  code: string;
  log: string[];
  takeaway: string;
}

export interface AsyncExplanation {
  /** Why the running runtime refused runtime-async code; null if it ran it. */
  runtimeAsyncError: string | null;
  shapes: AsyncMethodShape[];
  classicStack: string[];
  runtimeAsyncStack: string[];
  exceptionStack: string[];
  scenarios: AsyncScenario[];
}

/** Pinned by `AsyncExplainerTests`, which runs the same probe on CoreCLR. */
const CORECLR_RUNTIME_ASYNC_STACK = ['StackProbe.InnerAsync()', 'StackProbe.MiddleAsync()', 'StackProbe.OuterAsync()'];

/** Simplified views of `TimelineProbe.cs`: same delays, same order, minus the recording. */
const AWAITING_CODE = `async Task WorkAsync(int[] waits)
{
    foreach (var wait in waits)
    {
        DoWork(8);              // holds the thread
        await Task.Delay(wait); // holds nothing
    }
    DoWork(8);
}

await Task.WhenAll(
    WorkAsync([120, 60]),  // A
    WorkAsync([40, 100]),  // B
    WorkAsync([80, 40]));  // C`;

const BLOCKING_CODE = AWAITING_CODE.replace(
  'await Task.Delay(wait); // holds nothing',
  'Thread.Sleep(wait);     // holds the thread'
);

function whenVisible(document: Document): Promise<void> {
  if (!document.hidden) {
    return Promise.resolve();
  }
  return new Promise(resolve =>
    document.addEventListener('visibilitychange', function onChange() {
      if (!document.hidden) {
        document.removeEventListener('visibilitychange', onChange);
        resolve();
      }
    })
  );
}

const TASK_ARROW_COLORS: Record<string, string> = { A: 'text-sky-400', B: 'text-violet-400', C: 'text-emerald-400' };

/**
 * Where the playback is in the code: the line the current task is executing, plus the call
 * that started that task. Found by text so the mapping cannot drift from the snippet.
 */
export function markersFor(segment: TimelineSegment | undefined, code: string): CodeMarker[] {
  if (!segment) {
    return [];
  }
  const lines = code.split('\n');
  const work = lines.flatMap((line, index) => (line.includes('DoWork(8);') ? [index] : []));
  const body =
    segment.kind === 'wait'
      ? lines.findIndex(line => line.includes('await Task.Delay(wait)'))
      : segment.kind === 'block'
        ? lines.findIndex(line => line.includes('Thread.Sleep(wait)'))
        : segment.label === 'resumes, finishes'
          ? work[work.length - 1]
          : work[0];
  const call = lines.findIndex(line => line.includes(`// ${segment.task}`));
  const color = TASK_ARROW_COLORS[segment.task] ?? 'text-gray-400';
  return [
    { line: body, color, label: segment.task },
    { line: call, color, label: segment.task },
  ];
}

const CHAPTERS = [
  { id: 'chapter-1', title: '1. Task ≠ Thread' },
  { id: 'chapter-2', title: '2. What it compiles to' },
  { id: 'chapter-3', title: '3. Call stacks' },
  { id: 'chapter-4', title: '4. Exceptions' },
  { id: 'chapter-5', title: 'Rules' },
];

const DOCS_URL = 'https://learn.microsoft.com/en-us/dotnet/core/whats-new/dotnet-11/runtime#runtime-async';

/**
 * Explains async/await by running it: the method shapes are read from the shipped IL,
 * and every exception scenario executes in the real runtime. No JavaScript fallback,
 * for the same reason as the LINQ Visualizer - approximating .NET semantics would teach
 * something false.
 */
@Component({
  selector: 'app-async-visualizer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CodeBlockComponent, DecimalPipe, NgTemplateOutlet, StepCodeComponent, ThreadTimelineComponent],
  styles: `
    .ic {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.75rem;
      background: rgb(0 0 0 / 0.06);
      padding: 0 0.25rem;
      border-radius: 0.25rem;
    }
  `,
  template: `
    <ng-template #next let-target let-question="question" let-title="title">
      <div class="mt-5 pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p class="text-sm text-gray-600 italic">{{ question }}</p>
        <button
          type="button"
          class="shrink-0 px-3 py-1.5 text-xs rounded-lg bg-brand-primary text-white hover:opacity-90 transition-opacity"
          (click)="scrollTo(target)"
        >
          Next: {{ title }} →
        </button>
      </div>
    </ng-template>

    <div class="max-w-7xl mx-auto p-4 md:p-6">
      <div class="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-1">Async/Await Explained</h1>
          <p class="text-sm text-gray-600 max-w-2xl">
            What the compiler and the runtime make of <code class="font-mono text-xs bg-gray-100 px-1 rounded">async</code>,
            and where exceptions really go. Everything below was read or executed by the .NET runtime in your browser just now, unless marked otherwise.
          </p>
        </div>
        @if (framework(); as version) {
          <span
            class="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-medium text-blue-800"
            title="Reported by the runtime itself, not baked in at build time"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-brand-primary"></span>
            {{ version }}
          </span>
        }
      </div>

      @if (unavailable()) {
        <div class="bg-red-50 border-l-4 border-red-500 rounded-lg shadow-sm p-4">
          <h2 class="font-semibold text-red-900 mb-1">The .NET runtime could not be loaded.</h2>
          <p class="text-sm text-red-800">
            This page has no JavaScript fallback on purpose - it exists to show real .NET behaviour. Check your connection and reload.
          </p>
          @if (failureReason(); as reason) {
            <p class="mt-2 font-mono text-xs text-red-700">{{ reason }}</p>
          }
        </div>
      } @else if (explanation.hasValue()) {
        @let run = explanation.value();

        <!-- Primer -->
        <section class="rounded-2xl bg-blue-50 ring-1 ring-blue-100 px-5 py-4 mb-4 text-sm text-blue-900 leading-relaxed">
          <h2 class="font-semibold mb-1">The short version</h2>
          <p>
            An <code class="ic">async</code> method can pause at an <code class="ic">await</code> and resume later, but the CPU has no
            notion of "pause". Something has to remember where the method was and what its local variables held, then call back
            into it. For years the C# compiler did that by rewriting your method into a hidden class called a
            <strong>state machine</strong>. .NET 11 can let the runtime do it instead - that is <strong>runtime async</strong>.
          </p>
          <p class="mt-2">
            You rarely see either directly, but they decide what your call stacks look like while debugging and where an exception
            ends up when an async method fails. First, though, the most common misconception: that a Task is a thread.
          </p>
          <nav class="flex flex-wrap gap-1.5 mt-3" aria-label="Chapters">
            @for (chapter of chapters; track chapter.id) {
              <button
                type="button"
                class="px-2.5 py-1 rounded-full bg-white ring-1 ring-blue-200 text-xs text-blue-900 hover:bg-blue-100 transition-colors"
                (click)="scrollTo(chapter.id)"
              >
                {{ chapter.title }}
              </button>
            }
          </nav>
        </section>

        <!-- Task != Thread -->
        <section id="chapter-1" class="scroll-mt-4 bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 overflow-hidden mb-4">
          <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <h2 class="font-semibold text-sm text-gray-700">1. A Task is not a Thread</h2>
          </div>
          <div class="p-4 text-sm text-gray-700 leading-relaxed">
            <p class="mb-3">
              A <code class="ic">Task</code> is a promise of a result, not a worker. While it awaits, it holds
              <strong>no thread at all</strong>: the thread goes off and runs something else, and the method is resumed later by
              whichever thread is free. Your browser has exactly one .NET thread, which makes this easy to see. Run three tasks on
              it, then switch to blocking and run them again:
            </p>

            <div class="flex flex-wrap items-center gap-2 mb-4">
              <div class="inline-flex rounded-lg border border-gray-300 overflow-hidden text-xs" role="radiogroup" aria-label="How each task waits">
                <button
                  type="button"
                  role="radio"
                  [attr.aria-checked]="!blocking()"
                  class="px-3 py-1.5 transition-colors"
                  [class]="!blocking() ? 'bg-brand-primary text-white font-medium' : 'text-gray-700 hover:bg-gray-50'"
                  (click)="blocking.set(false)"
                >
                  await Task.Delay
                </button>
                <button
                  type="button"
                  role="radio"
                  [attr.aria-checked]="blocking()"
                  class="px-3 py-1.5 border-l border-gray-300 transition-colors"
                  [class]="blocking() ? 'bg-amber-600 text-white font-medium' : 'text-gray-700 hover:bg-gray-50'"
                  (click)="blocking.set(true)"
                >
                  Thread.Sleep (blocking)
                </button>
              </div>
              <button
                type="button"
                class="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
                [disabled]="timelineResource.isLoading()"
                (click)="timelineResource.reload()"
              >
                {{ timelineResource.isLoading() ? 'Running…' : 'Run again' }}
              </button>
            </div>

            @if (timeline(); as t) {
              <div class="grid gap-4 lg:grid-cols-2 items-start mb-4">
                <app-step-code [code]="timelineCode()" [markers]="codeMarkers()" />
                <div class="rounded-xl px-4 py-3" [class]="blocking() ? 'bg-amber-50 ring-1 ring-amber-200 text-amber-950' : 'bg-blue-50 ring-1 ring-blue-200 text-blue-950'">
                  <p class="text-2xl font-bold">
                    {{ taskCount(t) }} tasks, {{ t.threadCount }} thread{{ t.threadCount === 1 ? '' : 's' }}, {{ t.totalMs | number: '1.0-0' }} ms
                  </p>
                  @if (blocking()) {
                    <p class="mt-1">
                      The thread was never free. Each <code class="ic">Thread.Sleep</code> held it, so task B could not even start until
                      A had finished, and C waited for both. Same work, same waits - but nothing overlaps.
                    </p>
                  } @else {
                    <p class="mt-1">
                      The thread did {{ busyMs(t) | number: '1.0-0' }} ms of work. The rest of the time every task was waiting and no
                      thread was used at all - so all three waits overlapped.
                    </p>
                  }
                  @if (totals().awaiting && totals().blocking) {
                    <p class="mt-2 font-medium">
                      await: {{ totals().awaiting | number: '1.0-0' }} ms vs blocking: {{ totals().blocking | number: '1.0-0' }} ms.
                    </p>
                  } @else {
                    <p class="mt-2 text-xs opacity-80">Press play below to step through it, then try the other mode.</p>
                  }
                </div>
              </div>
              <app-thread-timeline [timeline]="t" (currentChange)="currentSegment.set($event)" />
            } @else {
              <p class="text-gray-500">Running the tasks…</p>
            }

            <p class="text-xs text-gray-500 mt-3">
              @if (blocking()) {
                The browser cannot put its only thread to sleep, so this page spins for the same time instead - to the thread, being
                stuck is being stuck.
              }
              On a server, an awaiting task resumes on whichever thread-pool thread is free, so it can start on thread #4 and finish on
              thread #9. It owns none of them, and while it waits it holds none - that is how a few threads serve thousands of requests.
              Blocking calls (<code class="font-mono">Thread.Sleep</code>, <code class="font-mono">.Result</code>,
              <code class="font-mono">.Wait()</code>) undo that, one stuck thread per waiting request.
            </p>
            <ng-container *ngTemplateOutlet="next; context: { $implicit: 'chapter-2', question: 'If no thread holds a paused method, where do its local variables live while it waits?', title: '2. What your async method compiles to' }" />
          </div>
        </section>

        <!-- Shapes -->
        <section id="chapter-2" class="scroll-mt-4 bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 overflow-hidden mb-4">
          <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <h2 class="font-semibold text-sm text-gray-700">2. What your async method compiles to</h2>
          </div>
          <div class="p-4 text-sm text-gray-700 leading-relaxed">
            <p class="mb-3">
              <strong>Classic:</strong> the compiler moves your method body into a generated state machine type. Locals become fields,
              each <code class="ic">await</code> becomes a numbered state, and a <code class="ic">MoveNext()</code> method jumps back to
              the right state when the awaited work finishes.
              <strong>Runtime async</strong> (.NET 11, opt-in with
              <code class="ic">&lt;Features&gt;runtime-async=on&lt;/Features&gt;</code> in the project file): the method stays as you
              wrote it, marked with the <code class="ic">MethodImplOptions.Async</code> flag, and the runtime saves and restores it at
              each <code class="ic">await</code> itself.
            </p>
            <p class="mb-3">
              This page contains the same five methods compiled both ways. The table is read from the compiled code - the IL, .NET's
              bytecode - that your browser just downloaded:
            </p>
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="text-left text-xs text-gray-500 border-b border-gray-200">
                    <th class="py-2 pr-4 font-medium">Method</th>
                    <th class="py-2 pr-4 font-medium">Classic: generated state machine</th>
                    <th class="py-2 font-medium">With runtime async</th>
                  </tr>
                </thead>
                <tbody>
                  @for (shape of run.shapes; track shape.signature) {
                    <tr class="border-b border-gray-100 last:border-0">
                      <td class="py-2 pr-4 font-mono text-xs text-gray-900 whitespace-nowrap">{{ shape.signature }}</td>
                      <td class="py-2 pr-4">
                        <span class="inline-block px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 ring-1 ring-amber-200 text-xs font-mono whitespace-nowrap">{{ shape.classicStateMachine }}</span>
                      </td>
                      <td class="py-2">
                        @if (shape.runtimeAsyncStateMachine; as stateMachine) {
                          <span class="inline-block px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 ring-1 ring-amber-200 text-xs whitespace-nowrap">still <span class="font-mono">{{ stateMachine }}</span></span>
                        } @else {
                          <span class="inline-block px-2 py-0.5 rounded-full bg-green-50 text-green-800 ring-1 ring-green-200 text-xs whitespace-nowrap">no state machine - the runtime handles it</span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <p class="text-xs text-gray-500 mt-2">
              <code class="font-mono">&lt;SaveAsync&gt;d__0</code> is the name the compiler gives the generated type; the angle brackets
              make it impossible to write in C#, so it never clashes with your names. This page is a Release build, where it is a struct
              that only gets copied to the heap the first time an <code class="font-mono">await</code> really has to wait.
            </p>

            <p class="mt-3">
              <strong>async void still gets a state machine.</strong> In .NET 11 the runtime only takes over methods that return
              <code class="ic">Task</code>, <code class="ic">Task&lt;T&gt;</code>, <code class="ic">ValueTask</code> or
              <code class="ic">ValueTask&lt;T&gt;</code>. An async void method stays on the compiler's
              <code class="ic">AsyncVoidMethodBuilder</code> - and, as section 4 shows, it has no Task to put an exception into either.
              Async iterators (<code class="ic">IAsyncEnumerable&lt;T&gt;</code>) also keep their compiler-generated state machine.
            </p>
            <p class="mt-3">
              <strong>Why bother?</strong> No generated type per method, fewer allocations (the runtime reuses continuation objects and
              does not save locals that did not change), and the debugger can step across an <code class="ic">await</code> without
              landing in generated code. See
              <a class="underline text-brand-primary" [href]="docsUrl" target="_blank" rel="noopener">What's new in .NET 11</a>.
            </p>

            @if (run.runtimeAsyncError; as error) {
              <div class="mt-4 rounded-xl bg-amber-50 ring-1 ring-amber-200 px-4 py-3 text-amber-900">
                <p>
                  <strong>Your browser compiled the right-hand column but cannot run it.</strong> .NET in the browser uses the Mono
                  runtime, and calling one of those methods just now failed with:
                </p>
                <p class="font-mono text-xs my-2">{{ error }}</p>
                <p>
                  Runtime async runs on CoreCLR - the runtime behind ASP.NET Core, console and desktop apps - so this is what your server
                  code gets. Everything this page executes uses classic state machines; sections 3 and 4 say where that matters.
                </p>
              </div>
            }
            <ng-container *ngTemplateOutlet="next; context: { $implicit: 'chapter-3', question: 'That generated machinery is invisible in your code - but not in your debugger.', title: '3. What the call stack looks like' }" />
          </div>
        </section>

        <!-- Stacks -->
        <section id="chapter-3" class="scroll-mt-4 bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 overflow-hidden mb-4">
          <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <h2 class="font-semibold text-sm text-gray-700">3. What the call stack looks like</h2>
          </div>
          <div class="p-4 text-sm text-gray-700 leading-relaxed">
            <p class="mb-3">
              <code class="ic">OuterAsync</code> awaits <code class="ic">MiddleAsync</code>, which awaits <code class="ic">InnerAsync</code>,
              which captures <code class="ic">new StackTrace()</code> - the stack a debugger or profiler would show you at that line.
              It is captured before any <code class="ic">await</code> has to wait; after a real pause, the stack starts at whatever
              resumed the method instead.
            </p>
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <h3 class="font-medium text-gray-900 mb-2">Classic state machines <span class="font-normal text-gray-500">- {{ run.classicStack.length }} frames</span></h3>
                <ol class="font-mono text-xs bg-gray-900 text-gray-100 rounded-lg p-3 space-y-1">
                  @for (frame of run.classicStack; track $index) {
                    <li class="break-all" [class.text-amber-300]="isPlumbing(frame)">{{ shortFrame(frame) }}</li>
                  }
                </ol>
                <p class="text-xs text-gray-500 mt-2">
                  <span class="text-amber-700 font-medium">Amber</span> frames are generated plumbing, not code you wrote.
                </p>
              </div>
              <div>
                <h3 class="font-medium text-gray-900 mb-2">Runtime async <span class="font-normal text-gray-500">- {{ runtimeAsyncStack(run).length }} frames</span></h3>
                <ol class="font-mono text-xs bg-gray-900 text-gray-100 rounded-lg p-3 space-y-1">
                  @for (frame of runtimeAsyncStack(run); track $index) {
                    <li class="break-all">{{ shortFrame(frame) }}</li>
                  }
                </ol>
                <p class="text-xs text-gray-500 mt-2">
                  @if (run.runtimeAsyncError) {
                    <span class="inline-block px-1.5 rounded bg-gray-100 text-gray-700 ring-1 ring-gray-300">not run here</span>
                    Your browser cannot run runtime async, so this is the same probe's output on .NET 11 CoreCLR, checked by this
                    project's tests.
                  } @else {
                    Measured just now: only your own methods.
                  }
                </p>
              </div>
            </div>
            <h3 class="font-medium text-gray-900 mt-4 mb-2">An exception's stack trace, thrown two awaits deep</h3>
            <ol class="font-mono text-xs bg-gray-900 text-gray-100 rounded-lg p-3 space-y-1">
              @for (frame of run.exceptionStack; track $index) {
                <li class="break-all">{{ shortFrame(frame) }}</li>
              }
            </ol>
            <p class="text-xs text-gray-500 mt-2">
              <code class="font-mono">exception.StackTrace</code> already hides the plumbing, so logged exceptions read the same with or
              without runtime async. The difference shows up in debuggers, profilers and <code class="font-mono">new StackTrace()</code>.
            </p>
            <ng-container *ngTemplateOutlet="next; context: { $implicit: 'chapter-4', question: 'An async method can return to its caller before it has finished. So when it fails later, who gets the exception?', title: '4. Where exceptions go' }" />
          </div>
        </section>

        <!-- Exceptions -->
        <section id="chapter-4" class="scroll-mt-4 bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 overflow-hidden mb-4">
          <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <h2 class="font-semibold text-sm text-gray-700">4. Where exceptions go</h2>
          </div>
          <div class="p-4">
            <p class="text-sm text-gray-700 mb-3">
              Each scenario's code just ran in your browser, including real pauses at <code class="ic">await Task.Yield()</code>.
              The numbered list is what .NET reported, in order.
            </p>
            <div class="flex flex-wrap gap-1 mb-4" role="tablist">
              @for (scenario of run.scenarios; track scenario.id) {
                <button
                  type="button"
                  role="tab"
                  [attr.aria-selected]="scenario.id === selected()?.id"
                  class="px-3 py-1 text-xs rounded-md border transition-colors"
                  [class]="
                    scenario.id === selected()?.id
                      ? 'border-brand-primary bg-blue-50 text-brand-primary font-medium'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  "
                  (click)="selectedId.set(scenario.id)"
                >
                  {{ scenario.title }}
                </button>
              }
            </div>

            @if (selected(); as scenario) {
              <div class="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
                <app-code-block [code]="scenario.code" />
                <div>
                  <h3 class="text-sm font-medium text-gray-900 mb-2">What .NET reported</h3>
                  <ol class="space-y-1.5 mb-4">
                    @for (line of scenario.log; track $index) {
                      <li class="flex gap-2 text-sm text-gray-800">
                        <span class="shrink-0 w-5 h-5 rounded-full bg-gray-100 text-gray-600 text-xs flex items-center justify-center">{{ $index + 1 }}</span>
                        <span class="font-mono text-xs leading-5">{{ line }}</span>
                      </li>
                    }
                  </ol>
                  <div class="rounded-xl bg-blue-50 ring-1 ring-blue-200 px-4 py-3">
                    <p class="text-sm text-blue-950 leading-relaxed">{{ scenario.takeaway }}</p>
                  </div>
                </div>
              </div>
            }
            <ng-container *ngTemplateOutlet="next; context: { $implicit: 'chapter-5', question: 'All of that boils down to a handful of habits.', title: 'Rules to take away' }" />
          </div>
        </section>

        <!-- Rules -->
        <section id="chapter-5" class="scroll-mt-4 rounded-2xl bg-green-50 ring-1 ring-green-200 px-5 py-4 text-sm text-green-950 leading-relaxed">
          <h2 class="font-semibold mb-2">Rules to take away</h2>
          <ul class="list-disc pl-5 space-y-1">
            <li>Return <code class="ic">Task</code>, never <code class="ic">void</code>, unless the method is an event handler - and then wrap its body in try/catch.</li>
            <li>Always await (or otherwise observe) the tasks you start. An exception in a task nobody looks at is silently lost.</li>
            <li>Use <code class="ic">await</code> instead of <code class="ic">.Result</code> or <code class="ic">.Wait()</code>: no <code class="ic">AggregateException</code> wrapper, and no deadlock from blocking a thread that the awaited work needs.</li>
            <li>In library code, <code class="ic">ConfigureAwait(false)</code> stops continuations queuing onto the caller's <code class="ic">SynchronizationContext</code>. ASP.NET Core has none, so it changes nothing there.</li>
            <li>After <code class="ic">Task.WhenAll</code>, read <code class="ic">task.Exception.InnerExceptions</code> when every failure matters.</li>
            <li>Catch <code class="ic">OperationCanceledException</code> separately, and filter on its <code class="ic">CancellationToken</code> so a timeout is not mistaken for a cancellation you asked for.</li>
            <li>Validate arguments in a non-async wrapper when callers should fail at the call, not at the await.</li>
          </ul>
        </section>
      } @else {
        <div class="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 p-12 text-center">
          <p class="text-sm text-gray-500">Loading the .NET runtime…</p>
        </div>
      }
    </div>
  `,
})
export class AsyncVisualizerComponent {
  private readonly runtime = inject(DotnetRuntimeService);

  protected readonly docsUrl = DOCS_URL;
  protected readonly timelineCode = computed(() => (this.blocking() ? BLOCKING_CODE : AWAITING_CODE));
  protected readonly currentSegment = signal<TimelineSegment | undefined>(undefined);
  protected readonly codeMarkers = computed(() => markersFor(this.currentSegment(), this.timelineCode()));
  protected readonly chapters = CHAPTERS;

  protected readonly blocking = signal(false);
  protected readonly totals = signal<{ awaiting?: number; blocking?: number }>({});

  protected readonly explanation = resource({
    loader: () => invokeWasm<AsyncExplanation>(this.runtime, wasm => wasm.AsyncInterop.Explain()),
  });

  private readonly document = inject(DOCUMENT);

  /**
   * Waits for the explanation so the two do not share the browser's single thread, and for
   * the tab to be visible: hidden tabs throttle timers to about once a second, which would
   * turn a 40 ms delay into a 1000 ms one and make the chart describe the browser, not .NET.
   */
  protected readonly timelineResource = resource({
    params: () => (this.explanation.hasValue() ? { blocking: this.blocking() } : undefined),
    loader: async ({ params }) => {
      await whenVisible(this.document);
      const timeline = await invokeWasm<ThreadTimeline>(this.runtime, wasm => wasm.AsyncInterop.RunTimeline(params.blocking));
      this.totals.update(totals => ({ ...totals, [params.blocking ? 'blocking' : 'awaiting']: timeline.totalMs }));
      return timeline;
    },
  });

  /** Keeps the previous chart up while the next run is in flight, so switching modes does not make the page jump. */
  protected readonly timeline = linkedSignal<ThreadTimeline | undefined, ThreadTimeline | undefined>({
    source: () => (this.timelineResource.hasValue() ? this.timelineResource.value() : undefined),
    computation: (next, previous) => next ?? previous?.value,
  });
  protected readonly framework = this.runtime.frameworkDescription;


  protected readonly unavailable = computed(
    () => this.runtime.status() === 'failed' || this.explanation.error() !== undefined
  );

  protected readonly failureReason = computed(
    () => this.runtime.failure() ?? this.explanation.error()?.message ?? null
  );

  protected readonly selectedId = signal<string | null>(null);

  protected readonly selected = computed(() => {
    if (!this.explanation.hasValue()) {
      return undefined;
    }
    const scenarios = this.explanation.value().scenarios;
    return scenarios.find(s => s.id === this.selectedId()) ?? scenarios[0];
  });

  protected isPlumbing(frame: string): boolean {
    return frame.startsWith('System.Runtime.CompilerServices.') || frame.includes('MoveNext');
  }

  /** Mono spells out generic arguments that CoreCLR abbreviates; the namespace and argument list add nothing at this size. */
  protected shortFrame(frame: string): string {
    return frame.replace('System.Runtime.CompilerServices.', '').replace(/\(.*&\)$/, '(...)');
  }

  protected scrollTo(id: string): void {
    this.document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected taskCount(timeline: ThreadTimeline): number {
    return new Set(timeline.segments.map(segment => segment.task)).size;
  }

  protected busyMs(timeline: ThreadTimeline): number {
    return timeline.segments
      .filter(segment => segment.kind === 'run')
      .reduce((sum, segment) => sum + segment.endMs - segment.startMs, 0);
  }

  protected runtimeAsyncStack(run: AsyncExplanation): string[] {
    return run.runtimeAsyncError ? CORECLR_RUNTIME_ASYNC_STACK : run.runtimeAsyncStack;
  }
}
