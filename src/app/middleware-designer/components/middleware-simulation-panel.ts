import { Component, input, output, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SimulationStepComponent } from './simulation-step';
import { MiddlewareDesignerService, SimulationRequest, Pipeline } from '../../services/middleware-designer.service';

@Component({
  selector: 'app-middleware-simulation-panel',
  standalone: true,
  styles: `:host {
      display: block;
  }`,
  imports: [FormsModule, SimulationStepComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white rounded-xl shadow-lg border-2 border-brand-primary/20 p-6">
      <h2 class="text-lg font-bold text-gray-800 mb-4">Pipeline Simulation</h2>

      <div class="grid md:grid-cols-2 gap-5">
        <!-- Input -->
        <div>
          <h3 class="font-semibold text-gray-700 mb-3">Request Configuration</h3>
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">HTTP Method</label>
              <select
                [(ngModel)]="request.method"
                class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500">
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
                <option value="PATCH">PATCH</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Path</label>
              <input
                type="text"
                [(ngModel)]="request.path"
                class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                placeholder="/api/users">
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Headers (JSON)</label>
              <textarea
                [(ngModel)]="headersText"
                class="w-full h-20 px-3 py-2 font-mono text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500 resize-none"
                placeholder='{"Authorization": "Bearer token123"}'></textarea>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Body</label>
              <textarea
                [(ngModel)]="request.body"
                class="w-full h-20 px-3 py-2 font-mono text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500 resize-none"
                placeholder='{"name": "John Doe"}'></textarea>
            </div>

            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                id="isAuth"
                [(ngModel)]="request.isAuthenticated"
                class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary">
              <label for="isAuth" class="text-sm font-medium text-gray-700">Is Authenticated</label>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Claims (JSON)</label>
              <textarea
                [(ngModel)]="claimsText"
                class="w-full h-20 px-3 py-2 font-mono text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500 resize-none"
                placeholder='{"role": "admin", "userId": "123"}'></textarea>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Request Count (for Rate Limiting)</label>
              <input
                type="number"
                [(ngModel)]="requestCount"
                min="1"
                max="500"
                class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                placeholder="1">
              <p class="text-xs text-gray-500 mt-1">Simulate multiple requests to test rate limiting behavior</p>
            </div>

            <button
              (click)="onRunSimulation()"
              class="w-full px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-blue-800 hover:shadow-md transition-all font-medium">
              Run Simulation
            </button>
          </div>
        </div>

        <!-- Output -->
        <div>
          <h3 class="font-semibold text-gray-700 mb-3">Execution Trace</h3>

          @if (result(); as result) {
            <div class="space-y-3">
              <!-- Response Summary -->
              <div class="p-3 rounded-lg" [class]="result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'">
                <p class="text-sm font-semibold" [class]="result.success ? 'text-green-800' : 'text-red-800'">
                  Response: {{ result.response.statusCode }} {{ result.response.statusText }}
                </p>
                <p class="text-xs" [class]="result.success ? 'text-green-700' : 'text-red-700'">
                  Duration: {{ result.duration }}ms
                </p>
                @if (result.response.terminated) {
                  <p class="text-xs" [class]="result.success ? 'text-green-700' : 'text-red-700'">
                    Terminated by: {{ result.response.terminatedBy }}
                  </p>
                }
              </div>

              <!-- Steps -->
              <div class="space-y-2 max-h-125 overflow-y-auto">
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
                <div class="p-3 bg-gray-900 text-green-400 font-mono text-xs rounded-lg">
                  <p class="font-semibold text-green-300 mb-1">Response Body:</p>
                  <pre class="whitespace-pre-wrap">{{ result.response.body }}</pre>
                </div>
              }
            </div>
          } @else {
            <div class="text-center py-12 text-gray-500">
              <p class="text-sm">No simulation results yet</p>
              <p class="text-xs mt-1">Configure the request and click "Run Simulation"</p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class MiddlewareSimulationPanelComponent {
  private readonly service = inject(MiddlewareDesignerService);

  readonly pipeline = input.required<Pipeline>();
  readonly runSimulation = output<void>();

  protected request: SimulationRequest = {
    method: 'GET',
    path: '/api/users',
    headers: {},
    query: {},
    body: '',
    isAuthenticated: false,
    claims: {},
    cookies: {},
  };

  protected headersText = '{}';
  protected claimsText = '{}';
  protected requestCount = 1;
  protected result = signal(null as any);

  protected onRunSimulation(): void {
    try {
      this.request.headers = JSON.parse(this.headersText || '{}');
      this.request.claims = JSON.parse(this.claimsText || '{}');
    } catch (error) {
      console.error('Invalid JSON in headers or claims');
      return;
    }

    const simResult = this.service.simulatePipeline(this.pipeline(), this.request, this.requestCount);
    this.result.set(simResult);
  }
}
