import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PwaUpdateService } from './pwa-update.service';

describe('PwaUpdateService', () => {
  let versionUpdates$: Subject<VersionEvent>;
  let unrecoverable$: Subject<unknown>;
  let checkForUpdate: ReturnType<typeof vi.fn>;
  let activateUpdate: ReturnType<typeof vi.fn>;
  let reload: ReturnType<typeof vi.fn>;

  function configure(isEnabled: boolean): PwaUpdateService {
    versionUpdates$ = new Subject<VersionEvent>();
    unrecoverable$ = new Subject();
    checkForUpdate = vi.fn().mockResolvedValue(false);
    activateUpdate = vi.fn().mockResolvedValue(true);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: SwUpdate,
          useValue: {
            isEnabled,
            versionUpdates: versionUpdates$,
            unrecoverable: unrecoverable$,
            checkForUpdate,
            activateUpdate,
          },
        },
      ],
    });

    return TestBed.inject(PwaUpdateService);
  }

  beforeEach(() => {
    // jsdom's `document.location.reload` is non-configurable and can't be spied on directly,
    // so stub the global `location` the service reads instead.
    reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stays quiet when the service worker is disabled', () => {
    const service = configure(false);

    versionUpdates$.next({ type: 'VERSION_READY' } as VersionEvent);

    expect(service.updateAvailable()).toBe(false);
  });

  it('flags an update as available once a VERSION_READY event fires', () => {
    const service = configure(true);

    versionUpdates$.next({ type: 'VERSION_DETECTED' } as VersionEvent);
    expect(service.updateAvailable()).toBe(false);

    versionUpdates$.next({ type: 'VERSION_READY' } as VersionEvent);
    expect(service.updateAvailable()).toBe(true);
  });

  it('reloads the page once the version becomes unrecoverable', () => {
    configure(true);

    unrecoverable$.next({ type: 'UNRECOVERABLE_STATE', reason: 'boom' });

    expect(reload).toHaveBeenCalled();
  });

  it('activates the pending update and reloads on applyUpdate()', async () => {
    const service = configure(true);

    service.applyUpdate();
    await Promise.resolve();
    await Promise.resolve();

    expect(activateUpdate).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
  });

  it('dismiss() hides the prompt without activating the update', () => {
    const service = configure(true);
    versionUpdates$.next({ type: 'VERSION_READY' } as VersionEvent);
    expect(service.updateAvailable()).toBe(true);

    service.dismiss();

    expect(service.updateAvailable()).toBe(false);
    expect(activateUpdate).not.toHaveBeenCalled();
  });
});
