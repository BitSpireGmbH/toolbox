import { Injectable, inject } from '@angular/core';
import { DotnetRuntimeService, invokeWasm } from './dotnet-runtime.service';

/**
 * Mirrors the C# contracts in
 * `dotnet/Toolbox.Wasm.Core/Diagnostics/AllocationContracts.cs`. The shapes are produced
 * by source-generated camelCase serialization on that side, and pinned there by
 * `DiagnosticsJsonFacadeTests`, so these interfaces describe the wire format rather than
 * re-deriving it.
 */
export interface AllocationSample {
  /** `substring`, `span-slice`, or `span-tostring`. */
  id: string;
  label: string;
  totalBytes: number;
  bytesPerOperation: number;
  /** The C# that was measured, so a number is attributable to a line of code. */
  code: string;
}

export interface SliceAllocation {
  samples: AllocationSample[];
  iterations: number;
  /** Names the runtime that produced these numbers. Shown, not hidden. */
  runtimeNote: string;
  error?: string;
}

export interface SliceAllocationRequest {
  input: string;
  start: number;
  length: number;
  iterations: number;
}

/**
 * Measures what string slicing actually allocates, using the real GC accounting in
 * WebAssembly.
 *
 * Like {@link LinqVisualizerService} and unlike {@link RegexTesterService} there is
 * deliberately **no JavaScript fallback**. JavaScript has no way to observe .NET heap
 * allocations, so an approximation here would just be the hard-coded numbers the
 * Span&lt;T&gt; Visualizer already had - which is precisely what this replaces. When the
 * runtime is unavailable the page keeps its explanation and drops the measurement.
 */
@Injectable({ providedIn: 'root' })
export class AllocationProbeService {
  private readonly runtime = inject(DotnetRuntimeService);

  readonly runtimeStatus = this.runtime.status;
  readonly runtimeFailure = this.runtime.failure;

  /**
   * Enough repetitions for a stable per-operation figure without a perceptible pause.
   * The .NET side clamps this regardless, so it is a preference rather than a promise.
   */
  static readonly DEFAULT_ITERATIONS = 2000;

  measureSlice(input: string, start: number, length: number): Promise<SliceAllocation> {
    const request: SliceAllocationRequest = {
      input,
      start,
      length,
      iterations: AllocationProbeService.DEFAULT_ITERATIONS,
    };

    return invokeWasm<SliceAllocation>(this.runtime, wasm =>
      wasm.DiagnosticsInterop.MeasureSlice(JSON.stringify(request))
    );
  }
}
