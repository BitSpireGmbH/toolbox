import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  effect,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DialogRef } from '@angular/cdk/dialog';
import { Tool, TOOLS } from '../tools.registry';
import { ToolIconComponent } from '../tool-icon/tool-icon.component';

@Component({
  selector: 'app-search-dialog',
  imports: [CommonModule, ToolIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
         (keydown.escape)="onEscape()"
         role="dialog"
         aria-modal="true"
         aria-labelledby="search-title">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50"
           (click)="onBackdropClick()"
           aria-hidden="true"></div>

      <!-- Dialog -->
      <div class="relative w-full max-w-2xl mx-4 bg-white rounded-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <!-- Search Input -->
        <div class="border-b border-gray-200 p-4">
          <input
            #searchInput
            type="text"
            placeholder="Search tools..."
            [value]="searchQuery()"
            (input)="searchQuery.set($any($event.target).value)"
            (keydown)="handleKeyDown($event)"
            class="w-full text-lg outline-none bg-transparent placeholder-gray-400"
            aria-label="Search tools"
            aria-describedby="search-hint"
          />
          <p id="search-hint" class="text-xs text-gray-400 mt-2">
            Use ↑ ↓ to navigate, Enter to select, Esc to close
          </p>
        </div>

        <!-- Results -->
        <div class="max-h-96 overflow-y-auto">
          @if (filteredItems().length === 0) {
            <div class="p-8 text-center text-gray-500">
              <p class="text-sm">No tools found matching your search</p>
            </div>
          } @else {
            <ul class="divide-y divide-gray-200" role="listbox">
              @for (item of filteredItems(); let i = $index; track item.path) {
                <li
                  [class.bg-blue-50]="i === selectedIndex()"
                  class="cursor-pointer hover:bg-blue-50 transition-colors"
                  (click)="selectItem(item)"
                  (mouseover)="selectedIndex.set(i)"
                  (focus)="selectedIndex.set(i)"
                  (keydown.enter)="selectItem(item)"
                  (keydown.space)="selectItem(item)"
                  role="option"
                  tabindex="0"
                  [attr.aria-selected]="i === selectedIndex()">
                  <div class="px-4 py-3 flex items-center gap-3">
                    <app-tool-icon [name]="item.icon" svgClass="w-5 h-5 shrink-0 text-gray-400" />
                    <div class="min-w-0">
                      <p class="font-medium text-gray-900">{{ item.title }}</p>
                      <p class="text-sm text-gray-600">{{ item.description }}</p>
                      <p class="text-xs text-gray-400 mt-1">{{ item.category }}</p>
                    </div>
                  </div>
                </li>
              }
            </ul>
          }
        </div>

        <!-- Footer -->
        <div class="border-t border-gray-200 px-4 py-2 bg-gray-50 rounded-b-lg">
          <p class="text-xs text-gray-500">
            {{ filteredItems().length }} result{{ filteredItems().length !== 1 ? 's' : '' }}
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @keyframes fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes zoom-in-95 {
      from { transform: scale(0.95); }
      to { transform: scale(1); }
    }
    :host {
      animation: fade-in 0.2s ease-out;
    }
  `]
})
export class SearchDialogComponent {
  readonly searchQuery = signal('');
  readonly selectedIndex = signal(0);

  /**
   * All tools come straight from the shared registry — the same array that
   * drives routes, the sidebar, and the landing page — so this list can
   * never drift out of sync (previously it was a hand-maintained copy that
   * pointed at dead routes and omitted real tools like cURL and Regex Tester).
   */
  private readonly items: Tool[] = TOOLS;

  readonly filteredItems = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.items;

    return this.items.filter(item =>
      item.title.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query)
    );
  });

  private readonly dialogRef = inject(DialogRef<Tool | undefined>);
  private readonly router = inject(Router);

  constructor() {
    effect(() => {
      this.selectedIndex.set(0);
    });
  }

  selectItem(item: Tool): void {
    void this.router.navigate(['/' + item.path]);
    this.dialogRef.close(item);
  }

  onEscape(): void {
    this.dialogRef.close();
  }

  onBackdropClick(): void {
    this.dialogRef.close();
  }

  /** Bound to the search input so ↑ ↓ move the highlight while Enter selects it. */
  handleKeyDown(event: KeyboardEvent): void {
    const items = this.filteredItems();
    if (items.length === 0) {
      return;
    }
    const currentIndex = this.selectedIndex();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedIndex.set((currentIndex + 1) % items.length);
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.selectedIndex.set(currentIndex === 0 ? items.length - 1 : currentIndex - 1);
        break;

      case 'Enter':
        event.preventDefault();
        this.selectItem(items[currentIndex]);
        break;
    }
  }
}
