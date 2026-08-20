import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DotnetRuntimeService } from './dotnet-runtime.service';
import { RuntimePrefetchService } from './runtime-prefetch.service';

describe('RuntimePrefetchService', () => {
  let load: ReturnType<typeof vi.fn>;
  let isStable$: BehaviorSubject<boolean>;

  interface Options {
    isEnabled?: boolean;
    standalone?: boolean;
    saveData?: boolean;
  }

  function configure({ isEnabled = true, standalone = false, saveData = false }: Options = {}) {
    load = vi.fn().mockResolvedValue({});
    isStable$ = new BehaviorSubject(false);

    // Defined on the real objects rather than stubbed globally: replacing `navigator`
    // wholesale also takes `window` out with it under jsdom.
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({
        matches: standalone && query.includes('standalone'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
    Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData } });

    TestBed.configureTestingModule({
      providers: [
        { provide: SwUpdate, useValue: { isEnabled } },
        { provide: DotnetRuntimeService, useValue: { load } },
        { provide: ApplicationRef, useValue: { isStable: isStable$ } },
      ],
    });

    return TestBed.inject(RuntimePrefetchService);
  }

  /** The service defers to app stability, so nothing happens until that fires. */
  function becomeStable(): void {
    isStable$.next(true);
  }

  let originalMatchMedia: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.restoreAllMocks();
    originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  });

  afterEach(() => {
    if (originalMatchMedia) {
      Object.defineProperty(window, 'matchMedia', originalMatchMedia);
    }
    delete (navigator as { connection?: unknown }).connection;
    TestBed.resetTestingModule();
  });

  it('does not touch the runtime in a plain browser tab', () => {
    configure({ standalone: false });
    becomeStable();

    expect(load).not.toHaveBeenCalled();
  });

  it('warms the runtime when launched as an installed app', () => {
    configure({ standalone: true });
    becomeStable();

    expect(load).toHaveBeenCalledOnce();
  });

  it('waits for the app to be stable before pulling megabytes', () => {
    configure({ standalone: true });

    expect(load).not.toHaveBeenCalled();

    becomeStable();
    expect(load).toHaveBeenCalledOnce();
  });

  it('warms the runtime when the user installs the app', () => {
    configure({ standalone: false });

    window.dispatchEvent(new Event('appinstalled'));
    becomeStable();

    expect(load).toHaveBeenCalledOnce();
  });

  it('warms only once when installed and then launched standalone', () => {
    configure({ standalone: true });

    window.dispatchEvent(new Event('appinstalled'));
    becomeStable();

    expect(load).toHaveBeenCalledOnce();
  });

  it('stays out of the way when the service worker is disabled', () => {
    configure({ isEnabled: false, standalone: true });
    becomeStable();

    expect(load).not.toHaveBeenCalled();
  });

  it('respects an explicit reduce-data-usage preference', () => {
    configure({ standalone: true, saveData: true });
    becomeStable();

    expect(load).not.toHaveBeenCalled();
  });

  it('does not surface a failed warm-up', async () => {
    configure({ standalone: true });
    load.mockRejectedValue(new Error('offline'));

    expect(() => becomeStable()).not.toThrow();
    await expect(Promise.resolve()).resolves.toBeUndefined();
  });
});
