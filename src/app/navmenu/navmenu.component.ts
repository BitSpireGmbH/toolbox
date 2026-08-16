import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { environment } from '../../environments/environment';
import { TOOL_SECTIONS, TOOLS, Tool, ToolCategory, ToolSection } from '../shared/tools.registry';
import { ToolIconComponent } from '../shared/tool-icon/tool-icon.component';
import { CommandPaletteService } from '../shared/search-dialog/command-palette.service';
import { RecentToolsService } from '../services/recent-tools.service';

const COLLAPSED_STORAGE_KEY = 'toolbox.sidebar.collapsed';

interface ToolGroup {
  category: ToolCategory;
  tools: Tool[];
}

interface SidebarSection {
  name: ToolSection;
  groups: ToolGroup[];
}

@Component({
  selector: 'app-navmenu',
  imports: [RouterLink, RouterLinkActive, ToolIconComponent],
  templateUrl: './navmenu.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavmenuComponent {
  readonly sidebarOpen = input.required<boolean>();

  readonly toggleSidebar = output<void>();
  readonly closeSidebar = output<void>();

  private readonly commandPalette = inject(CommandPaletteService);
  private readonly recentTools = inject(RecentToolsService);

  protected readonly version = signal(environment.version);
  protected readonly filterQuery = signal('');

  /** Last few tools the visitor opened, newest first. Empty on a first visit. */
  protected readonly recent = this.recentTools.recent;

  /** Pinned into the 48px rail so "where am I" survives the collapse. */
  protected readonly activeTool = this.recentTools.active;

  private readonly collapsedSections = signal<ReadonlySet<ToolSection>>(this.readCollapsed());

  /**
   * Every tool, grouped section -> category and narrowed by the sidebar filter.
   * Both the desktop rail and the mobile drawer render from this single
   * computed list, so they can never drift from one another or from the
   * tool registry.
   */
  protected readonly sections = computed<SidebarSection[]>(() => {
    const query = this.filterQuery().toLowerCase().trim();
    const matches = (tool: Tool) =>
      !query ||
      tool.title.toLowerCase().includes(query) ||
      tool.category.toLowerCase().includes(query) ||
      tool.section.toLowerCase().includes(query);

    return TOOL_SECTIONS.map(section => ({
      name: section.name,
      groups: section.categories
        .map(category => ({
          category,
          tools: TOOLS.filter(tool => tool.category === category && matches(tool)),
        }))
        .filter(group => group.tools.length > 0),
    })).filter(section => section.groups.length > 0);
  });

  /** Guards the auto-expand below against re-opening a section the user just closed. */
  private autoExpandedFor: string | null = null;

  constructor() {
    /*
     * Opening a tool must never leave it hidden inside a collapsed section.
     * This has to react to navigation rather than run once at construction:
     * the sidebar is built during bootstrap, before the router has resolved
     * the first URL, so at that point there is no active tool to look up.
     */
    effect(() => {
      const tool = this.activeTool();
      if (!tool || tool.path === this.autoExpandedFor) {
        return;
      }
      this.autoExpandedFor = tool.path;

      // Untracked so collapsing a section by hand doesn't retrigger this effect.
      untracked(() => {
        const next = new Set(this.collapsedSections());
        if (next.delete(tool.section)) {
          this.collapsedSections.set(next);
        }
      });
    });

    effect(() => this.persistCollapsed(this.collapsedSections()));
  }

  /**
   * A collapsed section still opens while filtering - otherwise a match would
   * hide inside it and the filter would look broken.
   */
  protected isExpanded(section: ToolSection): boolean {
    return this.filterQuery().trim() !== '' || !this.collapsedSections().has(section);
  }

  protected toggleSection(section: ToolSection): void {
    const next = new Set(this.collapsedSections());
    if (next.has(section)) {
      next.delete(section);
    } else {
      next.add(section);
    }
    this.collapsedSections.set(next);
  }

  protected onToggleSidebar(): void {
    this.toggleSidebar.emit();
  }

  protected onCloseSidebar(): void {
    this.closeSidebar.emit();
  }

  protected onFilterInput(value: string): void {
    this.filterQuery.set(value);
  }

  protected openSearch(): void {
    this.commandPalette.open();
  }

  private readCollapsed(): ReadonlySet<ToolSection> {
    try {
      const stored = localStorage.getItem(COLLAPSED_STORAGE_KEY);
      if (!stored) {
        return new Set();
      }
      const parsed: unknown = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        return new Set();
      }
      const known = TOOL_SECTIONS.map(section => section.name);
      return new Set(parsed.filter((name): name is ToolSection => known.includes(name as ToolSection)));
    } catch {
      // Safari private mode throws on storage access, and stored JSON can be corrupt.
      return new Set();
    }
  }

  private persistCollapsed(sections: ReadonlySet<ToolSection>): void {
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...sections]));
    } catch {
      // Non-fatal - the sections simply won't stay collapsed across a reload.
    }
  }
}
