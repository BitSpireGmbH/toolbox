import { Component, signal, computed, ChangeDetectionStrategy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TypedDiHelperService } from '../services/typed-di-helper.service';

type HelperType = 'http' | 'signalr';

@Component({
  selector: 'app-typed-di-helper',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-7xl mx-auto p-6">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-1">Typed DI Helper</h1>
          <p class="text-sm text-gray-600">Generate strongly-typed DI configurations for HttpClient and SignalR</p>
        </div>

        <div class="inline-flex rounded-lg border border-gray-300 bg-white p-0.5 shadow-sm">
          <button
            (click)="activeTab.set('http')"
            [class]="activeTab() === 'http' ? 'bg-brand-primary text-white shadow-sm' : 'text-gray-700 hover:bg-gray-50'"
            class="px-5 py-2 rounded-md font-semibold text-sm transition-all">
            HttpClient
          </button>
          <button
            (click)="activeTab.set('signalr')"
            [class]="activeTab() === 'signalr' ? 'bg-brand-primary text-white shadow-sm' : 'text-gray-700 hover:bg-gray-50'"
            class="px-5 py-2 rounded-md font-semibold text-sm transition-all">
            SignalR
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Configuration Column -->
        <div class="space-y-6">
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            @if (activeTab() === 'http') {
              <h2 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg class="w-5 h-5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                HttpClient Configuration
              </h2>
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Service Name</label>
                  <input
                    type="text"
                    [ngModel]="httpServiceName()"
                    (ngModelChange)="httpServiceName.set($event)"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-hidden"
                    placeholder="e.g. GitHubService">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Interface Name</label>
                  <input
                    type="text"
                    [ngModel]="httpInterfaceName()"
                    (ngModelChange)="httpInterfaceName.set($event)"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-hidden"
                    placeholder="e.g. IGitHubService">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
                  <input
                    type="text"
                    [ngModel]="httpBaseUrl()"
                    (ngModelChange)="httpBaseUrl.set($event)"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-hidden"
                    placeholder="e.g. https://api.github.com">
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Timeout (seconds)</label>
                    <input
                      type="number"
                      [ngModel]="httpTimeout()"
                      (ngModelChange)="httpTimeout.set($event)"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-hidden"
                      placeholder="e.g. 30">
                  </div>
                  <div class="flex flex-col justify-end gap-1">
                    <label class="flex items-center gap-2 cursor-pointer pb-1">
                      <input
                        type="checkbox"
                        [ngModel]="httpUseResilience()"
                        (ngModelChange)="httpUseResilience.set($event)"
                        class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary">
                      <span class="text-sm font-medium text-gray-700">Add Resilience</span>
                    </label>
                    <a
                      href="https://learn.microsoft.com/en-us/dotnet/core/resilience/http-resilience?tabs=dotnet-cli"
                      target="_blank"
                      class="text-[10px] text-brand-primary hover:underline flex items-center gap-1">
                      <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Resilience Help
                    </a>
                  </div>
                </div>
              </div>
            } @else {
              <h2 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg class="w-5 h-5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                SignalR Configuration
              </h2>
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Hub Name</label>
                  <input
                    type="text"
                    [ngModel]="signalRHubName()"
                    (ngModelChange)="signalRHubName.set($event)"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-hidden"
                    placeholder="e.g. NotificationHub">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Client Interface</label>
                  <input
                    type="text"
                    [ngModel]="signalRInterfaceName()"
                    (ngModelChange)="signalRInterfaceName.set($event)"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-hidden"
                    placeholder="e.g. INotificationClient">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Route Path</label>
                  <input
                    type="text"
                    [ngModel]="signalRRoute()"
                    (ngModelChange)="signalRRoute.set($event)"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-hidden"
                    placeholder="e.g. /notifications">
                </div>

                <div class="grid grid-cols-2 gap-4">
                   <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      [ngModel]="signalREnableDetailedErrors()"
                      (ngModelChange)="signalREnableDetailedErrors.set($event)"
                      class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary">
                    <span class="text-sm font-medium text-gray-700">Detailed Errors</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      [ngModel]="signalRUseMessagePack()"
                      (ngModelChange)="signalRUseMessagePack.set($event)"
                      class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary">
                    <span class="text-sm font-medium text-gray-700">MessagePack</span>
                  </label>
                </div>
              </div>
            }
          </div>

          <div class="bg-blue-50 border border-blue-100 rounded-xl p-5">
            <h3 class="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Why use strongly-typed DI?
            </h3>
            <p class="text-sm text-blue-700 leading-relaxed">
              @if (activeTab() === 'http') {
                Using <code>AddHttpClient&lt;TInterface, TImplementation&gt;</code> ensures your services receive a configured <code>HttpClient</code> automatically. It handles base URLs, default headers, and even resilience patterns in a centralized way.
              } @else {
                Strongly-typed SignalR Hubs (<code>Hub&lt;TClient&gt;</code>) provide compile-time safety for client-side method calls. You'll never misspell a method name again!
              }
            </p>
          </div>
        </div>

        <!-- Output Column -->
        <div class="space-y-6">
          <div class="bg-gray-900 rounded-xl shadow-lg border border-gray-800 overflow-hidden flex flex-col h-full min-h-125">
            <div class="flex items-center justify-between px-4 py-3 bg-gray-800/50 border-b border-gray-700">
               <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">C# Generated Code</span>
               <button
                 (click)="copyCode()"
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
            <pre class="p-6 text-sm font-mono text-blue-300 overflow-auto flex-1"><code>{{ generatedCode() }}</code></pre>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
  `]
})
export class TypedDiHelperComponent {
  private service = inject(TypedDiHelperService);
  activeTab = signal<HelperType>('http');
  readonly copied = signal(false);

  // Http Signals
  httpServiceName = signal('MyApiService');
  httpInterfaceName = signal('IMyApiService');
  httpBaseUrl = signal('https://api.example.com');
  httpTimeout = signal(30);
  httpUseResilience = signal(true);

  // SignalR Signals
  signalRHubName = signal('ChatHub');
  signalRInterfaceName = signal('IChatClient');
  signalRRoute = signal('/chat');
  signalREnableDetailedErrors = signal(false);
  signalRUseMessagePack = signal(false);

  generatedCode = computed(() => {
    if (this.activeTab() === 'http') {
      return this.service.generateHttpCode({
        serviceName: this.httpServiceName(),
        interfaceName: this.httpInterfaceName(),
        baseUrl: this.httpBaseUrl(),
        timeout: this.httpTimeout(),
        useResilience: this.httpUseResilience()
      });
    } else {
      return this.service.generateSignalRCode({
        hubName: this.signalRHubName(),
        interfaceName: this.signalRInterfaceName(),
        route: this.signalRRoute(),
        enableDetailedErrors: this.signalREnableDetailedErrors(),
        useMessagePack: this.signalRUseMessagePack()
      });
    }
  });

  async copyCode() {
    if (!this.generatedCode()) return;
    await navigator.clipboard.writeText(this.generatedCode());
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }
}
