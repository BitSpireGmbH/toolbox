import { Component, signal, computed, effect, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import {
  MiddlewareDesignerService,
  Pipeline,
  MiddlewareNode,
  MiddlewareType,
  MiddlewareConfig,
  BranchCondition,
} from '../services/middleware-designer.service';
import { MiddlewareLibraryItemComponent } from './components/middleware-library-item';
import { MiddlewareNodeCardComponent } from './components/middleware-node-card';
import { ValidationMessagesComponent } from './components/validation-messages';
import { MiddlewareEditModalComponent } from './components/middleware-edit-modal';
import { MiddlewareSimulationPanelComponent } from './components/middleware-simulation-panel';
import { MIDDLEWARE_LIBRARY } from './middleware-library.const';
import {
  EditConfig,
  initializeEditConfig,
  buildMiddlewareConfig,
  buildBranch,
  getMiddlewareConfigSummary,
  getBranchConditionText,
} from './middleware-config.utils';

@Component({
  selector: 'app-middleware-designer',
  imports: [FormsModule, DragDropModule, MiddlewareLibraryItemComponent, MiddlewareNodeCardComponent, ValidationMessagesComponent, MiddlewareEditModalComponent, MiddlewareSimulationPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-7xl mx-auto p-6">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-1">Middleware Designer</h1>
          <p class="text-sm text-gray-600">Build ASP.NET Core middleware pipelines visually</p>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <button
            (click)="showLibrary.set(!showLibrary())"
            [class]="showLibrary() ? 'bg-brand-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
            class="px-4 py-2 rounded-lg border border-gray-300 font-medium text-sm transition-all flex items-center gap-2 shadow-sm">
            Library
          </button>
          <button
            (click)="showSimulation.set(!showSimulation())"
            [class]="showSimulation() ? 'bg-brand-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
            class="px-4 py-2 rounded-lg border border-gray-300 font-medium text-sm transition-all flex items-center gap-2 shadow-sm">
            Simulation
          </button>

          <div class="inline-flex rounded-lg border border-gray-300 bg-white p-0.5 shadow-sm">
            <button
              (click)="splitRatio.set(100)"
              [class]="splitRatio() === 100 ? 'bg-brand-primary text-white' : 'text-gray-700 hover:bg-gray-50'"
              class="px-3 py-2 rounded-md text-xs font-semibold transition-all"
              title="Canvas Only">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"></rect>
              </svg>
            </button>
            <button
              (click)="splitRatio.set(50)"
              [class]="splitRatio() > 0 && splitRatio() < 100 ? 'bg-brand-primary text-white' : 'text-gray-700 hover:bg-gray-50'"
              class="hidden md:inline-flex px-3 py-2 rounded-md text-xs font-semibold transition-all"
              title="Split View">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                <line x1="12" y1="3" x2="12" y2="21"></line>
              </svg>
            </button>
            <button
              (click)="splitRatio.set(0)"
              [class]="splitRatio() === 0 ? 'bg-brand-primary text-white' : 'text-gray-700 hover:bg-gray-50'"
              class="px-3 py-2 rounded-md text-xs font-semibold transition-all"
              title="Code Only">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                <polyline points="10 9 9 9 8 9"></polyline>
                <polyline points="14 9 15 9 16 9"></polyline>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Pipeline Actions -->
      @if (showLibrary()) {
        <div class="bg-linear-to-br from-white to-gray-50 rounded-xl shadow-lg border border-gray-200 p-5 mb-6">
          <div class="flex gap-2 flex-wrap items-center">
            <button
              (click)="clearPipeline()"
              class="px-3 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium flex items-center gap-1.5">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14"></path>
              </svg>
              Clear
            </button>
            @if (copySuccess()) {
              <span class="text-xs text-green-600 font-medium">✓ Copied!</span>
            }
          </div>

          <!-- Validation Messages -->
          @if (validationResult()) {
            <app-validation-messages
              [errors]="validationResult()!.errors"
              [warnings]="validationResult()!.warnings" />
          }
        </div>
      }

      <!-- Main Layout -->
      <div class="gap-5" [class]="gridLayoutClass()">
        <!-- Middleware Library Sidebar -->
        @if (showLibrary()) {
          <div class="bg-white rounded-xl shadow-md border border-gray-200 p-5 h-fit lg:sticky lg:top-6">
            <h3 class="font-semibold text-sm text-gray-700 mb-3">Middleware Library</h3>
            <div class="space-y-2 max-h-200 overflow-y-auto">
              @for (item of middlewareLibrary; track item.type) {
                <app-middleware-library-item
                  [item]="item"
                  (itemClick)="addMiddleware($event.type, $event.config)" />
              }
            </div>
          </div>
        }

        <!-- Canvas & Code Container with Resizable Divider -->
        <div class="flex gap-0 relative w-full">
          <!-- Canvas -->
          @if (splitRatio() > 0) {
          <div class="shrink-0 transition-all w-full lg:w-[var(--canvas-width)]" [style.--canvas-width]="splitRatio() + '%'">
            <div class="group relative bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow h-full w-full">
          <div class="bg-linear-to-r from-gray-50 to-gray-100 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-1.5 h-1.5 rounded-full" [class]="pipeline().middlewares.length > 0 ? 'bg-green-500' : 'bg-gray-300'"></div>
              <h3 class="font-semibold text-sm text-gray-700">Pipeline Canvas</h3>
            </div>
            <span class="text-xs text-gray-500">{{ pipeline().middlewares.length }} middleware(s)</span>
          </div>

          <div [class]="splitRatio() === 100 ? 'p-4 min-h-200' : 'p-4 min-h-150'">
            @if (pipeline().middlewares.length === 0) {
              <div class="text-center py-20 text-gray-500">
                <p class="text-base font-medium">No middleware added yet</p>
                <p class="text-sm mt-1">Add middleware from the library to get started</p>
              </div>
            } @else {
              <div
                cdkDropList
                (cdkDropListDropped)="onDrop($event)"
                class="space-y-2.5">
                @for (middleware of sortedMiddlewares(); track middleware.id) {
                  <div
                    cdkDrag
                    class="bg-white border rounded-lg p-3 hover:shadow-sm transition-all cursor-move"
                    [class.border-brand-primary]="selectedMiddleware()?.id === middleware.id"
                    [class.shadow-sm]="selectedMiddleware()?.id === middleware.id"
                    [class.border-gray-200]="selectedMiddleware()?.id !== middleware.id">
                    <app-middleware-node-card
                      [middleware]="middleware"
                      [configSummary]="getMiddlewareConfigSummary(middleware)"
                      [branchText]="middleware.branch ? getBranchConditionText(middleware.branch.condition) : ''"
                      (edit)="editMiddleware(middleware)"
                      (delete)="deleteMiddleware(middleware.id)" />
                  </div>
                }
              </div>
            }
          </div>
            </div>
          </div>
          }

          <!-- Resizable Divider -->
          @if (splitRatio() > 0 && splitRatio() < 100) {
            <div
              (mousedown)="startResize($event)"
              [class]="isResizing() ? 'bg-brand-primary' : 'bg-gray-300 hover:bg-brand-primary'"
              class="hidden lg:block w-1 cursor-col-resize transition-colors shrink-0 mx-2 relative group">
              <div class="absolute inset-y-0 -left-1 -right-1"></div>
            </div>
          }

        <!-- Code Output -->
        @if (splitRatio() < 100) {
        <div class="shrink-0 transition-all w-full lg:w-[var(--code-width)]" [style.--code-width]="(100 - splitRatio()) + '%'">
          <div class="group relative bg-gray-900 rounded-xl shadow-md border border-gray-700 overflow-hidden hover:shadow-lg transition-shadow h-full w-full flex flex-col">
            <div class="bg-linear-to-r from-gray-800 to-gray-900 px-4 py-2.5 border-b border-gray-700 flex justify-between items-center shrink-0">
              <div class="flex items-center gap-2">
                <div class="w-1.5 h-1.5 rounded-full" [class]="generatedCode() ? 'bg-green-500' : 'bg-gray-500'"></div>
                <h3 class="font-semibold text-sm text-gray-200">Generated C# Code</h3>
              </div>
              <button
                (click)="copyCode()"
                [disabled]="!generatedCode()"
                class="px-3 py-1 rounded-md text-xs font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                [class]="generatedCode() ? 'text-green-400 hover:bg-green-400/10' : 'text-gray-500'">
                <span class="flex items-center gap-1.5">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  Copy
                </span>
              </button>
            </div>

            <textarea
              [value]="generatedCode()"
              readonly
              class="w-full grow p-4 font-mono text-sm bg-gray-900 text-green-400 focus:outline-none resize-none min-h-150"
              placeholder="Generated C# code will appear here..."></textarea>
          </div>
        </div>
        }
        </div>
      </div>

        <!-- Simulation Panel -->
        @if (showSimulation()) {
          <app-middleware-simulation-panel
            [pipeline]="pipeline()" />
        }

        <!-- Edit Modal -->
        <app-middleware-edit-modal
          [middleware]="selectedMiddleware()"
          [(config)]="editConfig"
          (save)="saveMiddlewareConfig()"
          (cancel)="closeEditModal()" />
    </div>
  `,
})
export class MiddlewareDesignerComponent {
  private readonly service = inject(MiddlewareDesignerService);

  // State
  protected readonly pipeline = signal<Pipeline>({
    id: crypto.randomUUID(),
    name: 'My Pipeline',
    middlewares: [],
  });

  protected readonly showLibrary = signal<boolean>(true);
  protected readonly showSimulation = signal<boolean>(false);
  protected readonly selectedMiddleware = signal<MiddlewareNode | null>(null);
  protected readonly validationResult = signal(this.service.validatePipeline(this.pipeline()));
  protected readonly generatedCode = signal<string>('');
  protected readonly copySuccess = signal<boolean>(false);
  protected readonly splitRatio = signal<number>(50); // percentage for canvas width
  protected readonly isResizing = signal<boolean>(false);

  // Computed
  protected readonly sortedMiddlewares = computed(() =>
    [...this.pipeline().middlewares].sort((a, b) => a.order - b.order)
  );

  protected readonly minimalAPIEndpoints = computed(() =>
    this.service.extractMinimalAPIEndpoints(this.pipeline())
  );

  protected readonly gridLayoutClass = computed(() => {
    const showLib = this.showLibrary();
    if (showLib) {
      return 'grid grid-cols-1 lg:grid-cols-[300px_1fr]';
    }
    return 'grid grid-cols-1';
  });

  protected readonly canvasWidthStyle = computed(() => {
    const ratio = this.splitRatio();
    if (ratio === 100) return `width: 100%;`;
    return `width: ${ratio}%;`;
  });

  protected readonly codeWidthStyle = computed(() => {
    const ratio = this.splitRatio();
    if (ratio === 0) return `width: 100%;`;
    return `width: ${100 - ratio}%;`;
  });

  // Edit config state
  protected editConfig = signal<EditConfig>({});

  // Middleware library
  protected readonly middlewareLibrary = MIDDLEWARE_LIBRARY;

  constructor() {
    // Auto-validate and generate code when pipeline changes
    effect(() => {
      const p = this.pipeline();
      this.validationResult.set(this.service.validatePipeline(p));
      if (p.middlewares.length > 0) {
        this.generatedCode.set(this.service.generateCSharpCode(p));
      } else {
        this.generatedCode.set('// Add middleware to generate code');
      }
    });
  }

  // Actions
  protected addMiddleware(type: MiddlewareType, defaultConfig: MiddlewareConfig): void {
    const middlewares = this.pipeline().middlewares;
    const newMiddleware: MiddlewareNode = {
      id: crypto.randomUUID(),
      type,
      order: middlewares.length,
      config: { ...defaultConfig },
    };

    this.pipeline.update((p) => ({
      ...p,
      middlewares: [...p.middlewares, newMiddleware],
    }));
  }

  protected deleteMiddleware(id: string): void {
    this.pipeline.update((p) => ({
      ...p,
      middlewares: p.middlewares.filter((m) => m.id !== id).map((m, i) => ({ ...m, order: i })),
    }));
  }

  protected editMiddleware(middleware: MiddlewareNode): void {
    this.selectedMiddleware.set(middleware);
    this.editConfig.set(initializeEditConfig(middleware));
  }

  protected saveMiddlewareConfig(): void {
    const middleware = this.selectedMiddleware();
    if (!middleware) return;

    const newConfig = buildMiddlewareConfig(middleware.type, this.editConfig());
    const branch = buildBranch(this.editConfig());

    this.pipeline.update((p) => ({
      ...p,
      middlewares: p.middlewares.map((m) =>
        m.id === middleware.id ? { ...m, config: newConfig, branch } : m
      ),
    }));

    this.closeEditModal();
  }

  protected closeEditModal(): void {
    this.selectedMiddleware.set(null);
    this.editConfig.set({});
  }

  protected onDrop(event: CdkDragDrop<MiddlewareNode[]>): void {
    const middlewares = [...this.pipeline().middlewares];
    moveItemInArray(middlewares, event.previousIndex, event.currentIndex);

    // Update order
    const reordered = middlewares.map((m, i) => ({ ...m, order: i }));

    this.pipeline.update((p) => ({ ...p, middlewares: reordered }));
  }

  protected clearPipeline(): void {
    if (confirm('Clear the entire pipeline?')) {
      this.pipeline.update((p) => ({ ...p, middlewares: [] }));
    }
  }

  protected async copyCode(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.generatedCode());
      this.copySuccess.set(true);
      setTimeout(() => this.copySuccess.set(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  protected getMiddlewareConfigSummary(middleware: MiddlewareNode): string {
    return getMiddlewareConfigSummary(middleware);
  }

  protected getBranchConditionText(condition: BranchCondition): string {
    return getBranchConditionText(condition);
  }

  // Resize handlers
  protected startResize(event: MouseEvent): void {
    event.preventDefault();
    this.isResizing.set(true);

    const onMouseMove = (e: MouseEvent) => {
      if (!this.isResizing()) return;

      const container = (event.target as HTMLElement).closest('.flex');
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const newRatio = (offsetX / rect.width) * 100;

      // Clamp between 20% and 80% to prevent making panels too small
      const clampedRatio = Math.max(20, Math.min(80, newRatio));
      this.splitRatio.set(clampedRatio);
    };

    const onMouseUp = () => {
      this.isResizing.set(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
}
