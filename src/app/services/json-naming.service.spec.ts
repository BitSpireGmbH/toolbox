import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DotnetRuntimeService, ToolboxWasmExports } from './dotnet-runtime.service';
import { JsonNamingService } from './json-naming.service';

/**
 * jsdom cannot start the WebAssembly runtime, so the interop boundary is stubbed. What is
 * worth testing here is the marshalling contract and the degrade-to-null behaviour - the
 * naming semantics themselves are asserted in `NamingPolicyResolverTests`, where they run
 * against the real `JsonNamingPolicy`.
 */
describe('JsonNamingService', () => {
  const ROUND_TRIP_OPTIONS = {
    allowTrailingCommas: false,
    skipComments: false,
    maxDepth: 0,
    writeIndented: true,
    indentSize: 2,
    indentWithTabs: false,
    relaxedEscaping: false,
  };

  let applyNaming: ReturnType<typeof vi.fn>;
  let getNamingPolicies: ReturnType<typeof vi.fn>;
  let roundTrip: ReturnType<typeof vi.fn>;
  let load: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    applyNaming = vi.fn(() => '{"policy":"CamelCase","names":{"IPAddress":"ipAddress"}}');
    getNamingPolicies = vi.fn(
      () => '[{"id":"CamelCase","label":"camelCase","example":"ipAddress"}]'
    );
    roundTrip = vi.fn(() => '{"output":"{}","notes":[]}');
    load = vi.fn(() =>
      Promise.resolve({
        Toolbox: {
          Wasm: {
            SerializationInterop: {
              ApplyNaming: applyNaming,
              GetNamingPolicies: getNamingPolicies,
              RoundTrip: roundTrip,
            },
          },
        },
      } as unknown as ToolboxWasmExports)
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: DotnetRuntimeService,
          useValue: { status: () => 'ready', failure: () => null, load },
        },
      ],
    });
  });

  it('sends the names and policy across the boundary as JSON', async () => {
    await TestBed.inject(JsonNamingService).resolve(['IPAddress'], 'CamelCase');

    expect(applyNaming).toHaveBeenCalledWith(
      JSON.stringify({ policy: 'CamelCase', names: ['IPAddress'] })
    );
  });

  it('parses the map the runtime returns', async () => {
    const result = await TestBed.inject(JsonNamingService).resolve(['IPAddress'], 'CamelCase');

    expect(result?.get('IPAddress')).toBe('ipAddress');
  });

  it('does not touch the runtime when there is nothing to resolve', async () => {
    const result = await TestBed.inject(JsonNamingService).resolve([], 'CamelCase');

    expect(result?.size).toBe(0);
    expect(load).not.toHaveBeenCalled();
  });

  it('returns null rather than throwing when the runtime is unavailable', async () => {
    // Unlike the JWT verifier this is an upgrade, not a requirement: the generator has a
    // usable answer without .NET, so a load failure has to be recoverable.
    load.mockRejectedValueOnce(new Error('offline'));

    await expect(TestBed.inject(JsonNamingService).resolve(['ID'], 'CamelCase')).resolves.toBeNull();
  });

  it('reads the policy catalog from the runtime', async () => {
    const policies = await TestBed.inject(JsonNamingService).policies();

    expect(policies?.[0].id).toBe('CamelCase');
  });

  it('returns null for the catalog when the runtime is unavailable', async () => {
    load.mockRejectedValueOnce(new Error('offline'));

    await expect(TestBed.inject(JsonNamingService).policies()).resolves.toBeNull();
  });

  describe('roundTrip', () => {
    it('sends the payload and options across the boundary', async () => {
      await TestBed.inject(JsonNamingService).roundTrip('{"a":1}', ROUND_TRIP_OPTIONS);

      expect(roundTrip).toHaveBeenCalledWith('{"a":1}', JSON.stringify(ROUND_TRIP_OPTIONS));
    });

    it('parses a parse failure into a positioned error', async () => {
      roundTrip.mockReturnValue(
        '{"error":{"message":"bad","lineNumber":2,"bytePositionInLine":7},"notes":[]}'
      );

      const result = await TestBed.inject(JsonNamingService).roundTrip('{', ROUND_TRIP_OPTIONS);

      expect(result.output).toBeUndefined();
      expect(result.error?.lineNumber).toBe(2);
      expect(result.error?.bytePositionInLine).toBe(7);
    });

    it('throws when the runtime is unavailable rather than falling back to JSON.parse', async () => {
      // The deliberate difference from `resolve`: JSON.parse escapes nothing and reports
      // a different error in a different place, so a fallback here would be a wrong
      // answer rather than a rough one.
      load.mockRejectedValueOnce(new Error('offline'));

      await expect(
        TestBed.inject(JsonNamingService).roundTrip('{}', ROUND_TRIP_OPTIONS)
      ).rejects.toThrow('offline');
    });
  });
});
