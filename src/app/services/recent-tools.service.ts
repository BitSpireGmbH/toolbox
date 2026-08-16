import { Injectable, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { TOOLS, Tool } from '../shared/tools.registry';

const STORAGE_KEY = 'toolbox.recent-tools';

/** Remembered across sessions. More than a handful stops being "recent". */
const MAX_STORED = 5;

/** Shown in the sidebar. Deliberately smaller than what we store, so the
 *  list still has something to fall back on once the active tool is dropped. */
const MAX_VISIBLE = 3;

/**
 * Tracks which tools were opened, most recent first, so the sidebar can keep
 * them one click away no matter how long the registry gets. Registered at the
 * root and instantiated by the sidebar, so it starts recording at app boot.
 */
@Injectable({ providedIn: 'root' })
export class RecentToolsService {
  private readonly router = inject(Router);

  private readonly paths = signal<readonly string[]>(this.read());
  private readonly activePath = signal(toolPathOf(this.router.url));

  /** The tool being viewed right now, or null on Home and non-tool routes. */
  readonly active = computed<Tool | null>(() => {
    const path = this.activePath();
    return TOOLS.find(tool => tool.path === path) ?? null;
  });

  /**
   * Most-recently-opened tools, newest first, excluding whatever is open now -
   * the point of the list is jumping *back*, and the current tool is shown
   * separately (pinned in the rail, highlighted in the expanded sidebar).
   */
  readonly recent = computed<Tool[]>(() => {
    const active = this.activePath();
    return this.paths()
      .filter(path => path !== active)
      .slice(0, MAX_VISIBLE)
      .map(path => TOOLS.find(tool => tool.path === path))
      .filter((tool): tool is Tool => tool !== undefined);
  });

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => this.record(event.urlAfterRedirects));
  }

  private record(url: string): void {
    const path = toolPathOf(url);
    this.activePath.set(path);

    // Home, unknown routes and deep links into non-tool pages never enter the list.
    if (!path) {
      return;
    }

    const next = [path, ...this.paths().filter(existing => existing !== path)].slice(0, MAX_STORED);
    this.paths.set(next);
    this.persist(next);
  }

  private read(): readonly string[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return [];
      }
      const parsed: unknown = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        return [];
      }
      // Filter against the registry so a tool that has since been renamed or
      // removed can't leave a dead link pinned to the top of the sidebar.
      return parsed
        .filter((path): path is string => typeof path === 'string' && TOOLS.some(tool => tool.path === path))
        .slice(0, MAX_STORED);
    } catch {
      // Safari private mode throws on storage access, and stored JSON can be corrupt.
      return [];
    }
  }

  private persist(paths: readonly string[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
    } catch {
      // Non-fatal - the list simply won't survive a reload.
    }
  }
}

/** `/regex-tester?flags=i` -> `regex-tester`; `/home` and `/` -> `''`. */
function toolPathOf(url: string): string {
  const segment = url.split(/[?#]/)[0].split('/').filter(Boolean)[0] ?? '';
  return TOOLS.some(tool => tool.path === segment) ? segment : '';
}
