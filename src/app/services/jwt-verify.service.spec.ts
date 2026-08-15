import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DotnetRuntimeService, ToolboxWasmExports } from './dotnet-runtime.service';
import { JwtVerifyService, type JwtVerifyRequest } from './jwt-verify.service';

/**
 * jsdom cannot start the WebAssembly runtime, so the interop boundary is stubbed. What is
 * worth testing here is the marshalling contract - the actual HMAC semantics are asserted
 * in `JwtVerifierTests`, where they run against the real
 * `System.Security.Cryptography`.
 */
describe('JwtVerifyService', () => {
  const REQUEST: JwtVerifyRequest = {
    token: 'a.b.c',
    secret: 'shh',
    secretEncoding: 'utf8',
  };

  let verifyJwt: ReturnType<typeof vi.fn>;
  let load: ReturnType<typeof vi.fn>;
  let status: () => string;
  let failure: () => string | null;

  beforeEach(() => {
    verifyJwt = vi.fn(
      () => '{"verified":true,"status":"verified","algorithm":"HS256","detail":"ok"}'
    );
    load = vi.fn(() =>
      Promise.resolve({
        Toolbox: { Wasm: { CryptoInterop: { VerifyJwt: verifyJwt } } },
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

  it('sends the request across the boundary as JSON', async () => {
    await TestBed.inject(JwtVerifyService).verify(REQUEST);

    expect(verifyJwt).toHaveBeenCalledWith(JSON.stringify(REQUEST));
  });

  it('parses a successful verdict', async () => {
    const result = await TestBed.inject(JwtVerifyService).verify(REQUEST);

    expect(result.verified).toBe(true);
    expect(result.status).toBe('verified');
    expect(result.algorithm).toBe('HS256');
  });

  it('keeps "could not check" distinct from "forged"', async () => {
    // The distinction the UI depends on: an unsupported algorithm must never be presented
    // as a failed signature, because the tool has not actually checked anything.
    verifyJwt.mockReturnValue(
      '{"verified":false,"status":"unsupported-algorithm","algorithm":"RS256","detail":"nope"}'
    );

    const result = await TestBed.inject(JwtVerifyService).verify(REQUEST);

    expect(result.verified).toBe(false);
    expect(result.status).toBe('unsupported-algorithm');
  });

  it('leaves algorithm undefined when the runtime omits it', async () => {
    verifyJwt.mockReturnValue('{"verified":false,"status":"malformed","detail":"bad"}');

    const result = await TestBed.inject(JwtVerifyService).verify(REQUEST);

    expect(result.algorithm).toBeUndefined();
  });

  it('surfaces the runtime status so the tool can refuse to guess', () => {
    status = () => 'failed';
    failure = () => 'offline';
    const service = TestBed.inject(JwtVerifyService);

    expect(service.runtimeStatus()).toBe('failed');
    expect(service.runtimeFailure()).toBe('offline');
  });

  it('propagates a runtime load failure rather than inventing a verdict', async () => {
    load.mockRejectedValueOnce(new Error('offline'));

    await expect(TestBed.inject(JwtVerifyService).verify(REQUEST)).rejects.toThrow('offline');
  });
});
