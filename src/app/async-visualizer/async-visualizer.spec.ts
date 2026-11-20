import { describe, it, expect, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AsyncVisualizerComponent, markersFor, type AsyncExplanation } from './async-visualizer';
import { DotnetRuntimeService, type ToolboxWasmExports } from '../services/dotnet-runtime.service';

describe('AsyncVisualizerComponent', () => {
  const EXPLANATION: AsyncExplanation = {
    runtimeAsyncError: 'PlatformNotSupportedException: Runtime Async is not supported on this platform.',
    shapes: [
      { signature: 'async Task SaveAsync()', classicStateMachine: '<SaveAsync>d__0 (struct)', runtimeAsyncStateMachine: null },
      { signature: 'async void OnClick()', classicStateMachine: '<OnClick>d__3 (struct)', runtimeAsyncStateMachine: '<OnClick>d__3 (struct)' },
    ],
    classicStack: ['StackProbe.InnerAsync()', 'System.Runtime.CompilerServices.AsyncMethodBuilderCore.Start[<InnerAsync>d__2](<InnerAsync>d__2&)'],
    runtimeAsyncStack: [],
    exceptionStack: ['StackProbe.ThrowInnerAsync()'],
    scenarios: [
      { id: 'a', title: 'First scenario', code: 'await task;', log: ['first log line'], takeaway: 'first takeaway' },
      { id: 'b', title: 'Second scenario', code: 'task.Wait();', log: ['second log line'], takeaway: 'second takeaway' },
    ],
  };

  const TIMELINE = {
    totalMs: 100,
    threadCount: 1,
    segments: [
      { task: 'A', kind: 'run', startMs: 0, endMs: 8, threadId: 1, label: 'starts' },
      { task: 'B', kind: 'run', startMs: 8, endMs: 16, threadId: 1, label: 'starts' },
      { task: 'A', kind: 'wait', startMs: 8, endMs: 90, threadId: null, label: 'await Task.Delay(80)' },
      { task: 'A', kind: 'run', startMs: 90, endMs: 98, threadId: 1, label: 'resumes, finishes' },
    ],
  };

  const create = async (): Promise<ComponentFixture<AsyncVisualizerComponent>> => {
    const exports = { Toolbox: { Wasm: { AsyncInterop: {
            Explain: () => Promise.resolve(JSON.stringify(EXPLANATION)),
            RunTimeline: (blocking: boolean) => Promise.resolve(JSON.stringify({ ...TIMELINE, totalMs: blocking ? 500 : 100 })),
          } } } };
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AsyncVisualizerComponent],
      providers: [
        {
          provide: DotnetRuntimeService,
          useValue: {
            status: () => 'ready',
            failure: () => null,
            frameworkDescription: () => '.NET 11.0.0',
            load: vi.fn(() => Promise.resolve(exports as unknown as ToolboxWasmExports)),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AsyncVisualizerComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  it('says the browser cannot run runtime async and labels the stack it shows instead', async () => {
    const text = (await create()).nativeElement.textContent as string;

    expect(text).toContain('Runtime Async is not supported on this platform.');
    expect(text).toContain('2 tasks, 1 thread, 100 ms');
    expect(text).toContain('did 24 ms of work');
    expect(text).toContain('Thread #1');
    expect(text).toContain('not run here');
    expect(text).toContain('still <OnClick>d__3 (struct)');
    expect(text).toContain('AsyncMethodBuilderCore.Start[<InnerAsync>d__2](...)');
  });

  it('compares awaiting with blocking once both have run', async () => {
    const fixture = await create();
    const element = fixture.nativeElement as HTMLElement;

    [...element.querySelectorAll<HTMLButtonElement>('[role=radio]')].find(r => r.textContent?.includes('Thread.Sleep'))?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element.textContent).toContain('Thread.Sleep(wait);     // holds the thread');
    expect(element.textContent).toContain('await: 100 ms vs blocking: 500 ms');
  });

  it('switches scenarios', async () => {
    const fixture = await create();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('first takeaway');

    [...element.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(tab => tab.textContent?.includes('Second'))?.click();
    fixture.detectChanges();

    expect(element.textContent).toContain('second log line');
    expect(element.textContent).not.toContain('first takeaway');
  });
});

describe('markersFor', () => {
  const code = `async Task WorkAsync(int[] waits)
{
    foreach (var wait in waits)
    {
        DoWork(8);
        await Task.Delay(wait);
    }
    DoWork(8);
}

await Task.WhenAll(
    WorkAsync([120, 60]),  // A
    WorkAsync([40, 100]),  // B`;
  const at = (kind: 'run' | 'wait', label: string, task = 'B'): number[] =>
    markersFor({ task, kind, startMs: 0, endMs: 1, threadId: kind === 'run' ? 1 : null, label }, code).map(m => m.line);

  it('points at the executing line and at the call that started the task', () => {
    expect(at('run', 'starts')).toEqual([4, 12]);
    expect(at('wait', 'await Task.Delay(40)')).toEqual([5, 12]);
    expect(at('run', 'resumes')).toEqual([4, 12]);
    expect(at('run', 'resumes, finishes', 'A')).toEqual([7, 11]);
  });
});
