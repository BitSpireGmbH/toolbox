import { ApplicationRef, Injectable, inject, signal } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, first, interval } from 'rxjs';

/** How often to poll for a new deployed version once the app has become stable. */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Watches for new service-worker versions and exposes a signal the UI can use
 * to show a "reload to update" prompt. The app keeps running the currently
 * loaded version until the user explicitly applies the update.
 */
@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly appRef = inject(ApplicationRef);

  readonly updateAvailable = signal(false);

  constructor() {
    if (!this.swUpdate.isEnabled) {
      return;
    }

    this.swUpdate.versionUpdates
      .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe(() => this.updateAvailable.set(true));

    // An update was found but the currently cached app can no longer be served
    // (e.g. its assets were removed from the server). Nothing to prompt for - just reload.
    this.swUpdate.unrecoverable.subscribe(() => {
      location.reload();
    });

    // Wait until the app is stable (so the initial render isn't delayed), then
    // periodically ask the service worker to check for a new version.
    this.appRef.isStable
      .pipe(first((stable) => stable))
      .subscribe(() => {
        interval(UPDATE_CHECK_INTERVAL_MS).subscribe(() => {
          void this.swUpdate.checkForUpdate();
        });
      });
  }

  /** Activates the pending update and reloads the page to run it. */
  applyUpdate(): void {
    void this.swUpdate.activateUpdate().then(() => {
      location.reload();
    });
  }

  /** Hides the prompt for the rest of this session without applying the update. */
  dismiss(): void {
    this.updateAvailable.set(false);
  }
}
