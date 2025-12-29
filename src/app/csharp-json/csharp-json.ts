import { Component, signal, inject, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CsharpJsonConverterService } from '../services/csharp-json-converter.service';
import { CodeViewerComponent } from '../components/code-viewer';

@Component({
  selector: 'app-csharp-json',
  imports: [FormsModule, CodeViewerComponent],
  template: `
    <div class="max-w-[1600px] mx-auto p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-vscode-text mb-1">JSON → C#</h1>
          <p class="text-sm text-vscode-text-muted">Convert JSON to C# classes in real-time</p>
        </div>
        
        <button
          (click)="showOptions.set(!showOptions())"
          [class]="showOptions() ? 'bg-brand-primary text-white' : 'bg-vscode-panel text-vscode-text hover:bg-vscode-hover'"
          class="px-4 py-2 rounded-lg border border-vscode-border font-medium text-sm transition-all flex items-center gap-2 shadow-sm">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 1v6m0 6v6m6-12h6m-6 6h6M1 12h6m-6-6h6"></path>
          </svg>
          Options
        </button>
      </div>

      <!-- Options Panel -->
      @if (showOptions()) {
        <div class="bg-vscode-sidebar rounded-xl shadow-lg border border-vscode-border p-5 mb-6">
          <div class="grid grid-cols-5 gap-4">
            <div>
              <label class="block text-xs font-semibold text-vscode-text mb-2">Type Definition</label>
              <select 
                [value]="classType()"
                (change)="classType.set($any($event.target).value)"
                class="w-full px-3 py-2 text-sm border border-vscode-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary bg-vscode-panel text-vscode-text shadow-sm">
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
                class="w-full px-3 py-2 text-sm border border-vscode-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary bg-vscode-panel text-vscode-text shadow-sm">
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
                class="w-full px-3 py-2 text-sm border border-vscode-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary bg-vscode-panel text-vscode-text shadow-sm">
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
                  class="w-4 h-4 text-brand-primary border-vscode-border rounded focus:ring-2 focus:ring-brand-primary">
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
                    class="w-4 h-4 text-brand-primary border-vscode-border rounded focus:ring-2 focus:ring-brand-primary">
                  <span class="text-xs font-medium text-vscode-text">Generate Context</span>
                </label>
              </div>
            }
          </div>
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
              <h3 class="font-semibold text-sm text-vscode-text">JSON Input</h3>
            </div>
            <span class="text-xs text-vscode-text-muted">{{ inputCode().length }} chars</span>
          </div>
          <textarea
            [(ngModel)]="inputCode"
            class="w-full h-[600px] p-4 font-mono text-sm focus:outline-none resize-none bg-vscode-bg text-vscode-text code-editor"
            placeholder="Paste your JSON here...

{
  &quot;name&quot;: &quot;John Doe&quot;,
  &quot;age&quot;: 30,
  &quot;email&quot;: &quot;john@example.com&quot;
}"
          ></textarea>
        </div>

        <!-- Output Panel with Syntax Highlighting -->
        <app-code-viewer 
          [code]="displayCode()"
          [language]="'csharp'"
          [title]="'C# Output'"
          [placeholder]="errorMessage() || 'C# class will appear here automatically...'"
          [height]="600"
          [showLineNumbers]="true" />
      </div>
    </div>
  `,
  styles: []
})
export class CsharpJsonComponent {
  private readonly converterService = inject(CsharpJsonConverterService);

  protected readonly classType = signal<string>('class');
  protected readonly enumerationType = signal<string>('List<T>');
  protected readonly serializer = signal<string>('System.Text.Json');
  protected readonly convertSnakeCase = signal<boolean>(false);
  protected readonly generateSerializerContext = signal<boolean>(false);
  protected readonly showOptions = signal<boolean>(true);
  
  protected readonly inputCode = signal<string>('');
  protected readonly outputCode = signal<string>('');
  protected readonly errorMessage = signal<string>('');

  // Computed property for displaying code (either output or error)
  protected readonly displayCode = signal<string>('');

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

  protected convert(): void {
    this.errorMessage.set('');
    this.outputCode.set('');

    try {
      const options = {
        classType: this.classType() as any,
        enumerationType: this.enumerationType() as any,
        serializer: this.serializer() as any,
        namespace: undefined,
        convertSnakeCase: this.convertSnakeCase(),
        generateSerializerContext: this.generateSerializerContext()
      };
      const result = this.converterService.jsonToCsharp(this.inputCode(), options, 'GeneratedClass');
      this.outputCode.set(result);
      this.displayCode.set(result);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'An error occurred during conversion';
      this.errorMessage.set(errorMsg);
      this.displayCode.set(`// Error: ${errorMsg}`);
    }
  }
}
