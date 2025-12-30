import { Component, signal, inject, effect, ChangeDetectionStrategy, ElementRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TaskVisualizerService, type AsyncPattern, type VisualizationResult } from '../services/task-visualizer.service';
import mermaid from 'mermaid';

@Component({
  selector: 'app-task-visualizer',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-400 mx-auto p-6">
      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 mb-1">Task Visualizer</h1>
        <p class="text-sm text-gray-600">Visualize C# async/await execution flow</p>
      </div>

      <!-- Example Buttons -->
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">Try an example:</label>
        <div class="flex flex-wrap gap-2">
          @for (example of examples; track example.title) {
            <button
              (click)="loadExample(example.code)"
              class="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              type="button">
              {{ example.title }}
            </button>
          }
        </div>
      </div>

      <!-- Input Area -->
      <div class="mb-6">
        <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div class="bg-linear-to-r from-gray-50 to-gray-100 px-4 py-2.5 border-b border-gray-200">
            <div class="flex items-center gap-2">
              <div class="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
              <h3 class="font-semibold text-sm text-gray-700">C# Async Code</h3>
            </div>
          </div>
          <textarea
            [(ngModel)]="inputCode"
            class="w-full h-64 p-4 font-mono text-sm focus:outline-none resize-none bg-gray-50/50"
            placeholder="Paste your C# async code here...

Example:
public async Task<string> FetchDataAsync()
{
    var response = await httpClient.GetStringAsync(url);
    return response;
}"
          ></textarea>
        </div>
        @if (errorMessage()) {
          <div class="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <svg class="w-5 h-5 text-red-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <p class="text-sm text-red-700">{{ errorMessage() }}</p>
          </div>
        }
      </div>

      @if (visualization()?.diagram) {
        <!-- Visualization Area -->
        <div class="mb-6">
          <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <div class="bg-linear-to-r from-purple-50 to-purple-100 px-4 py-3 border-b border-purple-200">
              <div class="flex items-center gap-2">
                <div class="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                <h3 class="font-semibold text-sm text-gray-800">Execution Flow</h3>
              </div>
            </div>
            <div class="p-6 bg-gray-50 overflow-x-auto">
              <div #mermaidContainer class="flex justify-center"></div>
            </div>
          </div>
        </div>

        <!-- Legend -->
        <div class="mb-6 bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div class="bg-linear-to-r from-gray-50 to-gray-100 px-4 py-3 border-b border-gray-200">
            <div class="flex items-center gap-2">
              <div class="w-1.5 h-1.5 rounded-full bg-gray-500"></div>
              <h3 class="font-semibold text-sm text-gray-800">Legend</h3>
            </div>
          </div>
          <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="flex items-center gap-3">
              <div class="w-4 h-4 bg-blue-200 border-2 border-blue-500 rounded"></div>
              <span class="text-sm text-gray-700">⏸️ Pauses execution (await)</span>
            </div>
            <div class="flex items-center gap-3">
              <div class="w-4 h-4 bg-green-200 border-2 border-green-500 rounded"></div>
              <span class="text-sm text-gray-700">✅ Continues immediately</span>
            </div>
            <div class="flex items-center gap-3">
              <div class="w-4 h-4 bg-yellow-200 border-2 border-yellow-600 rounded"></div>
              <span class="text-sm text-gray-700">⏳ Task executing</span>
            </div>
            <div class="flex items-center gap-3">
              <div class="w-4 h-4 bg-red-200 border-2 border-red-500 rounded"></div>
              <span class="text-sm text-gray-700">⛔ Blocks thread (danger!)</span>
            </div>
            <div class="flex items-center gap-3">
              <div class="w-4 h-4 bg-purple-200 border-2 border-purple-500 rounded"></div>
              <span class="text-sm text-gray-700">🔄 Background task</span>
            </div>
          </div>
        </div>

        <!-- Patterns Detected -->
        @if (visualization()?.patterns && visualization()!.patterns.length > 0) {
          <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <div class="bg-linear-to-r from-blue-50 to-blue-100 px-4 py-3 border-b border-blue-200">
              <div class="flex items-center gap-2">
                <div class="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                <h3 class="font-semibold text-sm text-gray-800">Async Patterns Detected</h3>
              </div>
            </div>
            <div class="p-4 space-y-3">
              @for (pattern of visualization()!.patterns; track pattern.line) {
                <div class="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div class="flex items-start justify-between mb-2">
                    <div class="flex items-center gap-2">
                      <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                            [class]="getPatternColorClass(pattern.type)">
                        {{ getPatternLabel(pattern.type) }}
                      </span>
                      <span class="text-xs text-gray-500">Line {{ pattern.line }}</span>
                    </div>
                  </div>
                  <code class="block text-xs font-mono text-gray-800 mb-2 p-2 bg-white rounded border border-gray-200 overflow-x-auto">{{ pattern.code }}</code>
                  <p class="text-xs text-gray-600">{{ pattern.description }}</p>
                </div>
              }
            </div>
          </div>
        }
      }

      <!-- Info Panel -->
      <div class="mt-6 bg-linear-to-br from-blue-50 to-purple-50 rounded-xl shadow-md border border-blue-200 p-5">
        <div class="flex items-start gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-blue-600 shrink-0 mt-0.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
          <div class="flex-1">
            <h4 class="font-semibold text-sm text-gray-900 mb-2">About Async/Await in C#</h4>
            <div class="text-xs text-gray-700 space-y-2 leading-relaxed">
              <p>
                <strong>async/await</strong> makes asynchronous code look synchronous. When you <strong>await</strong> a task, 
                execution pauses at that point and returns control to the caller. When the task completes, execution resumes.
              </p>
              <p>
                <strong>Without await</strong>, the task runs but your code continues immediately (fire-and-forget). 
                This is useful but can lead to missed errors or uncompleted work.
              </p>
              <p>
                <strong>Task.WhenAll</strong> waits for all tasks to complete. <strong>Task.WhenAny</strong> waits for the first one.
                Remember: they only wait if you <strong>await</strong> them!
              </p>
              <p>
                <strong>⚠️ Warning:</strong> Using <code>.Result</code>, <code>.GetAwaiter().GetResult()</code>, or <code>.Wait()</code> 
                blocks the thread and can cause deadlocks. Always prefer <code>await</code> when possible.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class TaskVisualizerComponent {
  private readonly visualizerService = inject(TaskVisualizerService);
  private readonly mermaidContainer = viewChild<ElementRef>('mermaidContainer');

  protected readonly inputCode = signal<string>('');
  protected readonly visualization = signal<VisualizationResult | null>(null);
  protected readonly errorMessage = signal<string>('');
  protected readonly examples = this.visualizerService.getExamples();

  constructor() {
    // Initialize mermaid
    mermaid.initialize({ 
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis'
      }
    });

    // Auto-analyze on input change
    effect(() => {
      const input = this.inputCode();
      if (input.trim()) {
        this.analyzeCode();
      } else {
        this.visualization.set(null);
        this.errorMessage.set('');
      }
    });

    // Render mermaid diagram when visualization changes
    effect(() => {
      const viz = this.visualization();
      const container = this.mermaidContainer();
      
      if (viz?.diagram && container) {
        this.renderMermaid(viz.diagram, container.nativeElement);
      }
    });
  }

  protected analyzeCode(): void {
    this.errorMessage.set('');

    try {
      const result = this.visualizerService.analyzeCode(this.inputCode());
      
      if (result.error) {
        this.errorMessage.set(result.error);
        this.visualization.set(null);
      } else {
        this.visualization.set(result);
      }
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'An error occurred while analyzing the code');
      this.visualization.set(null);
    }
  }

  protected loadExample(code: string): void {
    this.inputCode.set(code);
  }

  private async renderMermaid(diagram: string, container: HTMLElement): Promise<void> {
    try {
      // Clear previous diagram
      container.innerHTML = '';
      
      // Generate unique ID for this diagram
      const id = `mermaid-${Date.now()}`;
      
      // Render the diagram
      const { svg } = await mermaid.render(id, diagram);
      container.innerHTML = svg;
    } catch (error) {
      console.error('Error rendering mermaid diagram:', error);
      container.innerHTML = '<p class="text-red-600 text-sm">Error rendering diagram</p>';
    }
  }

  protected getPatternLabel(type: string): string {
    const labels: Record<string, string> = {
      'await': 'AWAIT',
      'whenall': 'TASK.WHENALL',
      'whenany': 'TASK.WHENANY',
      'getawaiter': 'BLOCKING CALL',
      'task': 'FIRE-AND-FORGET',
      'continuation': 'CONTINUATION'
    };
    return labels[type] || type.toUpperCase();
  }

  protected getPatternColorClass(type: string): string {
    const classes: Record<string, string> = {
      'await': 'bg-blue-100 text-blue-700',
      'whenall': 'bg-blue-100 text-blue-700',
      'whenany': 'bg-blue-100 text-blue-700',
      'getawaiter': 'bg-red-100 text-red-700',
      'task': 'bg-green-100 text-green-700',
      'continuation': 'bg-purple-100 text-purple-700'
    };
    return classes[type] || 'bg-gray-100 text-gray-700';
  }
}
