import { Injectable, inject } from '@angular/core';
import { DotnetRuntimeService, invokeWasm } from './dotnet-runtime.service';

/**
 * Mirrors the C# contracts in
 * `dotnet/Toolbox.Wasm.Core/Collections/ListBenchmarkContracts.cs`. The shapes are produced
 * by source-generated camelCase serialization on that side, and pinned there by
 * `CollectionsJsonFacadeTests`, so these interfaces describe the wire format rather than
 * re-deriving it.
 */
export interface GrowthStep {
  atCount: number;
  /** Zero means this was the first array, so there was nothing to copy. */
  fromCapacity: number;
  toCapacity: number;
}

export interface ListBenchmarkRun {
  /** `default` or `preallocated`. */
  id: string;
  label: string;
  /** The C# that was measured, so a number is attributable to a line of code. */
  code: string;
  bestElapsedMs: number;
  medianElapsedMs: number;
  allocatedBytes: number;
  /** Reallocations that had to copy. Excludes the first array, which copies nothing. */
  resizeCount: number;
  finalCapacity: number;
  growth: GrowthStep[];
}

export interface ListBenchmarkResult {
  runs: ListBenchmarkRun[];
  /** The add count actually used, after .NET clamped it. */
  adds: number;
  /** The capacity actually used, after .NET clamped it. */
  capacity: number;
  rounds: number;
  /** Names the runtime that produced these numbers. Shown, not hidden. */
  runtimeNote: string;
  error?: string;
}

export interface ListBenchmarkRequest {
  adds: number;
  capacity: number;
  rounds: number;
}

/**
 * Fills a `List<int>` with and without a preallocated capacity, and reports what it really
 * cost, using the .NET runtime in the browser.
 *
 * Like {@link AllocationProbeService} and unlike {@link RegexTesterService} there is
 * deliberately **no JavaScript fallback**. A JS array has no capacity to preallocate and no
 * observable heap accounting, so an approximation here would be a re-run of the simulation
 * the visualizer tab already shows - which is exactly what this exists to put a real number
 * against. When the runtime is unavailable the page keeps its explanation and drops the
 * measurement.
 */
@Injectable({ providedIn: 'root' })
export class ListBenchmarkService {
  private readonly runtime = inject(DotnetRuntimeService);

  readonly runtimeStatus = this.runtime.status;
  readonly runtimeFailure = this.runtime.failure;

  /**
   * Enough rounds to take a meaningful best and median from without the page sitting still.
   * The .NET side clamps this regardless, so it is a preference rather than a promise.
   */
  static readonly DEFAULT_ROUNDS = 5;

  /**
   * Starts the multi-megabyte download without running anything, so it can overlap with the
   * user choosing their numbers. Resolves when the runtime is up; failures are reported
   * through {@link runtimeStatus} rather than thrown at a caller who only asked to prefetch.
   */
  async prefetch(): Promise<void> {
    try {
      await this.runtime.load();
    } catch {
      // Already recorded on the service's status and failure signals.
    }
  }

  run(adds: number, capacity: number): Promise<ListBenchmarkResult> {
    const request: ListBenchmarkRequest = {
      adds,
      capacity,
      rounds: ListBenchmarkService.DEFAULT_ROUNDS,
    };

    return invokeWasm<ListBenchmarkResult>(this.runtime, wasm =>
      wasm.CollectionsInterop.RunListBenchmark(JSON.stringify(request))
    );
  }
}
