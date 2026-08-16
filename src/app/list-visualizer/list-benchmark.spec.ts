import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ListBenchmarkComponent } from './list-benchmark';
import { ListBenchmarkResult, ListBenchmarkService } from '../services/list-benchmark.service';

/**
 * The behaviours that keep this tab honest: it never shows a number it did not get from
 * .NET, and it never leaves the user staring at a button that looks broken while the main
 * thread is blocked inside the runtime.
 */
describe('ListBenchmarkComponent', () => {
  const measurement = (overrides: Partial<ListBenchmarkResult> = {}): ListBenchmarkResult => ({
    runs: [
      {
        id: 'default',
        label: 'new List<int>()',
        code: 'var list = new List<int>();',
        bestElapsedMs: 0.5,
        medianElapsedMs: 0.6,
        allocatedBytes: 262_144,
        resizeCount: 11,
        finalCapacity: 16_384,
        growth: [{ atCount: 1, fromCapacity: 0, toCapacity: 4 }],
      },
      {
        id: 'preallocated',
        label: 'new List<int>(10000)',
        code: 'var list = new List<int>(10000);',
        bestElapsedMs: 0.2,
        medianElapsedMs: 0.25,
        allocatedBytes: 40_024,
        resizeCount: 0,
        finalCapacity: 10_000,
        growth: [],
      },
    ],
    adds: 10_000,
    capacity: 10_000,
    rounds: 5,
    runtimeNote: 'Measured by .NET 10.0.0 in your browser.',
    ...overrides,
  });

  let run: ReturnType<typeof vi.fn>;
  let prefetch: ReturnType<typeof vi.fn>;
  let status: ReturnType<typeof vi.fn>;

  const render = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ListBenchmarkService,
          useValue: { run, prefetch, runtimeStatus: status, runtimeFailure: () => null },
        },
      ],
    });

    const fixture = TestBed.createComponent(ListBenchmarkComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    run = vi.fn(() => Promise.resolve(measurement()));
    prefetch = vi.fn(() => Promise.resolve());
    status = vi.fn(() => 'ready');
  });

  it('starts the runtime download as soon as the tab is open, without measuring anything', () => {
    render();

    expect(prefetch).toHaveBeenCalledTimes(1);
    expect(run).not.toHaveBeenCalled();
  });

  it('shows no numbers before a run', () => {
    const text = render().nativeElement.textContent as string;

    expect(text).toContain('Press Run benchmark');
    expect(text).not.toContain('Observed growth');
  });

  it('renders the measured figures once a run completes', async () => {
    const fixture = render();

    (fixture.componentInstance as unknown as { runBenchmark(): Promise<void> }).runBenchmark();
    await vi.waitFor(() => expect(run).toHaveBeenCalled());
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('new List<int>(10000)');
    expect(text).toContain('Observed growth');
    // The zero-resize column is the whole point, so it has to actually reach the DOM.
    expect(text).toContain('The capacity never changed');
  });

  it('refuses to show numbers when the runtime failed, rather than inventing them', () => {
    status = vi.fn(() => 'failed');

    const text = render().nativeElement.textContent as string;
    expect(text).toContain('could not be loaded');
    expect(text).not.toContain('Press Run benchmark');
  });

  it('discards a result the runtime reported as an error', async () => {
    run = vi.fn(() => Promise.resolve(measurement({ error: 'something went wrong' })));

    const fixture = render();
    (fixture.componentInstance as unknown as { runBenchmark(): Promise<void> }).runBenchmark();
    await vi.waitFor(() => expect(run).toHaveBeenCalled());
    await fixture.whenStable();
    fixture.detectChanges();

    // Stale or partial numbers next to the user's chosen inputs would read as a real answer.
    expect(fixture.nativeElement.textContent as string).toContain('Press Run benchmark');
  });

  it('survives the runtime throwing mid-run', async () => {
    run = vi.fn(() => Promise.reject(new Error('runtime died')));

    const fixture = render();
    await (
      fixture.componentInstance as unknown as { runBenchmark(): Promise<void> }
    ).runBenchmark();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent as string).toContain('Press Run benchmark');
  });

  it('formats byte counts at the scale they arrive in', () => {
    const component = render().componentInstance as unknown as {
      formatBytes(bytes: number): string;
    };

    expect(component.formatBytes(512)).toBe('512 B');
    expect(component.formatBytes(40_024)).toBe('39.1 KB');
    expect(component.formatBytes(4_194_304)).toBe('4.00 MB');
  });
});
