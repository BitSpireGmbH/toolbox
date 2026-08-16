import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DotnetRuntimeService, ToolboxWasmExports } from './dotnet-runtime.service';
import { ListBenchmarkResult, ListBenchmarkService } from './list-benchmark.service';

/**
 * jsdom cannot start the WebAssembly runtime, so the interop boundary is stubbed. What is
 * worth testing here is the marshalling contract - that the numbers the user typed reach
 * .NET under the property names its source-generated deserializer expects. The benchmark
 * semantics are asserted in the .NET tests, where they can run for real.
 */
describe('ListBenchmarkService', () => {
  const RESULT: ListBenchmarkResult = {
    runs: [],
    adds: 10,
    capacity: 10,
    rounds: 5,
    runtimeNote: '.NET 10.0.0',
  };

  let runListBenchmark: ReturnType<typeof vi.fn>;
  let load: ReturnType<typeof vi.fn>;
  let service: ListBenchmarkService;

  beforeEach(() => {
    runListBenchmark = vi.fn(() => JSON.stringify(RESULT));

    // Reached by its C# name, capitalised, because that is what `[JSExport]` publishes.
    load = vi.fn(() =>
      Promise.resolve({
        Toolbox: { Wasm: { CollectionsInterop: { RunListBenchmark: runListBenchmark } } },
      } as unknown as ToolboxWasmExports)
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: DotnetRuntimeService,
          useValue: { load, status: () => 'ready', failure: () => null },
        },
      ],
    });

    service = TestBed.inject(ListBenchmarkService);
  });

  it('sends the chosen counts under the names the .NET contract expects', async () => {
    await service.run(1234, 500);

    expect(runListBenchmark).toHaveBeenCalledTimes(1);
    expect(JSON.parse(runListBenchmark.mock.calls[0][0] as string)).toEqual({
      adds: 1234,
      capacity: 500,
      rounds: ListBenchmarkService.DEFAULT_ROUNDS,
    });
  });

  it('passes a capacity of zero through rather than dropping it', async () => {
    // Zero is a meaningful answer here - it is how the page shows that preallocating nothing
    // buys nothing - so it must not be treated as "unset" and replaced with a default.
    await service.run(100, 0);

    expect(JSON.parse(runListBenchmark.mock.calls[0][0] as string).capacity).toBe(0);
  });

  it('parses the measurement back out of the JSON boundary', async () => {
    await expect(service.run(10, 10)).resolves.toEqual(RESULT);
  });

  it('reports a runtime that never starts rather than resolving with nothing', async () => {
    load.mockRejectedValueOnce(new Error('no runtime'));

    await expect(service.run(10, 10)).rejects.toThrow('no runtime');
  });

  it('prefetches without throwing when the runtime is unavailable', async () => {
    load.mockRejectedValueOnce(new Error('no runtime'));

    // Prefetch is fire-and-forget from the component's constructor; an unhandled rejection
    // there would surface as a console error on a page that is otherwise working fine.
    await expect(service.prefetch()).resolves.toBeUndefined();
  });

  it('does not touch the runtime until something is actually measured', () => {
    expect(load).not.toHaveBeenCalled();
  });
});
