import { Component, signal, inject, effect, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CsharpTypescriptConverterService } from '../services/csharp-typescript-converter.service';
import { CodeViewerComponent } from '../components/code-viewer';

@Component({
  selector: 'app-csharp-typescript',
  imports: [FormsModule, CodeViewerComponent],
  template: `
    <div class="max-w-[1600px] mx-auto p-6">
      <!-- Header with Direction Toggle -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-vscode-text mb-1">C# ↔ TypeScript</h1>
          <p class="text-sm text-vscode-text-muted">Real-time bidirectional conversion</p>
        </div>
        
        <div class="flex items-center gap-3">
          <!-- Options Button -->
          <button
            (click)="showOptions.set(!showOptions())"
            [class]="showOptions() ? 'bg-brand-secondary text-white' : 'bg-vscode-panel text-vscode-text hover:bg-vscode-hover'"
            class="px-4 py-2 rounded-lg border border-vscode-border font-medium text-sm transition-all flex items-center gap-2 shadow-sm">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v6m0 6v6m6-12h6m-6 6h6M1 12h6m-6-6h6"></path>
            </svg>
            Options
          </button>
          
          <!-- Direction Toggle -->
          <div class="inline-flex rounded-lg border border-vscode-border bg-vscode-panel p-0.5 shadow-sm">
            <button
              (click)="switchDirection('csharp-to-typescript')"
              [class]="direction() === 'csharp-to-typescript' ? 'bg-brand-secondary text-white shadow-sm' : 'text-vscode-text hover:bg-vscode-hover'"
              class="px-5 py-2 rounded-md font-semibold text-sm transition-all">
              C# → TS
            </button>
            <button
              (click)="switchDirection('typescript-to-csharp')"
              [class]="direction() === 'typescript-to-csharp' ? 'bg-brand-secondary text-white shadow-sm' : 'text-vscode-text hover:bg-vscode-hover'"
              class="px-5 py-2 rounded-md font-semibold text-sm transition-all">
              TS → C#
            </button>
          </div>
        </div>
      </div>

      <!-- Options Panel -->
      @if (showOptions()) {
        <div class="bg-vscode-sidebar rounded-xl shadow-lg border border-vscode-border p-5 mb-6">
          @if (direction() === 'csharp-to-typescript') {
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-vscode-text mb-2">Export Type</label>
                <select 
                  [value]="exportType()"
                  (change)="exportType.set($any($event.target).value)"
                  class="w-full px-3 py-2 text-sm border border-vscode-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary bg-vscode-panel text-vscode-text shadow-sm">
                  <option value="interface">Interface</option>
                  <option value="type">Type Alias</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-semibold text-vscode-text mb-2">DateTime(Offset) as</label>
                <select 
                  [value]="dateTimeType()"
                  (change)="dateTimeType.set($any($event.target).value)"
                  class="w-full px-3 py-2 text-sm border border-vscode-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary bg-vscode-panel text-vscode-text shadow-sm">
                  <option value="string">string</option>
                  <option value="Date">Date</option>
                </select>
              </div>
            </div>
          } @else {
            <div class="grid grid-cols-5 gap-4">
              <div>
                <label class="block text-xs font-semibold text-vscode-text mb-2">Type Definition</label>
                <select 
                  [value]="classType()"
                  (change)="classType.set($any($event.target).value)"
                  class="w-full px-3 py-2 text-sm border border-vscode-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary bg-vscode-panel text-vscode-text shadow-sm">
                  <option value="class">Class</option>
                  <option value="record">Record</option>
                  <option value="struct">Struct</option>
                  <option value="record struct">Record Struct</option>
                  <option value="readonly record struct">Readonly Record Struct</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-semibold text-vscode-text mb-2">Collection Type</label>
                <select 
                  [value]="enumerationType()"
                  (change)="enumerationType.set($any($event.target).value)"
                  class="w-full px-3 py-2 text-sm border border-vscode-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary bg-vscode-panel text-vscode-text shadow-sm">
                  <option value="List<T>">List&lt;T&gt;</option>
                  <option value="IReadOnlyCollection<T>">IReadOnlyCollection&lt;T&gt;</option>
                  <option value="T[]">T[]</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-semibold text-vscode-text mb-2">Serializer</label>
                <select 
                  [value]="serializer()"
                  (change)="serializer.set($any($event.target).value)"
                  class="w-full px-3 py-2 text-sm border border-vscode-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary bg-vscode-panel text-vscode-text shadow-sm">
                  <option value="System.Text.Json">System.Text.Json</option>
                  <option value="Newtonsoft.Json">Newtonsoft.Json</option>
                </select>
              </div>

              <div class="flex flex-col justify-end">
                <label class="flex items-center gap-2 cursor-pointer px-3 py-2 hover:bg-vscode-hover rounded-lg transition-colors">
                  <input 
                    type="checkbox"
                    [checked]="convertSnakeCase()"
                    (change)="convertSnakeCase.set($any($event.target).checked)"
                    class="w-4 h-4 text-brand-secondary border-vscode-border rounded focus:ring-2 focus:ring-brand-secondary">
                  <span class="text-xs font-medium text-vscode-text">snake_case → PascalCase</span>
                </label>
              </div>

              @if (serializer() === 'System.Text.Json') {
                <div class="flex flex-col justify-end">
                  <label class="flex items-center gap-2 cursor-pointer px-3 py-2 hover:bg-vscode-hover rounded-lg transition-colors">
                    <input 
                      type="checkbox"
                      [checked]="generateSerializerContext()"
                      (change)="generateSerializerContext.set($any($event.target).checked)"
                      class="w-4 h-4 text-brand-secondary border-vscode-border rounded focus:ring-2 focus:ring-brand-secondary">
                    <span class="text-xs font-medium text-vscode-text">Generate Context</span>
                  </label>
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- Converter Area -->
      <div class="grid md:grid-cols-2 gap-5">
        <!-- Input Panel -->
        <div class="group relative bg-vscode-sidebar rounded-xl shadow-md border border-vscode-border overflow-hidden hover:shadow-lg transition-shadow">
          <div class="panel-header px-4 py-2.5 border-b border-vscode-border flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span 
                class="status-dot"
                [class.active]="inputCode()"
                [class.inactive]="!inputCode()">
              </span>
              <h3 class="font-semibold text-sm text-vscode-text">
                @if (direction() === 'csharp-to-typescript') {
                  C# Input
                } @else {
                  TypeScript Input
                }
              </h3>
            </div>
            <span class="text-xs text-vscode-text-muted">{{ inputCode().length }} chars</span>
          </div>
          <textarea
            [(ngModel)]="inputCode"
            class="w-full h-[600px] p-4 font-mono text-sm focus:outline-none resize-none bg-vscode-bg text-vscode-text code-editor"
            [placeholder]="direction() === 'csharp-to-typescript' ? 'Paste your C# class here...' : 'Paste your TypeScript interface here...'"
          ></textarea>
        </div>

        <!-- Output Panel with Syntax Highlighting -->
        <app-code-viewer 
          [code]="displayCode()"
          [language]="outputLanguage()"
          [title]="outputTitle()"
          [placeholder]="errorMessage() || 'Converted output will appear here automatically...'"
          [height]="600"
          [showLineNumbers]="true" />
      </div>
    </div>
  `,
  styles: []
})
export class CsharpTypescriptComponent {
  private readonly converterService = inject(CsharpTypescriptConverterService);

  protected readonly direction = signal<'csharp-to-typescript' | 'typescript-to-csharp'>('csharp-to-typescript');
  
  // C# → TypeScript options
  protected readonly exportType = signal<string>('interface');
  protected readonly dateTimeType = signal<string>('string');
  
  // TypeScript → C# options
  protected readonly classType = signal<string>('class');
  protected readonly enumerationType = signal<string>('List<T>');
  protected readonly serializer = signal<string>('System.Text.Json');
  protected readonly convertSnakeCase = signal<boolean>(false);
  protected readonly generateSerializerContext = signal<boolean>(false);
  
  protected readonly showOptions = signal<boolean>(true);
  protected readonly inputCode = signal<string>('');
  protected readonly outputCode = signal<string>('');
  protected readonly errorMessage = signal<string>('');
  protected readonly displayCode = signal<string>('');

  // Computed properties for output panel
  protected readonly outputLanguage = computed<'csharp' | 'typescript'>(() => {
    return this.direction() === 'csharp-to-typescript' ? 'typescript' : 'csharp';
  });

  protected readonly outputTitle = computed(() => {
    return this.direction() === 'csharp-to-typescript' ? 'TypeScript Output' : 'C# Output';
  });

  constructor() {
    // Auto-convert on input change
    effect(() => {
      const input = this.inputCode();
      if (input.trim()) {
        this.convert();
      } else {
        this.outputCode.set('');
        this.errorMessage.set('');
        this.displayCode.set('');
      }
    });
  }

  protected switchDirection(newDirection: 'csharp-to-typescript' | 'typescript-to-csharp'): void {
    this.direction.set(newDirection);
    // Swap input/output
    const temp = this.inputCode();
    this.inputCode.set(this.outputCode());
    this.outputCode.set(temp);
  }

  protected convert(): void {
    this.errorMessage.set('');
    this.outputCode.set('');

    try {
      if (this.direction() === 'csharp-to-typescript') {
        const options = {
          exportType: this.exportType() as any,
          dateTimeType: this.dateTimeType() as any
        };
        const result = this.converterService.csharpToTypescript(this.inputCode(), options);
        this.outputCode.set(result);
        this.displayCode.set(result);
      } else {
        const options = {
          classType: this.classType() as any,
          enumerationType: this.enumerationType() as any,
          serializer: this.serializer() as any,
          namespace: undefined,
          convertSnakeCase: this.convertSnakeCase(),
          generateSerializerContext: this.generateSerializerContext()
        };
        const result = this.converterService.typescriptToCsharp(this.inputCode(), options);
        this.outputCode.set(result);
        this.displayCode.set(result);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'An error occurred during conversion';
      this.errorMessage.set(errorMsg);
      // Use appropriate comment syntax based on output language
      const commentPrefix = this.direction() === 'csharp-to-typescript' ? '//' : '//';
      this.displayCode.set(`${commentPrefix} Error: ${errorMsg}`);
    }
  }
}
