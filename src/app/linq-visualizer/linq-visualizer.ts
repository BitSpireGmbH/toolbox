import { Component, signal, computed, effect, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import {
  LinqVisualizerService,
  DataItem,
  OperatorConfig,
  OperatorDefinition,
  ExecutionStep,
} from '../services/linq-visualizer.service';

@Component({
  selector: 'app-linq-visualizer',
  imports: [FormsModule, DragDropModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-400 mx-auto p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-1">LINQ Query Visualizer</h1>
          <p class="text-sm text-gray-600">
            Visualize LINQ queries with interactive marble diagrams
          </p>
        </div>

        <div class="flex items-center gap-3">
          <button
            (click)="showLibrary.set(!showLibrary())"
            [class]="
              showLibrary()
                ? 'bg-brand-primary text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            "
            class="px-4 py-2 rounded-lg border border-gray-300 font-medium text-sm transition-all flex items-center gap-2 shadow-sm">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            Operators
          </button>

          <button
            (click)="runVisualization()"
            [disabled]="operators().length === 0"
            class="px-4 py-2 bg-brand-secondary text-white rounded-lg hover:bg-purple-700 font-medium text-sm transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Run
          </button>
        </div>
      </div>

      <!-- Main Layout -->
      <div class="gap-5" [class]="gridLayoutClass()">
        <!-- Operator Library -->
        @if (showLibrary()) {
          <div class="bg-white rounded-xl shadow-md border border-gray-200 p-5 h-fit sticky top-6">
            <h3 class="font-semibold text-sm text-gray-700 mb-3">Operator Library</h3>

            <!-- Category Filters -->
            <div class="flex flex-wrap gap-2 mb-4">
              @for (cat of categories; track cat) {
                <button
                  (click)="selectedCategory.set(cat)"
                  [class]="
                    selectedCategory() === cat
                      ? 'bg-brand-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  "
                  class="px-2 py-1 rounded text-xs font-medium transition-all">
                  {{ cat }}
                </button>
              }
            </div>

            <!-- Operators -->
            <div class="space-y-2 max-h-150 overflow-y-auto">
              @for (op of filteredOperators(); track op.type) {
                <button
                  (click)="addOperator(op.type)"
                  class="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-brand-primary hover:shadow-sm transition-all bg-white">
                  <div class="flex items-center gap-2 mb-1">
                    <div [class]="op.color" class="w-2 h-2 rounded-full"></div>
                    <span class="font-semibold text-sm text-gray-900">{{ op.name }}</span>
                  </div>
                  <p class="text-xs text-gray-600">{{ op.description }}</p>
                </button>
              }
            </div>
          </div>
        }

        <!-- Main Content -->
        <div class="space-y-5">
          <!-- Input Data Configuration -->
          <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <div
              class="bg-linear-to-r from-gray-50 to-gray-100 px-4 py-2.5 border-b border-gray-200">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  <h3 class="font-semibold text-sm text-gray-700">Input Data</h3>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    (click)="generateData()"
                    class="text-xs px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-all font-medium">
                    Generate Random
                  </button>
                  <button
                    (click)="clearData()"
                    class="text-xs px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-all font-medium">
                    Clear
                  </button>
                </div>
              </div>
            </div>
            <div class="p-4">
              <div class="flex flex-wrap gap-2">
                @for (item of inputData(); track item.id) {
                  <div
                    class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2"
                    [style]="'border-color: ' + item.color + '; background-color: ' + item.color + '20'">
                    <div [class]="getShapeClass(item.shape)" [style]="'background-color: ' + item.color"></div>
                    <span class="font-mono text-sm font-semibold">{{ item.value }}</span>
                    <button
                      (click)="removeDataItem(item.id)"
                      class="ml-1 text-gray-500 hover:text-red-600 transition-colors">
                      <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18M6 6l12 12"></path>
                      </svg>
                    </button>
                  </div>
                }
                @if (inputData().length === 0) {
                  <p class="text-sm text-gray-500 py-4">
                    No data items. Click "Generate Random" to create sample data.
                  </p>
                }
              </div>

              <!-- Add Data Form -->
              <div class="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div class="grid grid-cols-4 gap-2">
                  <input
                    type="number"
                    [(ngModel)]="newItemValue"
                    placeholder="Value"
                    class="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-brand-primary" />
                  <select
                    [(ngModel)]="newItemColor"
                    class="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-brand-primary">
                    <option value="#3b82f6">Blue</option>
                    <option value="#ef4444">Red</option>
                    <option value="#22c55e">Green</option>
                    <option value="#f59e0b">Orange</option>
                    <option value="#8b5cf6">Purple</option>
                    <option value="#ec4899">Pink</option>
                  </select>
                  <select
                    [(ngModel)]="newItemShape"
                    class="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-brand-primary">
                    <option value="circle">Circle</option>
                    <option value="square">Square</option>
                    <option value="triangle">Triangle</option>
                    <option value="star">Star</option>
                  </select>
                  <button
                    (click)="addDataItem()"
                    class="px-2 py-1 text-sm bg-brand-primary text-white rounded hover:bg-blue-700 transition-all font-medium">
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Query Builder -->
          <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <div
              class="bg-linear-to-r from-purple-50 to-purple-100 px-4 py-2.5 border-b border-purple-200">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                  <h3 class="font-semibold text-sm text-gray-800">Query Pipeline</h3>
                </div>
                <span class="text-xs text-gray-600">{{ operators().length }} operator(s)</span>
              </div>
            </div>
            <div class="p-4">
              @if (operators().length === 0) {
                <div class="text-center py-12 text-gray-500">
                  <p class="text-sm font-medium">No operators added</p>
                  <p class="text-xs mt-1">Add operators from the library to build your query</p>
                </div>
              } @else {
                <div cdkDropList (cdkDropListDropped)="onDrop($event)" class="space-y-2">
                  @for (op of operators(); track $index) {
                    <div
                      cdkDrag
                      class="bg-gray-50 border-2 border-gray-200 rounded-lg p-3 hover:shadow-sm transition-all cursor-move">
                      <div class="flex items-start gap-3">
                        <div class="shrink-0 mt-1">
                          <div
                            [class]="getOperatorColor(op.type)"
                            class="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                            {{ $index + 1 }}
                          </div>
                        </div>
                        <div class="flex-1">
                          <div class="flex items-center justify-between mb-2">
                            <h4 class="font-semibold text-sm text-gray-900">
                              {{ getOperatorName(op.type) }}
                            </h4>
                            <button
                              (click)="removeOperator($index)"
                              class="text-gray-400 hover:text-red-600 transition-colors">
                              <svg
                                class="w-4 h-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2">
                                <path d="M18 6L6 18M6 6l12 12"></path>
                              </svg>
                            </button>
                          </div>
                          @if (requiresParam(op.type)) {
                            <input
                              type="text"
                              [(ngModel)]="op.params"
                              [placeholder]="getParamLabel(op.type)"
                              class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-brand-primary font-mono" />
                          }
                        </div>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Visualization -->
          @if (queryResult()) {
            <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
              <div
                class="bg-linear-to-r from-green-50 to-green-100 px-4 py-2.5 border-b border-green-200">
                <div class="flex items-center gap-2">
                  <div class="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                  <h3 class="font-semibold text-sm text-gray-800">Execution Visualization</h3>
                </div>
              </div>
              <div class="p-4 space-y-4">
                @for (step of queryResult()!.steps; track $index) {
                  <div class="border-l-4 pl-4" [style]="'border-color: ' + getOperatorColorHex(step.operatorType)">
                    <div class="flex items-center gap-2 mb-2">
                      <span class="font-semibold text-sm text-gray-900">
                        {{ $index + 1 }}. {{ step.operatorName }}
                      </span>
                    </div>
                    <p class="text-xs text-gray-600 mb-3">{{ step.description }}</p>

                    <!-- Input Stream -->
                    <div class="mb-2">
                      <p class="text-xs font-semibold text-gray-500 mb-1">Input:</p>
                      <div class="flex flex-wrap gap-2">
                        @for (item of step.inputItems; track item.id) {
                          <div
                            class="inline-flex items-center gap-1.5 px-2 py-1 rounded border"
                            [style]="'border-color: ' + item.color + '; background-color: ' + item.color + '10'">
                            <div [class]="getShapeClass(item.shape, 'sm')" [style]="'background-color: ' + item.color"></div>
                            <span class="font-mono text-xs font-semibold">{{ formatValue(item.value) }}</span>
                          </div>
                        }
                      </div>
                    </div>

                    <!-- Arrow -->
                    <div class="flex items-center gap-2 my-2 ml-4">
                      <svg
                        class="w-4 h-4 text-gray-400"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2">
                        <path d="M12 5v14M19 12l-7 7-7-7"></path>
                      </svg>
                    </div>

                    <!-- Output Stream -->
                    <div>
                      <p class="text-xs font-semibold text-gray-500 mb-1">Output:</p>
                      <div class="flex flex-wrap gap-2">
                        @for (item of step.outputItems; track item.id) {
                          <div
                            class="inline-flex items-center gap-1.5 px-2 py-1 rounded border"
                            [style]="'border-color: ' + item.color + '; background-color: ' + item.color + '10'">
                            <div [class]="getShapeClass(item.shape, 'sm')" [style]="'background-color: ' + item.color"></div>
                            <span class="font-mono text-xs font-semibold">{{ formatValue(item.value) }}</span>
                          </div>
                        }
                        @if (step.outputItems.length === 0) {
                          <span class="text-xs text-gray-400 italic">Empty sequence</span>
                        }
                      </div>
                    </div>
                  </div>
                }
              </div>
            </div>

            <!-- Generated Code -->
            <div class="bg-gray-900 rounded-xl shadow-md border border-gray-700 overflow-hidden">
              <div
                class="bg-linear-to-r from-gray-800 to-gray-900 px-4 py-2.5 border-b border-gray-700 flex justify-between items-center">
                <div class="flex items-center gap-2">
                  <div class="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                  <h3 class="font-semibold text-sm text-gray-200">Generated C# LINQ Code</h3>
                </div>
                <button
                  (click)="copyCode()"
                  class="px-3 py-1 rounded-md text-xs font-semibold transition-all text-green-400 hover:bg-green-400/10">
                  <span class="flex items-center gap-1.5">
                    <svg
                      class="w-3.5 h-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    {{ copySuccess() ? 'Copied!' : 'Copy' }}
                  </span>
                </button>
              </div>
              <div class="p-4">
                <pre
                  class="font-mono text-sm text-green-400 whitespace-pre-wrap">{{ queryResult()!.generatedCode }}</pre>
              </div>
            </div>
          }

          <!-- Info Panel -->
          <div
            class="bg-linear-to-br from-blue-50 to-purple-50 rounded-xl shadow-md border border-blue-200 p-5">
            <div class="flex items-start gap-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="w-5 h-5 text-blue-600 shrink-0 mt-0.5">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
              </svg>
              <div class="flex-1">
                <h4 class="font-semibold text-sm text-gray-900 mb-2">About LINQ Visualizer</h4>
                <div class="text-xs text-gray-700 space-y-2 leading-relaxed">
                  <p>
                    <strong>LINQ (Language-Integrated Query)</strong> is a powerful feature in C# that
                    allows you to query and transform data using a SQL-like syntax. This visualizer
                    helps you understand how LINQ operators work by showing the data flow through
                    each step.
                  </p>
                  <p>
                    Each colored shape represents a data item. As you add operators, you can see how
                    they filter, transform, or aggregate your data in real-time.
                  </p>
                  <p>
                    <strong>Tips:</strong> Try combining operators like Where → Select → OrderBy to
                    build complex queries. The generated C# code can be copied and used directly in
                    your projects.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [],
})
export class LinqVisualizerComponent {
  private readonly service = inject(LinqVisualizerService);

  // State
  protected readonly inputData = signal<DataItem[]>([]);
  protected readonly operators = signal<OperatorConfig[]>([]);
  protected readonly queryResult = signal<any>(null);
  protected readonly showLibrary = signal<boolean>(true);
  protected readonly selectedCategory = signal<string>('all');
  protected readonly copySuccess = signal<boolean>(false);

  // New item form
  protected newItemValue = 0;
  protected newItemColor = '#3b82f6';
  protected newItemShape: 'circle' | 'square' | 'triangle' | 'star' = 'circle';

  // Computed
  protected readonly categories = ['all', 'filtering', 'projection', 'ordering', 'aggregation', 'quantifier'];

  protected readonly filteredOperators = computed(() => {
    const category = this.selectedCategory();
    if (category === 'all') {
      return this.service.operatorDefinitions;
    }
    return this.service.operatorDefinitions.filter((op) => op.category === category);
  });

  protected readonly gridLayoutClass = computed(() => {
    return this.showLibrary() ? 'grid grid-cols-[280px_1fr]' : 'grid grid-cols-1';
  });

  constructor() {
    // Generate initial sample data
    this.generateData();
  }

  protected generateData(): void {
    this.inputData.set(this.service.generateSampleData(10));
  }

  protected clearData(): void {
    this.inputData.set([]);
  }

  protected addDataItem(): void {
    const newItem: DataItem = {
      id: crypto.randomUUID(),
      value: this.newItemValue,
      color: this.newItemColor,
      shape: this.newItemShape,
    };
    this.inputData.update((items) => [...items, newItem]);
  }

  protected removeDataItem(id: string): void {
    this.inputData.update((items) => items.filter((item) => item.id !== id));
  }

  protected addOperator(type: string): void {
    const op = this.service.operatorDefinitions.find((o) => o.type === type);
    const newOp: OperatorConfig = {
      type: type as any,
      params: op?.requiresParam ? (op.paramType === 'number' ? 1 : '') : undefined,
    };
    this.operators.update((ops) => [...ops, newOp]);
  }

  protected removeOperator(index: number): void {
    this.operators.update((ops) => ops.filter((_, i) => i !== index));
  }

  protected onDrop(event: CdkDragDrop<OperatorConfig[]>): void {
    const ops = [...this.operators()];
    moveItemInArray(ops, event.previousIndex, event.currentIndex);
    this.operators.set(ops);
  }

  protected runVisualization(): void {
    try {
      const result = this.service.executeQuery(this.inputData(), this.operators());
      this.queryResult.set(result);
    } catch (error) {
      console.error('Error executing query:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  protected async copyCode(): Promise<void> {
    try {
      const code = this.queryResult()?.generatedCode;
      if (code) {
        await navigator.clipboard.writeText(code);
        this.copySuccess.set(true);
        setTimeout(() => this.copySuccess.set(false), 2000);
      }
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  protected getOperatorName(type: string): string {
    return this.service.operatorDefinitions.find((op) => op.type === type)?.name || type;
  }

  protected getOperatorColor(type: string): string {
    return this.service.operatorDefinitions.find((op) => op.type === type)?.color || 'bg-gray-500';
  }

  protected getOperatorColorHex(type: string): string {
    const color = this.getOperatorColor(type);
    // Map Tailwind colors to hex
    const colorMap: Record<string, string> = {
      'bg-blue-500': '#3b82f6',
      'bg-purple-500': '#8b5cf6',
      'bg-green-500': '#22c55e',
      'bg-green-600': '#16a34a',
      'bg-orange-500': '#f97316',
      'bg-orange-600': '#ea580c',
      'bg-red-500': '#ef4444',
      'bg-red-400': '#f87171',
      'bg-cyan-500': '#06b6d4',
      'bg-pink-500': '#ec4899',
      'bg-indigo-500': '#6366f1',
      'bg-indigo-600': '#4f46e5',
    };
    return colorMap[color] || '#6b7280';
  }

  protected requiresParam(type: string): boolean {
    return this.service.operatorDefinitions.find((op) => op.type === type)?.requiresParam || false;
  }

  protected getParamLabel(type: string): string {
    return (
      this.service.operatorDefinitions.find((op) => op.type === type)?.paramLabel ||
      'Enter parameter'
    );
  }

  protected getShapeClass(shape: string, size: 'sm' | 'md' = 'md'): string {
    const sizeClass = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
    switch (shape) {
      case 'circle':
        return `${sizeClass} rounded-full`;
      case 'square':
        return `${sizeClass} rounded-sm`;
      case 'triangle':
        return `${sizeClass} triangle`;
      case 'star':
        return `${sizeClass} star`;
      default:
        return `${sizeClass} rounded-full`;
    }
  }

  protected formatValue(value: any): string {
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }
}
