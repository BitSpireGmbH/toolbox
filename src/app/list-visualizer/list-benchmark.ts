import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CodeBlockComponent } from '../shared/code-block/code-block.component';
import { ListBenchmarkResult, ListBenchmarkService } from '../services/list-benchmark.service';

/**
 * The measured half of the List&lt;T&gt; Visualizer.
 *
 * The visualizer tab animates the allocate -> copy -> add -> discard cycle, but every number
 * in it is a TypeScript simulation with invented addresses, and it closes by asserting that
 * preallocating "can improve performance". This tab runs that comparison on the real .NET
 * runtime in the browser and reports what actually happened - the same move
 * `AllocationProbe` made for the Span&lt;T&gt; page.
 *
 * Split out of `list-visualizer.ts` rather than inlined: that file is already 550 lines of
 * mostly template, and the benchmark shares none of its state. `linq-visualizer/` splits the
 * same way.
 */
@Component({
  selector: 'app-list-benchmark',
  imports: [FormsModule, CodeBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- What this tab is -->
      <div class="bg-emerald-50 border-l-4 border-emerald-500 rounded-lg p-4">
        <h3 class="font-semibold text-emerald-900 mb-1">This one is real</h3>
        <p class="text-sm text-emerald-800 leading-relaxed">
          The Visualizer tab is a simulation: the addresses are made up and the array is a
          JavaScript array. Here the actual .NET runtime, compiled to WebAssembly, builds two
          real <span class="font-mono font-semibold">List&lt;int&gt;</span> instances and
          reports what they cost. Nothing on this tab is a number we decided in advance.
        </p>
      </div>

      <!-- Controls -->
      <div class="bg-white rounded-xl shadow-md border border-gray-200 p-5">
        <div class="flex flex-wrap items-end gap-4">
          <div class="min-w-37.5 flex flex-col">
            <label for="benchAdds" class="block text-xs font-semibold text-gray-700 mb-2">
              Add() calls
            </label>
            <input
              id="benchAdds"
              type="number"
              [ngModel]="adds()"
              (ngModelChange)="adds.set($event)"
              [disabled]="running()"
              min="1"
              [max]="MAX_ADDS"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white shadow-sm disabled:bg-gray-100 disabled:text-gray-500" />
            <p class="text-[10px] text-gray-500 mt-1">How many items each list receives.</p>
          </div>

          <div class="min-w-37.5 flex flex-col">
            <label for="benchCapacity" class="block text-xs font-semibold text-gray-700 mb-2">
              Preallocated capacity
            </label>
            <input
              id="benchCapacity"
              type="number"
              [ngModel]="capacity()"
              (ngModelChange)="capacity.set($event)"
              [disabled]="running()"
              min="0"
              [max]="MAX_ADDS"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white shadow-sm disabled:bg-gray-100 disabled:text-gray-500" />
            <p class="text-[10px] font-mono text-blue-600 mt-1 bg-blue-50 px-2 py-1 rounded border border-blue-200">
              new List&lt;int&gt;({{ capacity() > 0 ? capacity() : '' }})
            </p>
          </div>

          <button
            type="button"
            (click)="runBenchmark()"
            [disabled]="running() || unavailable()"
            class="bg-brand-primary hover:bg-brand-secondary text-white px-5 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            @if (running()) {
              Running in .NET…
            } @else {
              Run benchmark
            }
          </button>
        </div>

        @if (capacity() > 0 && capacity() < adds()) {
          <p class="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            The capacity is below the add count, so the preallocated list will still resize.
            That is a real result, not a misconfiguration - reserve too little and you pay the
            same growth cost, just starting later.
          </p>
        }
      </div>

      <!-- Results -->
      @if (unavailable()) {
        <div class="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
          <p class="text-sm text-gray-700">
            The .NET runtime could not be loaded, so this benchmark cannot run here.
            Preallocating avoids the repeated allocate-and-copy cycle the Visualizer tab
            shows, but this page will not put a number on it that it did not measure.
          </p>
        </div>
      } @else if (result(); as r) {
        <div class="grid lg:grid-cols-2 gap-6">
          @for (run of r.runs; track run.id) {
            <div
              class="bg-white rounded-xl shadow-md border overflow-hidden"
              [class.border-gray-200]="run.resizeCount > 0"
              [class.border-emerald-300]="run.resizeCount === 0">
              <div
                class="px-4 py-3 border-b flex items-center justify-between"
                [class.bg-gray-50]="run.resizeCount > 0"
                [class.border-gray-200]="run.resizeCount > 0"
                [class.bg-emerald-50]="run.resizeCount === 0"
                [class.border-emerald-200]="run.resizeCount === 0">
                <h3 class="font-mono text-sm font-semibold text-gray-800">{{ run.label }}</h3>
                <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  {{ run.id === 'default' ? 'grows on demand' : 'reserved up front' }}
                </span>
              </div>

              <dl class="grid grid-cols-2 gap-px bg-gray-100">
                <div class="bg-white px-4 py-3">
                  <dt class="text-xs font-semibold text-gray-500 uppercase">Resizes</dt>
                  <dd
                    class="text-2xl font-bold tabular-nums"
                    [class.text-emerald-600]="run.resizeCount === 0"
                    [class.text-amber-600]="run.resizeCount > 0">
                    {{ run.resizeCount }}
                  </dd>
                  <p class="text-[10px] text-gray-500 mt-0.5">allocate + copy + discard</p>
                </div>
                <div class="bg-white px-4 py-3">
                  <dt class="text-xs font-semibold text-gray-500 uppercase">Allocated</dt>
                  <dd class="text-2xl font-bold text-gray-900 tabular-nums">
                    {{ formatBytes(run.allocatedBytes) }}
                  </dd>
                  <p class="text-[10px] text-gray-500 mt-0.5">heap bytes, one build</p>
                </div>
                <div class="bg-white px-4 py-3">
                  <dt class="text-xs font-semibold text-gray-500 uppercase">Final capacity</dt>
                  <dd class="text-2xl font-bold text-blue-600 tabular-nums">
                    {{ run.finalCapacity.toLocaleString() }}
                  </dd>
                  <p class="text-[10px] text-gray-500 mt-0.5">
                    {{ run.finalCapacity - r.adds }} slots unused
                  </p>
                </div>
                <div class="bg-white px-4 py-3">
                  <dt class="text-xs font-semibold text-gray-500 uppercase">Fastest</dt>
                  <dd class="text-2xl font-bold text-gray-900 tabular-nums">
                    {{ run.bestElapsedMs.toFixed(3) }}<span class="text-xs font-semibold ml-0.5">ms</span>
                  </dd>
                  <p class="text-[10px] text-gray-500 mt-0.5">
                    median {{ run.medianElapsedMs.toFixed(3) }} ms
                  </p>
                </div>
              </dl>

              <!-- Observed growth, straight from List<T>.Capacity -->
              <div class="px-4 py-3 border-t border-gray-100">
                <p class="text-xs font-semibold text-gray-500 uppercase mb-2">Observed growth</p>
                @if (run.growth.length === 0) {
                  <p class="text-xs text-gray-600">
                    The capacity never changed. One array, allocated once, never copied.
                  </p>
                } @else {
                  <div class="flex flex-wrap items-center gap-1 font-mono text-xs">
                    <span class="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                      {{ run.growth[0].fromCapacity }}
                    </span>
                    @for (step of run.growth; track step.atCount) {
                      <span class="text-gray-300" aria-hidden="true">→</span>
                      <span
                        class="px-1.5 py-0.5 rounded"
                        [class.bg-gray-100]="step.fromCapacity === 0"
                        [class.text-gray-600]="step.fromCapacity === 0"
                        [class.bg-amber-100]="step.fromCapacity > 0"
                        [class.text-amber-800]="step.fromCapacity > 0"
                        [title]="
                          step.fromCapacity === 0
                            ? 'First array, allocated at item ' + step.atCount + '. Nothing to copy.'
                            : 'Resized at item ' + step.atCount + ', copying ' + step.fromCapacity + ' elements.'
                        ">
                        {{ step.toCapacity }}
                      </span>
                    }
                  </div>
                  <p class="text-[10px] text-gray-500 mt-1.5">
                    Grey is the first allocation, which copies nothing. Amber is a resize.
                  </p>
                }
              </div>

              <app-code-block [code]="run.code" language="csharp" />
            </div>
          }
        </div>

        <!-- The comparison, stated only when there is one to state -->
        @if (verdict(); as v) {
          <div class="bg-white rounded-xl shadow-md border border-gray-200 p-5">
            <p class="text-sm text-gray-800 leading-relaxed">{{ v }}</p>
          </div>
        }

        <p class="text-xs text-gray-500">
          {{ r.adds.toLocaleString() }} adds per build, best and median of
          {{ r.rounds }} rounds. {{ r.runtimeNote }}
        </p>
      } @else if (running()) {
        <div class="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
          <p class="text-sm text-gray-500">
            Building both lists in the .NET runtime… the first run also downloads it.
          </p>
        </div>
      } @else {
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-400">
          <p class="text-sm font-medium">Press Run benchmark to measure both lists</p>
        </div>
      }
    </div>
  `,
})
export class ListBenchmarkComponent {
  private readonly benchmark = inject(ListBenchmarkService);

  /**
   * Seeded from the Visualizer tab's own capacity control, so switching tabs carries the
   * number the user was already thinking about rather than resetting it.
   */
  readonly seedCapacity = input<number>(0);

  /** Matches `ListGrowthBenchmark.MaxAdds`. The .NET side clamps regardless. */
  protected readonly MAX_ADDS = 200_000;

  protected readonly adds = signal<number>(10_000);

  /**
   * `linkedSignal` rather than a plain signal seeded in the constructor: a signal input is
   * not bound yet when the constructor runs, so reading it there would always see the
   * default. This tracks the sibling control until the user edits it here, then stays put.
   */
  protected readonly capacity = linkedSignal(() => this.seedCapacity() || 10_000);

  protected readonly result = signal<ListBenchmarkResult | null>(null);
  protected readonly running = signal(false);

  protected readonly unavailable = computed(() => this.benchmark.runtimeStatus() === 'failed');

  constructor() {
    // The parent renders this component only while the Benchmark tab is open, so merely
    // existing is the signal to start fetching the several-megabyte runtime. It downloads
    // while the user is still choosing numbers, and nothing is measured until they ask.
    void this.benchmark.prefetch();
  }

  /**
   * Deliberately a button rather than an `effect()` on the inputs, unlike the Span page's
   * probe. That one measures a substring and costs microseconds per keystroke; this builds
   * up to 200,000-element lists several times over and blocks the main thread while it does,
   * so it runs when asked and not before.
   */
  protected async runBenchmark(): Promise<void> {
    if (this.running()) {
      return;
    }

    this.running.set(true);
    this.result.set(null);

    // The interop call itself is synchronous once the runtime is up, so without yielding
    // first the browser never paints the "Running" state and the button just looks stuck.
    await new Promise(resolve => setTimeout(resolve, 0));

    try {
      const measured = await this.benchmark.run(this.adds(), this.capacity());
      this.result.set(measured.error ? null : measured);
    } catch {
      // `unavailable()` reports why; showing a half-result would be worse than showing none.
      this.result.set(null);
    } finally {
      this.running.set(false);
    }
  }

  /**
   * Compares the two runs in the terms the user chose. Returns null when there is nothing
   * honest to say - identical configurations, or a preallocated run that did not win.
   */
  protected readonly verdict = computed<string | null>(() => {
    const measured = this.result();
    if (!measured) {
      return null;
    }

    const fallback = measured.runs.find(run => run.id === 'default');
    const reserved = measured.runs.find(run => run.id === 'preallocated');
    if (!fallback || !reserved) {
      return null;
    }

    if (measured.capacity === 0) {
      return `A capacity of 0 is the same as not passing one at all, so both columns ran the
        identical code and the difference between them is measurement noise. Set a capacity to
        see the comparison.`;
    }

    const saved = fallback.allocatedBytes - reserved.allocatedBytes;
    const avoided = fallback.resizeCount - reserved.resizeCount;

    if (saved <= 0) {
      return `Preallocating ${measured.capacity.toLocaleString()} did not pay off here:
        it allocated ${this.formatBytes(reserved.allocatedBytes)} against the default's
        ${this.formatBytes(fallback.allocatedBytes)}. Reserving far more than you fill costs
        memory the default would never have asked for.`;
    }

    return `Preallocating avoided ${avoided} of the default's ${fallback.resizeCount} resizes
      and ${this.formatBytes(saved)} of allocation - each avoided resize is a new array plus
      an Array.Copy of everything already in the old one. The timings say the same thing, less
      reliably: browsers coarsen their clocks, the GC counter is exact.`;
  });

  protected formatBytes(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}
