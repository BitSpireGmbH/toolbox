import { ApplicationRef, Injectable, inject } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { first } from 'rxjs';

import { DotnetRuntimeService } from './dotnet-runtime.service';

/**
 * Makes the installed app work offline without charging every visitor for it.
 *
 * The service worker caches `/dotnet/**` lazily, so a first visit costs nothing and
 * the ten tools that never touch .NET stay as light as the landing page. That leaves
 * one gap: an installed PWA is expected to work with no network at all, and a tool
 * whose runtime was never fetched cannot.
 *
 * So the runtime is warmed at exactly the moment offline support starts to matter -
 * when the app is installed, or when it is launched as an installed app. Booting the
 * runtime is the warm-up rather than a list of URLs to fetch, because the boot pulls
 * exactly the one ICU shard this visitor's locale resolves to; prefetching the group
 * by hand would pull all three and waste ~470KB on shards the runtime never asks for.
 */
@Injectable({ providedIn: 'root' })
export class RuntimePrefetchService {
  private readonly runtime = inject(DotnetRuntimeService);
  private readonly swUpdate = inject(SwUpdate);
  private readonly appRef = inject(ApplicationRef);

  private warmed = false;

  constructor() {
    // No service worker means no offline story to complete, and in dev it would
    // just be a multi-megabyte download nobody asked for.
    if (!this.swUpdate.isEnabled) {
      return;
    }

    if (this.isInstalled()) {
      this.warmWhenStable();
    }

    // Fires the moment the user accepts the install prompt, which is the point the
    // promise of offline support is actually made.
    window.addEventListener('appinstalled', () => this.warmWhenStable(), { once: true });
  }

  /** True when this is running as an installed app rather than a browser tab. */
  private isInstalled(): boolean {
    const iosStandalone = (navigator as { standalone?: boolean }).standalone === true;
    return iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
  }

  private warmWhenStable(): void {
    if (this.warmed || this.savingData()) {
      return;
    }
    this.warmed = true;

    // Waiting for stability keeps this off the critical path: the app has rendered
    // and settled before several megabytes start moving.
    this.appRef.isStable.pipe(first((stable) => stable)).subscribe(() => {
      // A failure here is not worth surfacing. The tools each load the runtime on
      // demand and report their own failures; this is only an optimisation, and the
      // service already discards a rejected promise so the retry still works.
      void this.runtime.load().catch(() => undefined);
    });
  }

  /** Honour an explicit "reduce data usage" preference over eager caching. */
  private savingData(): boolean {
    return (navigator as { connection?: { saveData?: boolean } }).connection?.saveData === true;
  }
}
