import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DotnetRuntimeService, ToolboxWasmExports } from './dotnet-runtime.service';
import { LinqPipelineSpec, LinqVisualizerService } from './linq-visualizer.service';

/**
 * jsdom cannot start the WebAssembly runtime, so the interop boundary is stubbed. What
 * is worth testing here is the marshalling contract and the caching behaviour - the
 * actual LINQ semantics are asserted in the .NET tests, where they can run for real.
 */
describe('LinqVisualizerService', () => {
  const SPEC: LinqPipelineSpec = {
    source: { kind: 'numbers', count: 4 },
    operators: [{ id: 'take', number: 2 }],
    terminal: 'toList',
    enumerateTwice: false,
  };

  let run: ReturnType<typeof vi.fn>;
  let getCatalog: ReturnType<typeof vi.fn>;
  let load: ReturnType<typeof vi.fn>;

  const configure = (): void => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: DotnetRuntimeService,
          useValue: {
            status: () => 'ready',
            failure: () => null,
            frameworkDescription: () => '.NET 10.0.3',
            load,
          },
        },
      ],
    });
  };

  beforeEach(() => {
    run = vi.fn(() => '{"stages":[],"events":[],"methodSyntax":"","resultText":"","stats":{}}');
    getCatalog = vi.fn(() => '{"sources":[],"operators":[],"terminals":[]}');
    load = vi.fn(() =>
      Promise.resolve({
        Toolbox: { Wasm: { LinqInterop: { Run: run, GetCatalog: getCatalog } } },
      } as unknown as ToolboxWasmExports)
    );

    TestBed.resetTestingModule();
    configure();
  });

  it('sends the pipeline across the boundary as JSON', async () => {
    await TestBed.inject(LinqVisualizerService).run(SPEC);

    expect(run).toHaveBeenCalledWith(JSON.stringify(SPEC));
  });

  it('parses the trace the runtime returns', async () => {
    run.mockReturnValue(
      '{"stages":[{"index":0,"label":"numbers (1..4)","kind":"source"}],' +
        '"events":[{"step":0,"stage":0,"kind":"pulled","pass":0}],' +
        '"methodSyntax":"var q = numbers;","resultText":"[1]",' +
        '"stats":{"sourcePulls":1,"sourceYields":1,"totalEvents":1,"shortCircuited":true},' +
        '"truncated":false}'
    );

    const result = await TestBed.inject(LinqVisualizerService).run(SPEC);

    expect(result.stages[0].kind).toBe('source');
    expect(result.events[0].kind).toBe('pulled');
    expect(result.stats.shortCircuited).toBe(true);
    expect(result.querySyntax).toBeUndefined();
  });

  it('fetches the operator catalog only once', async () => {
    const service = TestBed.inject(LinqVisualizerService);

    await Promise.all([service.loadCatalog(), service.loadCatalog()]);
    await service.loadCatalog();

    expect(getCatalog).toHaveBeenCalledTimes(1);
  });

  it('allows the catalog to be retried after a failed load', async () => {
    load.mockRejectedValueOnce(new Error('offline'));
    const service = TestBed.inject(LinqVisualizerService);

    await expect(service.loadCatalog()).rejects.toThrow('offline');

    // A rejected request must not poison the session: the second attempt reaches the
    // runtime rather than replaying the cached failure.
    await expect(service.loadCatalog()).resolves.toEqual({
      sources: [],
      operators: [],
      terminals: [],
    });
  });

  it('surfaces the runtime status so the tool can refuse to guess', async () => {
    const service = TestBed.inject(LinqVisualizerService);

    expect(service.runtimeStatus()).toBe('ready');
    expect(service.frameworkDescription()).toBe('.NET 10.0.3');
  });
});
