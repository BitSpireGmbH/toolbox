import { Component, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavmenuComponent } from './navmenu/navmenu.component';
import { PwaUpdateService } from './services/pwa-update.service';
import { RuntimePrefetchService } from './services/runtime-prefetch.service';
import { CommandPaletteService } from './shared/search-dialog/command-palette.service';
import { SeoService } from './services/seo.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavmenuComponent],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './app.css',
  host: {
    '(document:keydown)': 'onKeyDown($event)',
  },
})
export class App {
  protected readonly pwaUpdate = inject(PwaUpdateService);
  /** Injected for its constructor: warms the .NET runtime cache once installed. */
  private readonly runtimePrefetch = inject(RuntimePrefetchService);
  private readonly commandPalette = inject(CommandPaletteService);
  private readonly seo = inject(SeoService);

  protected readonly title = signal('toolbox');
  protected readonly sidebarOpen = signal(false);

  protected toggleSidebar(): void {
    this.sidebarOpen.set(!this.sidebarOpen());
  }

  protected closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  /** Global ⌘K / Ctrl+K shortcut - works on every route, not just the landing page. */
  protected onKeyDown(event: KeyboardEvent): void {
    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    const isSearchKey = isMac ? event.metaKey && event.key === 'k' : event.ctrlKey && event.key === 'k';

    if (isSearchKey) {
      event.preventDefault();
      this.commandPalette.open();
    }
  }
}
