import { Component, signal, inject, effect, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CurlToHttpClientConverterService,
  CurlToHttpClientOptions,
  ClientStyle,
  CurlSerializer,
} from '../services/curl-to-httpclient-converter.service';

@Component({
  selector: 'app-curl-to-httpclient',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-7xl mx-auto p-6">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-1">cURL → HttpClient</h1>
          <p class="text-sm text-gray-600">Convert any <span class="font-mono">curl</span> command into idiomatic C# HttpClient code</p>
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

      <!-- Options Panel -->
      @if (showOptions()) {
        <div class="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg border border-gray-200 p-5 mb-6">
          <div class="grid grid-cols-1 gap-4">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label for="curl-client-style" class="block text-xs font-semibold text-gray-700 mb-2">Client Style</label>
                <select
                  id="curl-client-style"
                  [value]="clientStyle()"
                  (change)="clientStyle.set($any($event.target).value)"
                  class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white shadow-sm">
                  <option value="inline">Inline HttpClient</option>
                  <option value="factory">IHttpClientFactory</option>
                  <option value="typed">Typed Client</option>
                </select>
                <p class="mt-1.5 text-[10px] leading-snug">
                  @switch (clientStyle()) {
                    @case ('inline') {
                      <span class="text-amber-700">Quick & simple. Good for one-off scripts.</span>
                    }
                    @case ('factory') {
                      <span class="text-green-700 font-medium">Recommended. Pooled clients, no socket exhaustion.</span>
                    }
                    @case ('typed') {
                      <span class="text-green-700 font-medium">Best for production. Inject as a typed dependency.</span>
                    }
                  }
                </p>
              </div>

              <div>
                <label for="curl-serializer" class="block text-xs font-semibold text-gray-700 mb-2">Serializer</label>
                <select
                  id="curl-serializer"
                  [value]="serializer()"
                  (change)="serializer.set($any($event.target).value)"
                  class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white shadow-sm">
                  <option value="System.Text.Json">System.Text.Json</option>
                  <option value="Newtonsoft.Json">Newtonsoft.Json</option>
                </select>
              </div>

              @if (clientStyle() === 'typed') {
                <div>
                  <label for="curl-typed-name" class="block text-xs font-semibold text-gray-700 mb-2">Typed Client Name</label>
                  <input
                    id="curl-typed-name"
                    type="text"
                    [value]="typedClientName()"
                    (input)="typedClientName.set($any($event.target).value)"
                    placeholder="ApiClient (auto)"
                    class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white shadow-sm">
                </div>
              }
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label class="flex items-center gap-2 cursor-pointer px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors">
                <input
                  type="checkbox"
                  [checked]="generateBodyRecord()"
                  (change)="generateBodyRecord.set($any($event.target).checked)"
                  class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-2 focus:ring-brand-primary">
                <span class="text-xs font-medium text-gray-700">Generate C# record for JSON body</span>
              </label>

              <label class="flex items-center gap-2 cursor-pointer px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors">
                <input
                  type="checkbox"
                  [checked]="wrapInAsyncMethod()"
                  (change)="wrapInAsyncMethod.set($any($event.target).checked)"
                  [disabled]="clientStyle() !== 'inline'"
                  class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-2 focus:ring-brand-primary disabled:opacity-50">
                <span class="text-xs font-medium text-gray-700">Wrap in async method (inline only)</span>
              </label>
            </div>
          </div>
        </div>
      }

      <!-- Converter Area -->
      <div class="grid md:grid-cols-2 gap-5">
        <!-- Input Panel -->
        <div class="group relative bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
          <div class="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-1.5 h-1.5 rounded-full bg-green-500"></div>
              <h3 class="font-semibold text-sm text-gray-700">cURL Input</h3>
            </div>
            <span class="text-xs text-gray-500">{{ inputCode().length }} chars</span>
          </div>
          <textarea
            [(ngModel)]="inputCode"
            class="w-full h-[500px] md:h-[600px] p-4 font-mono text-sm focus:outline-none resize-none bg-gray-50/50"
            placeholder="Paste your curl command here..."
          ></textarea>
        </div>

        <!-- Output Panel -->
        <div class="group relative bg-gray-900 rounded-xl shadow-md border border-gray-700 overflow-hidden hover:shadow-lg transition-shadow">
          <div class="bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-2.5 border-b border-gray-700 flex justify-between items-center">
            <div class="flex items-center gap-2">
              <div class="w-1.5 h-1.5 rounded-full" [class]="outputCode() ? 'bg-green-500' : 'bg-gray-500'"></div>
              <h3 class="font-semibold text-sm text-gray-200">C# Output</h3>
            </div>
            <button
              (click)="copyToClipboard()"
              [disabled]="!outputCode()"
              class="px-3 py-1 rounded-md text-xs font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              [class]="outputCode() ? 'text-green-400 hover:bg-green-400/10' : 'text-gray-500'">
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
            class="w-full h-[500px] md:h-[600px] p-4 font-mono text-sm focus:outline-none resize-none bg-gray-900"
            [class]="errorMessage() ? 'text-red-400' : 'text-green-400'"
            [placeholder]="errorMessage() || 'C# code will appear here automatically...'"
            readonly
          ></textarea>
        </div>
      </div>
    </div>
  `,
  styles: [],
})
export class CurlToHttpClientComponent {
  private readonly converterService = inject(CurlToHttpClientConverterService);

  protected readonly clientStyle = signal<ClientStyle>('factory');
  protected readonly serializer = signal<CurlSerializer>('System.Text.Json');
  protected readonly generateBodyRecord = signal<boolean>(false);
  protected readonly wrapInAsyncMethod = signal<boolean>(true);
  protected readonly typedClientName = signal<string>('');
  protected readonly showOptions = signal<boolean>(true);

  protected readonly inputCode = signal<string>(`curl -X POST 'https://api.example.com/users' \\
  -H 'Authorization: Bearer your-token' \\
  -H 'Content-Type: application/json' \\
  -d '{"name":"Alice","email":"alice@example.com"}'`);
  protected readonly outputCode = signal<string>('');
  protected readonly errorMessage = signal<string>('');

  constructor() {
    effect(() => {
      const input = this.inputCode();
      // touch options to re-run on changes
      this.clientStyle();
      this.serializer();
      this.generateBodyRecord();
      this.wrapInAsyncMethod();
      this.typedClientName();

      if (input.trim()) {
        this.convert();
      } else {
        this.outputCode.set('');
        this.errorMessage.set('');
      }
    });
  }

  protected convert(): void {
    this.errorMessage.set('');
    this.outputCode.set('');

    try {
      const options: CurlToHttpClientOptions = {
        clientStyle: this.clientStyle(),
        serializer: this.serializer(),
        generateBodyRecord: this.generateBodyRecord(),
        wrapInAsyncMethod: this.wrapInAsyncMethod(),
        typedClientName: this.typedClientName() || undefined,
      };
      const result = this.converterService.convert(this.inputCode(), options);
      this.outputCode.set(result);
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Conversion failed');
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
