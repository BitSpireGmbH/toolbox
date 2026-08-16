import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DotnetRuntimeService, ToolboxWasmExports } from './dotnet-runtime.service';
import { StructLayoutService } from './struct-layout.service';

/**
 * jsdom cannot start the WebAssembly runtime, so the interop boundary is stubbed. What is
 * worth testing here is the marshalling contract - the layout rules themselves are
 * asserted in `LayoutRuntimeParityTests`, where they run against the real runtime's own
 * `Unsafe.SizeOf` and `Unsafe.ByteOffset`.
 */
describe('StructLayoutService', () => {
  const RESULT = JSON.stringify({
    target: 'X64',
    structs: [
      {
        name: 'S',
        kind: 'Sequential',
        size: 16,
        alignment: 8,
        paddingBytes: 7,
        pack: 0,
        trailingPadding: 0,
        fields: [
          { name: 'Flag', type: 'byte', offset: 0, size: 1, alignment: 1, paddingBefore: 0, isExplicit: false, overlaps: false },
          { name: 'Ticks', type: 'long', offset: 8, size: 8, alignment: 8, paddingBefore: 7, isExplicit: false, overlaps: false },
        ],
        notes: [],
      },
    ],
    diagnostics: [],
    caveats: [],
  });

  let calculate: ReturnType<typeof vi.fn>;
  let load: ReturnType<typeof vi.fn>;
  let status: () => string;
  let failure: () => string | null;

  beforeEach(() => {
    calculate = vi.fn(() => RESULT);
    load = vi.fn(() =>
      Promise.resolve({
        Toolbox: { Wasm: { LayoutInterop: { Calculate: calculate } } },
      } as unknown as ToolboxWasmExports)
    );
    status = () => 'ready';
    failure = () => null;

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: DotnetRuntimeService,
          useValue: {
            status: () => status(),
            failure: () => failure(),
            frameworkDescription: () => '.NET 10.0.3',
            load,
          },
        },
      ],
    });
  });

  it('sends the source and target across the boundary as JSON', async () => {
    await TestBed.inject(StructLayoutService).calculate('struct S { }', 'Wasm32');

    expect(calculate).toHaveBeenCalledWith(JSON.stringify({ source: 'struct S { }', target: 'Wasm32' }));
  });

  it('parses the offsets and padding', async () => {
    const result = await TestBed.inject(StructLayoutService).calculate('struct S { }', 'X64');

    const layout = result.structs[0];
    expect(layout.size).toBe(16);
    expect(layout.fields[1].offset).toBe(8);
    expect(layout.fields[1].paddingBefore).toBe(7);
  });

  it('leaves the suggestion undefined when the runtime omits it', async () => {
    const result = await TestBed.inject(StructLayoutService).calculate('struct S { }', 'X64');

    expect(result.structs[0].suggestion).toBeUndefined();
  });

  it('surfaces the runtime status so the tool can refuse to guess', () => {
    status = () => 'failed';
    failure = () => 'offline';
    const service = TestBed.inject(StructLayoutService);

    expect(service.runtimeStatus()).toBe('failed');
    expect(service.runtimeFailure()).toBe('offline');
  });

  it('propagates a runtime load failure rather than inventing a layout', async () => {
    // An approximate offset table is a wrong answer, not a degraded one, so there is
    // deliberately nothing to fall back to.
    load.mockRejectedValueOnce(new Error('offline'));

    await expect(
      TestBed.inject(StructLayoutService).calculate('struct S { }', 'X64')
    ).rejects.toThrow('offline');
  });
});
