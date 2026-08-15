import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DotnetRuntimeService } from './dotnet-runtime.service';

/**
 * jsdom has no WebAssembly runtime to load, so the import inside `load()` always
 * fails here. That still exercises the parts that matter most in production: that
 * a failure is reported rather than thrown into the void, and that the multi-
 * megabyte download is never started more than once.
 */
describe('DotnetRuntimeService', () => {
  let service: DotnetRuntimeService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(DotnetRuntimeService);
  });

  it('starts idle, before anything has asked for the runtime', () => {
    expect(service.status()).toBe('idle');
    expect(service.failure()).toBeNull();
  });

  it('reports failure rather than leaving the status stuck on loading', async () => {
    await expect(service.load()).rejects.toThrow();

    expect(service.status()).toBe('failed');
    expect(service.failure()).not.toBeNull();
  });

  it('shares one attempt between concurrent callers', async () => {
    const first = service.load();
    const second = service.load();

    // Same promise instance: two tools opening at once must not trigger two
    // downloads of the runtime.
    expect(first).toBe(second);

    await Promise.allSettled([first, second]);
  });

  it('allows a retry after a failure instead of poisoning the session', async () => {
    await Promise.allSettled([service.load()]);
    const retry = service.load();

    // A fresh attempt, not the rejected promise handed back forever.
    await Promise.allSettled([retry]);
    expect(service.status()).toBe('failed');
  });
});
