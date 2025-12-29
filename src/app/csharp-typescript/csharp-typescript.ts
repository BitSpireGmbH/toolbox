import { Component, signal, inject, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CsharpTypescriptConverterService } from '../services/csharp-typescript-converter.service';

@Component({
  selector: 'app-csharp-typescript',
  imports: [FormsModule],
  template: `
    <div class="max-w-[1600px] mx-auto p-6">
      <!-- Header with Direction Toggle -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-1">C# ↔ TypeScript</h1>
          <p class="text-sm text-gray-600">Real-time bidirectional conversion</p>
        </div>
        
        <div class="flex items-center gap-3">
          <!-- Options Button -->
          <button
            (click)="showOptions.set(!showOptions())"
            [class]="showOptions() ? 'bg-[#9C27B0] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
            class="px-4 py-2 rounded-lg border border-gray-300 font-medium text-sm transition-all flex items-center gap-2 shadow-sm">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v6m0 6v6m6-12h6m-6 6h6M1 12h6m-6-6h6"></path>
            </svg>
            Options
          </button>
          
          <!-- Direction Toggle -->
          <div class="inline-flex rounded-lg border border-gray-300 bg-white p-0.5 shadow-sm">
            <button
              (click)="switchDirection('csharp-to-typescript')"
              [class]="direction() === 'csharp-to-typescript' ? 'bg-gradient-to-r from-[#9C27B0] to-[#7B1FA2] text-white shadow-md' : 'text-gray-700 hover:bg-gray-50'"
              class="px-5 py-2 rounded-md font-semibold text-sm transition-all">
              C# → TS
            </button>
            <button
              (click)="switchDirection('typescript-to-csharp')"
              [class]="direction() === 'typescript-to-csharp' ? 'bg-gradient-to-r from-[#9C27B0] to-[#7B1FA2] text-white shadow-md' : 'text-gray-700 hover:bg-gray-50'"
              class="px-5 py-2 rounded-md font-semibold text-sm transition-all">
              TS → C#
            </button>
          </div>
        </div>
      </div>

      <!-- Options Panel -->
      @if (showOptions()) {
        <div class="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg border border-gray-200 p-5 mb-6">
          @if (direction() === 'csharp-to-typescript') {
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-gray-700 mb-2">Export Type</label>
                <select 
                  [value]="exportType()"
                  (change)="exportType.set($any($event.target).value)"
                  class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9C27B0] bg-white shadow-sm">
                  <option value="interface">Interface</option>
                  <option value="type">Type Alias</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-semibold text-gray-700 mb-2">DateTime(Offset) as</label>
                <select 
                  [value]="dateTimeType()"
                  (change)="dateTimeType.set($any($event.target).value)"
                  class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9C27B0] bg-white shadow-sm">
                  <option value="string">string</option>
                  <option value="Date">Date</option>
                </select>
              </div>
            </div>
          } @else {
            <div class="grid grid-cols-5 gap-4">
              <div>
                <label class="block text-xs font-semibold text-gray-700 mb-2">Type Definition</label>
                <select 
                  [value]="classType()"
                  (change)="classType.set($any($event.target).value)"
                  class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9C27B0] bg-white shadow-sm">
                  <option value="class">Class</option>
                  <option value="record">Record</option>
                  <option value="struct">Struct</option>
                  <option value="record struct">Record Struct</option>
                  <option value="readonly record struct">Readonly Record Struct</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-semibold text-gray-700 mb-2">Collection Type</label>
                <select 
                  [value]="enumerationType()"
                  (change)="enumerationType.set($any($event.target).value)"
                  class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9C27B0] bg-white shadow-sm">
                  <option value="List<T>">List&lt;T&gt;</option>
                  <option value="IReadOnlyCollection<T>">IReadOnlyCollection&lt;T&gt;</option>
                  <option value="T[]">T[]</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-semibold text-gray-700 mb-2">Serializer</label>
                <select 
                  [value]="serializer()"
                  (change)="serializer.set($any($event.target).value)"
                  class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9C27B0] bg-white shadow-sm">
                  <option value="System.Text.Json">System.Text.Json</option>
                  <option value="Newtonsoft.Json">Newtonsoft.Json</option>
                </select>
              </div>

              <div class="flex flex-col justify-end">
                <label class="flex items-center gap-2 cursor-pointer px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors">
                  <input 
                    type="checkbox"
                    [checked]="convertSnakeCase()"
                    (change)="convertSnakeCase.set($any($event.target).checked)"
                    class="w-4 h-4 text-[#9C27B0] border-gray-300 rounded focus:ring-2 focus:ring-[#9C27B0]">
                  <span class="text-xs font-medium text-gray-700">snake_case → PascalCase</span>
                </label>
              </div>

              @if (serializer() === 'System.Text.Json') {
                <div class="flex flex-col justify-end">
                  <label class="flex items-center gap-2 cursor-pointer px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors">
                    <input 
                      type="checkbox"
                      [checked]="generateSerializerContext()"
                      (change)="generateSerializerContext.set($any($event.target).checked)"
                      class="w-4 h-4 text-[#9C27B0] border-gray-300 rounded focus:ring-2 focus:ring-[#9C27B0]">
                    <span class="text-xs font-medium text-gray-700">Generate Context</span>
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
        <div class="group relative bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
          <div class="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-1.5 h-1.5 rounded-full bg-green-500"></div>
              <h3 class="font-semibold text-sm text-gray-700">
                @if (direction() === 'csharp-to-typescript') {
                  C# Input
                } @else {
                  TypeScript Input
                }
              </h3>
            </div>
            <span class="text-xs text-gray-500">{{ inputCode().length }} chars</span>
          </div>
          <textarea
            [(ngModel)]="inputCode"
            class="w-full h-[600px] p-4 font-mono text-sm focus:outline-none resize-none bg-gray-50/50"
            [placeholder]="direction() === 'csharp-to-typescript' ? 'Paste your C# class here...' : 'Paste your TypeScript interface here...'"
          ></textarea>
        </div>

        <!-- Output Panel -->
        <div class="group relative bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
          <div class="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2.5 border-b border-gray-200 flex justify-between items-center">
            <div class="flex items-center gap-2">
              <div class="w-1.5 h-1.5 rounded-full" [class]="outputCode() ? 'bg-purple-500' : 'bg-gray-300'"></div>
              <h3 class="font-semibold text-sm text-gray-700">
                @if (direction() === 'csharp-to-typescript') {
                  TypeScript Output
                } @else {
                  C# Output
                }
              </h3>
            </div>
            <button 
              (click)="copyToClipboard()"
              [disabled]="!outputCode()"
              class="px-3 py-1 rounded-md text-xs font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              [class]="outputCode() ? 'text-[#9C27B0] hover:bg-[#9C27B0]/10' : 'text-gray-400'">
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
            [value]="outputCode()"
            class="w-full h-[600px] p-4 font-mono text-sm focus:outline-none resize-none"
            [class]="errorMessage() ? 'bg-red-50/50 text-red-600' : 'bg-gray-50/50 text-gray-900'"
            [placeholder]="errorMessage() || 'Converted output will appear here automatically...'"
            readonly
          ></textarea>
        </div>
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

  constructor() {
    // Auto-convert on input change
    effect(() => {
      const input = this.inputCode();
      if (input.trim()) {
        this.convert();
      } else {
        this.outputCode.set('');
        this.errorMessage.set('');
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
      }
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'An error occurred during conversion');
    }
  }

  protected async copyToClipboard(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.outputCode());
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }
}
