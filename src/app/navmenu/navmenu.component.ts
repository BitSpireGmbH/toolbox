import { Component, ChangeDetectionStrategy, input, output, signal, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { environment } from '../../environments/environment';
import { TOOL_CATEGORIES, TOOLS, Tool, ToolCategory } from '../shared/tools.registry';
import { ToolIconComponent } from '../shared/tool-icon/tool-icon.component';
import { CommandPaletteService } from '../shared/search-dialog/command-palette.service';

interface ToolGroup {
  category: ToolCategory;
  tools: Tool[];
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

  protected readonly version = signal(environment.version);
  protected readonly filterQuery = signal('');

  /**
   * Every tool, grouped by category and narrowed by the sidebar filter.
   * Both the desktop rail and the mobile drawer render from this single
   * computed list, so they can never drift from one another or from the
   * tool registry.
   */
  protected readonly groups = computed<ToolGroup[]>(() => {
    const query = this.filterQuery().toLowerCase().trim();
    return TOOL_CATEGORIES.map(category => ({
      category,
      tools: TOOLS.filter(
        tool =>
          tool.category === category &&
          (!query || tool.title.toLowerCase().includes(query) || tool.category.toLowerCase().includes(query))
      ),
    })).filter(group => group.tools.length > 0);
  });

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
}
