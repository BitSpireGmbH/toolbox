import { Component, signal, computed, effect, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import {
  MiddlewareDesignerService,
  Pipeline,
  MiddlewareNode,
  MiddlewareType,
  MiddlewareConfig,
  SimulationRequest,
  MinimalAPIEndpoint,
  BranchCondition,
} from '../services/middleware-designer.service';
import { SyntaxHighlightService } from '../services/syntax-highlight.service';
import { MiddlewareLibraryItemComponent } from './components/middleware-library-item';
import { MiddlewareNodeCardComponent } from './components/middleware-node-card';
import { SimulationStepComponent } from './components/simulation-step';
import { ValidationMessagesComponent } from './components/validation-messages';
import { MiddlewareEditModalComponent } from './components/middleware-edit-modal';
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
  imports: [FormsModule, DragDropModule, MiddlewareLibraryItemComponent, MiddlewareNodeCardComponent, SimulationStepComponent, ValidationMessagesComponent, MiddlewareEditModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-[1600px] mx-auto p-6 bg-ide-panel min-h-screen">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-ide-text mb-1">Middleware Designer</h1>
          <p class="text-sm text-ide-text-muted">Build ASP.NET Core middleware pipelines visually</p>
        </div>

        <div class="flex items-center gap-3 flex-wrap">
          <button
            (click)="showLibrary.set(!showLibrary())"
            [class]="showLibrary() ? 'bg-ide-accent text-white' : 'bg-ide-sidebar text-ide-text hover:bg-ide-bg'"
            class="px-4 py-2 rounded-lg border border-ide-border font-medium text-sm transition-all flex items-center gap-2 shadow-sm">
            Library
          </button>
          <button
            (click)="showSimulation.set(!showSimulation())"
            [class]="showSimulation() ? 'bg-ide-success text-white' : 'bg-ide-sidebar text-ide-text hover:bg-ide-bg'"
            class="px-4 py-2 rounded-lg border border-ide-border font-medium text-sm transition-all flex items-center gap-2 shadow-sm">
            Simulation
          </button>

          <div class="inline-flex rounded-lg border border-ide-border bg-ide-sidebar p-0.5 shadow-sm">
            <button
              (click)="splitRatio.set(100)"
              [class]="splitRatio() === 100 ? 'bg-ide-accent text-white' : 'text-ide-text hover:bg-ide-panel'"
              class="px-3 py-2 rounded-md text-xs font-semibold transition-all"
              title="Canvas Only">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"></rect>
              </svg>
            </button>
            <button
              (click)="splitRatio.set(50)"
              [class]="splitRatio() > 0 && splitRatio() < 100 ? 'bg-ide-accent text-white' : 'text-ide-text hover:bg-ide-panel'"
              class="px-3 py-2 rounded-md text-xs font-semibold transition-all"
              title="Split View">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                <line x1="12" y1="3" x2="12" y2="21"></line>
              </svg>
            </button>
            <button
              (click)="splitRatio.set(0)"
              [class]="splitRatio() === 0 ? 'bg-ide-accent text-white' : 'text-ide-text hover:bg-ide-panel'"
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
        <div class="bg-ide-sidebar rounded-xl shadow-lg border border-ide-border p-5 mb-6">
          <div class="flex gap-2 flex-wrap items-center">
            <button
              (click)="clearPipeline()"
              class="px-3 py-2 text-sm bg-ide-panel border border-ide-border text-ide-text rounded-lg hover:bg-ide-bg transition-all font-medium flex items-center gap-1.5">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14"></path>
              </svg>
              Clear
            </button>
            @if (copySuccess()) {
              <span class="text-xs text-ide-success font-medium">✓ Copied!</span>
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
          <div class="bg-ide-sidebar rounded-xl shadow-md border border-ide-border p-5 h-fit sticky top-6">
            <h3 class="font-semibold text-sm text-ide-text mb-3">Middleware Library</h3>
            <div class="space-y-2 max-h-[800px] overflow-y-auto">
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
          <div class="flex-shrink-0 transition-all" [style]="canvasWidthStyle()">
            <div class="group relative bg-ide-sidebar rounded-xl shadow-md border border-ide-border overflow-hidden hover:shadow-lg transition-shadow h-full w-full">
          <div class="bg-ide-bg px-4 py-2.5 border-b border-ide-border flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-1.5 h-1.5 rounded-full" [class]="pipeline().middlewares.length > 0 ? 'bg-ide-success' : 'bg-ide-text-muted'"></div>
              <h3 class="font-semibold text-sm text-ide-text">Pipeline Canvas</h3>
            </div>
            <span class="text-xs text-ide-text-muted">{{ pipeline().middlewares.length }} middleware(s)</span>
          </div>

          <div [class]="splitRatio() === 100 ? 'p-4 min-h-[800px]' : 'p-4 min-h-[600px]'">
            @if (pipeline().middlewares.length === 0) {
              <div class="text-center py-20 text-ide-text-muted">
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
                    class="bg-ide-panel border rounded-lg p-3 hover:shadow-sm transition-all cursor-move"
                    [class.border-ide-accent]="selectedMiddleware()?.id === middleware.id"
                    [class.shadow-sm]="selectedMiddleware()?.id === middleware.id"
                    [class.border-ide-border]="selectedMiddleware()?.id !== middleware.id">
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
              [class]="isResizing() ? 'bg-ide-accent' : 'bg-ide-border hover:bg-ide-accent'"
              class="w-1 cursor-col-resize transition-colors flex-shrink-0 mx-2 relative group">
              <div class="absolute inset-y-0 -left-1 -right-1"></div>
            </div>
          }

        <!-- Code Output -->
        @if (splitRatio() < 100) {
        <div class="flex-shrink-0 transition-all" [style]="codeWidthStyle()">
          <div class="group relative bg-ide-bg rounded-xl shadow-md border border-ide-border overflow-hidden hover:shadow-lg transition-shadow h-full w-full">
            <div class="bg-ide-sidebar px-4 py-2.5 border-b border-ide-border flex justify-between items-center">
              <div class="flex items-center gap-2">
                <div class="w-1.5 h-1.5 rounded-full" [class]="generatedCode() ? 'bg-ide-success' : 'bg-ide-text-muted'"></div>
                <h3 class="font-semibold text-sm text-ide-text">Generated C# Code</h3>
              </div>
              <button
                (click)="copyCode()"
                [disabled]="!generatedCode()"
                class="px-3 py-1 rounded-md text-xs font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                [class]="generatedCode() ? 'text-ide-success hover:bg-ide-success/10' : 'text-ide-text-muted'">
                <span class="flex items-center gap-1.5">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  Copy
                </span>
              </button>
            </div>

            <div
              [innerHTML]="highlightedCode()"
              [class]="splitRatio() === 0 ? 'w-full h-[800px] p-4 font-mono text-sm bg-ide-bg focus:outline-none overflow-auto' : 'w-full h-[600px] p-4 font-mono text-sm bg-ide-bg focus:outline-none overflow-auto'">
            </div>

            <!-- Minimal API Endpoints -->
            @if (minimalAPIEndpoints().length > 0) {
              <div class="px-4 py-3 bg-ide-keyword/10 border-t border-ide-border">
                <h4 class="text-xs font-semibold text-ide-keyword mb-2">📍 Minimal API Endpoints</h4>
                @for (endpoint of minimalAPIEndpoints(); track endpoint.middlewareId) {
                  <div class="text-xs text-ide-text font-mono mb-1">
                    <span class="font-bold text-ide-keyword">{{ endpoint.method }}</span> {{ endpoint.path }}
                  </div>
                }
              </div>
            }
          </div>
        </div>
        }
        </div>
      </div>

        <!-- Simulation Panel -->
        @if (showSimulation()) {
          <div class="mt-5 bg-ide-sidebar rounded-xl shadow-lg border-2 border-ide-success/20 p-6">
            <h2 class="text-lg font-bold text-ide-text mb-4">Pipeline Simulation</h2>

            <div class="grid md:grid-cols-2 gap-5">
              <!-- Input -->
              <div>
                <h3 class="font-semibold text-ide-text mb-3">Request Configuration</h3>
                <div class="space-y-3">
                  <div>
                    <label class="block text-sm font-medium text-ide-text mb-1">HTTP Method</label>
                    <select
                      [(ngModel)]="simulationRequest.method"
                      class="w-full px-3 py-2 border-2 border-ide-border rounded-lg focus:outline-none focus:border-ide-accent bg-ide-panel text-ide-text">
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                      <option value="PATCH">PATCH</option>
                    </select>
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-ide-text mb-1">Path</label>
                    <input
                      type="text"
                      [(ngModel)]="simulationRequest.path"
                      class="w-full px-3 py-2 border-2 border-ide-border rounded-lg focus:outline-none focus:border-ide-accent bg-ide-panel text-ide-text"
                      placeholder="/api/users">
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-ide-text mb-1">Headers (JSON)</label>
                    <textarea
                      [(ngModel)]="simulationHeadersText"
                      class="w-full h-20 px-3 py-2 font-mono text-sm border-2 border-ide-border rounded-lg focus:outline-none focus:border-ide-accent resize-none bg-ide-panel text-ide-text"
                      placeholder='{"Authorization": "Bearer token123"}'></textarea>
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-ide-text mb-1">Body</label>
                    <textarea
                      [(ngModel)]="simulationRequest.body"
                      class="w-full h-20 px-3 py-2 font-mono text-sm border-2 border-ide-border rounded-lg focus:outline-none focus:border-ide-accent resize-none bg-ide-panel text-ide-text"
                      placeholder='{"name": "John Doe"}'></textarea>
                  </div>

                  <div class="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isAuth"
                      [(ngModel)]="simulationRequest.isAuthenticated"
                      class="w-4 h-4 text-ide-accent border-ide-border rounded focus:ring-ide-accent">
                    <label for="isAuth" class="text-sm font-medium text-ide-text">Is Authenticated</label>
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-ide-text mb-1">Claims (JSON)</label>
                    <textarea
                      [(ngModel)]="simulationClaimsText"
                      class="w-full h-20 px-3 py-2 font-mono text-sm border-2 border-ide-border rounded-lg focus:outline-none focus:border-ide-accent resize-none bg-ide-panel text-ide-text"
                      placeholder='{"role": "admin", "userId": "123"}'></textarea>
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-ide-text mb-1">Request Count (for Rate Limiting)</label>
                    <input
                      type="number"
                      [(ngModel)]="simulationRequestCount"
                      min="1"
                      max="500"
                      class="w-full px-3 py-2 border-2 border-ide-border rounded-lg focus:outline-none focus:border-ide-accent bg-ide-panel text-ide-text"
                      placeholder="1">
                    <p class="text-xs text-ide-text-muted mt-1">Simulate multiple requests to test rate limiting behavior</p>
                  </div>

                  <button
                    (click)="runSimulation()"
                    class="w-full px-4 py-2 bg-ide-accent text-white rounded-lg hover:bg-blue-800 hover:shadow-md transition-all font-medium">
                    Run Simulation
                  </button>
                </div>
              </div>

              <!-- Output -->
              <div>
                <h3 class="font-semibold text-ide-text mb-3">Execution Trace</h3>

                @if (simulationResult(); as result) {
                  <div class="space-y-3">
                    <!-- Response Summary -->
                    <div class="p-3 rounded-lg border" [class]="result.success ? 'bg-ide-success/10 border-ide-success' : 'bg-ide-error/10 border-ide-error'">
                      <p class="text-sm font-semibold" [class]="result.success ? 'text-ide-success' : 'text-ide-error'">
                        Response: {{ result.response.statusCode }} {{ result.response.statusText }}
                      </p>
                      <p class="text-xs text-ide-text-muted">
                        Duration: {{ result.duration }}ms
                      </p>
                      @if (result.response.terminated) {
                        <p class="text-xs text-ide-text-muted">
                          Terminated by: {{ result.response.terminatedBy }}
                        </p>
                      }
                    </div>

                    <!-- Steps -->
                    <div class="space-y-2 max-h-[500px] overflow-y-auto">
                      @for (step of result.steps; track step.order) {
                        <app-simulation-step
                          [order]="step.order"
                          [middlewareName]="step.middlewareName"
                          [action]="step.action"
                          [decision]="step.decision" />
                      }
                    </div>

                    <!-- Response Body -->
                    @if (result.response.body) {
                      <div class="p-3 bg-ide-bg text-ide-success font-mono text-xs rounded-lg border border-ide-border">
                        <p class="font-semibold text-ide-text mb-1">Response Body:</p>
                        <pre class="whitespace-pre-wrap">{{ result.response.body }}</pre>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="text-center py-12 text-ide-text-muted">
                    <p class="text-sm">No simulation results yet</p>
                    <p class="text-xs mt-1">Configure the request and click "Run Simulation"</p>
                  </div>
                }
              </div>
            </div>
          </div>
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
  private readonly highlightService = inject(SyntaxHighlightService);

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
  protected readonly highlightedCode = signal<string>('');
  protected readonly simulationResult = signal(null as any);
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
      return 'grid grid-cols-[300px_1fr]';
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

  // Simulation state
  protected simulationRequest: SimulationRequest = {
    method: 'GET',
    path: '/api/users',
    headers: {},
    query: {},
    body: '',
    isAuthenticated: false,
    claims: {},
    cookies: {},
  };

  protected simulationHeadersText = '{}';
  protected simulationClaimsText = '{}';
  protected simulationRequestCount = 1;

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
        const code = this.service.generateCSharpCode(p);
        this.generatedCode.set(code);
        this.highlightedCode.set(this.highlightService.highlight(code, 'csharp'));
      } else {
        const placeholderCode = '// Add middleware to generate code';
        this.generatedCode.set(placeholderCode);
        this.highlightedCode.set(this.highlightService.highlight(placeholderCode, 'csharp'));
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

  protected runSimulation(): void {
    try {
      // Parse headers and claims
      this.simulationRequest.headers = JSON.parse(this.simulationHeadersText || '{}');
      this.simulationRequest.claims = JSON.parse(this.simulationClaimsText || '{}');
    } catch (error) {
      console.error('Invalid JSON in headers or claims');
      return;
    }

    const result = this.service.simulatePipeline(this.pipeline(), this.simulationRequest, this.simulationRequestCount);
    this.simulationResult.set(result);
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
