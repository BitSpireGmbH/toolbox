import { Component, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { StrongTyperConverterService, ConfigNode } from '../services/strong-typer-converter.service';

@Component({
  selector: 'app-strong-typer',
  imports: [FormsModule, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-7xl mx-auto p-6">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-1">Strong-Typer</h1>
          <p class="text-sm text-gray-600">Generate C# Options classes from JSON configuration</p>
        </div>
        
        <button
          (click)="showOptions.set(!showOptions())"
          [class]="showOptions() ? 'bg-brand-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
          class="px-4 py-2 rounded-lg border border-gray-300 font-medium text-sm transition-all flex items-center gap-2 shadow-sm">
          <svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
          </svg>
          Options
        </button>
      </div>

      @if (showOptions()) {
        <div class="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg border border-gray-200 p-5 mb-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-4">
              <div class="space-y-2">
                <label class="flex items-center gap-2 cursor-pointer px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors">
                  <input 
                    type="checkbox"
                    [(ngModel)]="useAddOptions"
                    (change)="convert()"
                    class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-2 focus:ring-brand-primary">
                  <span class="text-xs font-medium text-gray-700">Use AddOptions (Fluent API)</span>
                </label>

                <label class="flex items-center gap-2 cursor-pointer px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors">
                  <input 
                    type="checkbox"
                    [(ngModel)]="validateDataAnnotations"
                    (change)="convert()"
                    class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-2 focus:ring-brand-primary">
                  <span class="text-xs font-medium text-gray-700">Include Data Annotations ([Required])</span>
                </label>

                <label class="flex items-center gap-2 cursor-pointer px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors">
                  <input 
                    type="checkbox"
                    [(ngModel)]="validateOnStart"
                    (change)="convert()"
                    class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-2 focus:ring-brand-primary">
                  <span class="text-xs font-medium text-gray-700">Validate on Start</span>
                </label>
              </div>
            </div>
            
            <div class="bg-blue-50 border border-blue-100 rounded-lg p-4">
               <h3 class="text-sm font-semibold text-blue-800 mb-2">Information</h3>
               <p class="text-xs text-blue-700 leading-relaxed">
                 Select the sections you want to generate as Options classes by checking the box next to them. You can also define if a field is required for validation.
               </p>
            </div>
          </div>
        </div>
      }

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Input Section -->
        <div class="flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-[600px]">
          <div class="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
            <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">JSON Input</span>
            <button (click)="pasteSample()" class="text-xs text-brand-primary hover:underline font-medium">Paste Sample</button>
          </div>
          <textarea
            [(ngModel)]="inputJson"
            (input)="onInputChange()"
            class="flex-1 w-full p-4 font-mono text-sm resize-none focus:outline-none bg-white text-gray-800"
            placeholder="Paste your appsettings.json here..."></textarea>
        </div>

        <!-- Discovered Sections -->
        <div class="flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-[600px]">
          <div class="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
            <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Configure Sections</span>
          </div>
          <div class="flex-1 overflow-auto p-4 space-y-4">
             @if (nodes().length === 0) {
               <div class="flex flex-col items-center justify-center h-full text-gray-400 space-y-2">
                 <svg class="w-12 h-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                 </svg>
                 <p class="text-sm italic text-center">No sections discovered yet.</p>
               </div>
             } @else {
               <div class="space-y-4">
                 @for (node of nodes(); track node.fullPath) {
                    <ng-container [ngTemplateOutlet]="nodeTemplate" [ngTemplateOutletContext]="{ $implicit: node, depth: 0 }"></ng-container>
                 }
               </div>
             }
          </div>
        </div>

        <!-- Output Section -->
        <div class="flex flex-col bg-gray-900 rounded-xl shadow-sm border border-gray-800 overflow-hidden h-[600px]">
          <div class="flex items-center justify-between px-4 py-2 bg-gray-800/50 border-b border-gray-700">
            <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">C# Code</span>
            <button
              (click)="copyToClipboard()"
              class="px-3 py-1 text-xs font-medium bg-gray-700 text-gray-200 hover:bg-gray-600 rounded transition-colors flex items-center gap-1.5">
              @if (copied()) {
                <svg fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                Copied!
              } @else {
                <svg fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                </svg>
                Copy
              }
            </button>
          </div>
          <div class="flex-1 overflow-auto bg-[#0d1117]">
            @if (outputCode()) {
              <pre class="p-4 font-mono text-sm text-gray-300 leading-relaxed"><code>{{ outputCode() }}</code></pre>
            } @else {
              <div class="flex items-center justify-center h-full text-gray-600 italic text-sm">
                Select an object to generate code
              </div>
            }
          </div>
        </div>
      </div>
    </div>

    <!-- Node Template for Recursive View -->
    <ng-template #nodeTemplate let-node let-depth="depth">
      <div [style.padding-left.px]="depth * 12" class="space-y-1">
        <div 
          class="flex items-center justify-between p-1.5 rounded hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors group"
          [class.bg-blue-50]="node.isObject && node.isSelected"
          [class.border-blue-100]="node.isObject && node.isSelected">
          <div class="flex items-center gap-2 overflow-hidden">
            @if (node.isObject) {
              <input 
                type="checkbox" 
                [(ngModel)]="node.isSelected" 
                (change)="convert()"
                class="w-3.5 h-3.5 text-brand-primary border-gray-300 rounded focus:ring-0">
            } @else {
               <div class="w-3.5 h-3.5"></div>
            }
            <span class="text-sm font-medium truncate" [class.text-gray-400]="!node.isSelected && node.isObject">
               {{ node.key }}
               @if (node.isObject) {
                 <span class="text-[10px] text-gray-400 ml-1 font-normal">({{ node.className }})</span>
               }
            </span>
          </div>
          
          <div class="flex items-center gap-2 shrink-0">
            <label class="flex items-center gap-1 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" [class.opacity-100]="node.isRequired">
              <input 
                type="checkbox" 
                [(ngModel)]="node.isRequired" 
                (change)="convert()"
                class="w-3 h-3 text-gray-500 border-gray-300 rounded focus:ring-0">
              <span class="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Req</span>
            </label>
          </div>
        </div>

        @if (node.children.length > 0) {
          <div class="border-l border-gray-100 ml-1.5 pl-1.5">
            @for (child of node.children; track child.fullPath) {
              <ng-container [ngTemplateOutlet]="nodeTemplate" [ngTemplateOutletContext]="{ $implicit: child, depth: depth + 1 }"></ng-container>
            }
          </div>
        }
      </div>
    </ng-template>
  `
})
export class StrongTyperComponent {
  private converter = inject(StrongTyperConverterService);

  readonly showOptions = signal(true);
  readonly copied = signal(false);
  
  inputJson = `{
  "Database": {
    "ConnectionString": "Server=localhost;Database=myapp;",
    "Timeout": 30,
    "MaxPoolSize": 50,
    "RetryPolicy": {
      "Count": 3,
      "Interval": 5
    }
  },
  "Authentication": {
    "Jwt": {
      "Issuer": "myapp",
      "Audience": "users",
      "SecretKey": "your-secret-key-here",
      "ExpiryMinutes": 60
    },
    "AllowedOrigins": ["http://localhost:4200", "https://myapp.com"]
  },
  "Logging": {
    "LogLevel": "Information",
    "EnableConsole": true,
    "EnableFile": true
  }
}`;
  useAddOptions = true;
  validateDataAnnotations = true;
  validateOnStart = true;
  
  readonly nodes = signal<ConfigNode[]>([]);
  readonly outputCode = signal('');

  constructor() {
    // Initialize with example data
    this.onInputChange();
  }

  onInputChange() {
    if (!this.inputJson.trim()) {
      this.nodes.set([]);
      this.outputCode.set('');
      return;
    }
    this.nodes.set(this.converter.discoverNodes(this.inputJson));
    this.convert();
  }

  convert() {
    try {
      const result = this.converter.generate(this.nodes(), {
        useAddOptions: this.useAddOptions,
        validateDataAnnotations: this.validateDataAnnotations,
        validateOnStart: this.validateOnStart
      });
      this.outputCode.set(result);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      this.outputCode.set(`Error: ${message}`);
    }
  }

  pasteSample() {
    this.inputJson = JSON.stringify({
      "Database": {
        "ConnectionString": "Server=...;",
        "Timeout": 30,
        "RetryPolicy": {
          "Count": 3,
          "Interval": 5
        }
      },
      "Authentication": {
        "Jwt": {
          "Issuer": "myapp",
          "Audience": "users",
          "ExpiryMinutes": 60
        }
      }
    }, null, 2);
    this.onInputChange();
  }

  async copyToClipboard() {
    if (!this.outputCode()) return;
    await navigator.clipboard.writeText(this.outputCode());
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }
}

