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
  BranchCondition,
  MinimalAPIEndpoint,
} from '../services/middleware-designer.service';
import { MiddlewareLibraryItemComponent, MiddlewareLibraryItemData } from './components/middleware-library-item';
import { MiddlewareNodeCardComponent } from './components/middleware-node-card';
import { SimulationStepComponent } from './components/simulation-step';
import { ValidationMessagesComponent } from './components/validation-messages';

@Component({
  selector: 'app-middleware-designer',
  imports: [FormsModule, DragDropModule, MiddlewareLibraryItemComponent, MiddlewareNodeCardComponent, SimulationStepComponent, ValidationMessagesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-[1600px] mx-auto p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-1">Middleware Designer</h1>
          <p class="text-sm text-gray-600">Build ASP.NET Core middleware pipelines visually</p>
        </div>

        <div class="flex items-center gap-3">
          <button
            (click)="showLibrary.set(!showLibrary())"
            [class]="showLibrary() ? 'bg-brand-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
            class="px-4 py-2 rounded-lg border border-gray-300 font-medium text-sm transition-all flex items-center gap-2 shadow-sm">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="18" cy="18" r="3"></circle>
              <circle cx="6" cy="6" r="3"></circle>
              <path d="M6 9v6"></path>
              <path d="M9 6h6"></path>
              <path d="M9 18h6"></path>
            </svg>
            Library
          </button>
          <button
            (click)="showSimulation.set(!showSimulation())"
            [class]="showSimulation() ? 'bg-brand-secondary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
            class="px-4 py-2 rounded-lg border border-gray-300 font-medium text-sm transition-all flex items-center gap-2 shadow-sm">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="18" cy="18" r="3"></circle>
              <circle cx="6" cy="6" r="3"></circle>
              <path d="M6 9v6"></path>
              <path d="M9 6h6"></path>
              <path d="M9 18h6"></path>
            </svg>
            Simulation
          </button>
          
          <div class="inline-flex rounded-lg border border-gray-300 bg-white p-0.5 shadow-sm">
            <button
              (click)="splitRatio.set(100)"
              [class]="splitRatio() === 100 ? 'bg-brand-primary text-white' : 'text-gray-700 hover:bg-gray-50'"
              class="px-3 py-2 rounded-md text-xs font-semibold transition-all"
              title="Canvas Only">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"></rect>
              </svg>
            </button>
            <button
              (click)="splitRatio.set(50)"
              [class]="splitRatio() > 0 && splitRatio() < 100 ? 'bg-brand-primary text-white' : 'text-gray-700 hover:bg-gray-50'"
              class="px-3 py-2 rounded-md text-xs font-semibold transition-all"
              title="Split View">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                <line x1="12" y1="3" x2="12" y2="21"></line>
              </svg>
            </button>
            <button
              (click)="splitRatio.set(0)"
              [class]="splitRatio() === 0 ? 'bg-brand-primary text-white' : 'text-gray-700 hover:bg-gray-50'"
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
        <div class="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg border border-gray-200 p-5 mb-6">
          <div class="flex gap-2 flex-wrap items-center">
            <button
              (click)="clearPipeline()"
              class="px-3 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium flex items-center gap-1.5">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14"></path>
              </svg>
              Clear
            </button>
            @if (copySuccess()) {
              <span class="text-xs text-green-600 font-medium">✓ Copied!</span>
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
          <div class="bg-white rounded-xl shadow-md border border-gray-200 p-5 h-fit sticky top-6">
            <h3 class="font-semibold text-sm text-gray-700 mb-3">Middleware Library</h3>
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
            <div class="group relative bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow h-full w-full">
          <div class="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-1.5 h-1.5 rounded-full" [class]="pipeline().middlewares.length > 0 ? 'bg-green-500' : 'bg-gray-300'"></div>
              <h3 class="font-semibold text-sm text-gray-700">Pipeline Canvas</h3>
            </div>
            <span class="text-xs text-gray-500">{{ pipeline().middlewares.length }} middleware(s)</span>
          </div>

          <div [class]="splitRatio() === 100 ? 'p-4 min-h-[800px]' : 'p-4 min-h-[600px]'">
            @if (pipeline().middlewares.length === 0) {
              <div class="text-center py-20 text-gray-500">
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
                    class="bg-white border rounded-lg p-3 hover:shadow-sm transition-all cursor-move"
                    [class.border-brand-primary]="selectedMiddleware()?.id === middleware.id"
                    [class.shadow-sm]="selectedMiddleware()?.id === middleware.id"
                    [class.border-gray-200]="selectedMiddleware()?.id !== middleware.id">
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
              [class]="isResizing() ? 'bg-brand-primary' : 'bg-gray-300 hover:bg-brand-primary'"
              class="w-1 cursor-col-resize transition-colors flex-shrink-0 mx-2 relative group">
              <div class="absolute inset-y-0 -left-1 -right-1"></div>
            </div>
          }

        <!-- Code Output -->
        @if (splitRatio() < 100) {
        <div class="flex-shrink-0 transition-all" [style]="codeWidthStyle()">
          <div class="group relative bg-gray-900 rounded-xl shadow-md border border-gray-700 overflow-hidden hover:shadow-lg transition-shadow h-full w-full">
            <div class="bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-2.5 border-b border-gray-700 flex justify-between items-center">
              <div class="flex items-center gap-2">
                <div class="w-1.5 h-1.5 rounded-full" [class]="generatedCode() ? 'bg-green-500' : 'bg-gray-500'"></div>
                <h3 class="font-semibold text-sm text-gray-200">Generated C# Code</h3>
              </div>
              <button
                (click)="copyCode()"
                [disabled]="!generatedCode()"
                class="px-3 py-1 rounded-md text-xs font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                [class]="generatedCode() ? 'text-green-400 hover:bg-green-400/10' : 'text-gray-500'">
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
              [value]="generatedCode()"
              readonly
              [class]="splitRatio() === 0 ? 'w-full h-[800px] p-4 font-mono text-sm bg-gray-900 text-green-400 focus:outline-none resize-none' : 'w-full h-[600px] p-4 font-mono text-sm bg-gray-900 text-green-400 focus:outline-none resize-none'"
              placeholder="Generated C# code will appear here..."></textarea>

            <!-- Minimal API Endpoints -->
            @if (minimalAPIEndpoints().length > 0) {
              <div class="px-4 py-3 bg-blue-50 border-t border-blue-200">
                <h4 class="text-xs font-semibold text-blue-800 mb-2">📍 Minimal API Endpoints</h4>
                @for (endpoint of minimalAPIEndpoints(); track endpoint.middlewareId) {
                  <div class="text-xs text-blue-700 font-mono mb-1">
                    <span class="font-bold">{{ endpoint.method }}</span> {{ endpoint.path }}
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
          <div class="mt-5 bg-white rounded-xl shadow-lg border-2 border-brand-primary/20 p-6">
            <h2 class="text-lg font-bold text-gray-800 mb-4">Pipeline Simulation</h2>

            <div class="grid md:grid-cols-2 gap-5">
              <!-- Input -->
              <div>
                <h3 class="font-semibold text-gray-700 mb-3">Request Configuration</h3>
                <div class="space-y-3">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">HTTP Method</label>
                    <select
                      [(ngModel)]="simulationRequest.method"
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
                      [(ngModel)]="simulationRequest.path"
                      class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                      placeholder="/api/users">
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Headers (JSON)</label>
                    <textarea
                      [(ngModel)]="simulationHeadersText"
                      class="w-full h-20 px-3 py-2 font-mono text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500 resize-none"
                      placeholder='{"Authorization": "Bearer token123"}'></textarea>
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Body</label>
                    <textarea
                      [(ngModel)]="simulationRequest.body"
                      class="w-full h-20 px-3 py-2 font-mono text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500 resize-none"
                      placeholder='{"name": "John Doe"}'></textarea>
                  </div>

                  <div class="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isAuth"
                      [(ngModel)]="simulationRequest.isAuthenticated"
                      class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary">
                    <label for="isAuth" class="text-sm font-medium text-gray-700">Is Authenticated</label>
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Claims (JSON)</label>
                    <textarea
                      [(ngModel)]="simulationClaimsText"
                      class="w-full h-20 px-3 py-2 font-mono text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500 resize-none"
                      placeholder='{"role": "admin", "userId": "123"}'></textarea>
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Request Count (for Rate Limiting)</label>
                    <input
                      type="number"
                      [(ngModel)]="simulationRequestCount"
                      min="1"
                      max="500"
                      class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                      placeholder="1">
                    <p class="text-xs text-gray-500 mt-1">Simulate multiple requests to test rate limiting behavior</p>
                  </div>

                  <button
                    (click)="runSimulation()"
                    class="w-full px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-blue-800 hover:shadow-md transition-all font-medium">
                    Run Simulation
                  </button>
                </div>
              </div>

              <!-- Output -->
              <div>
                <h3 class="font-semibold text-gray-700 mb-3">Execution Trace</h3>

                @if (simulationResult(); as result) {
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
        }

        <!-- Edit Modal -->
        @if (selectedMiddleware()) {
          <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div class="p-6">
                <div class="flex items-center justify-between mb-4">
                  <h2 class="text-xl font-bold text-gray-800">
                    Edit {{ selectedMiddleware()!.type }}
                  </h2>
                  <button
                    (click)="closeEditModal()"
                    class="text-gray-500 hover:text-gray-700 text-2xl leading-none">
                    ×
                  </button>
                </div>

                <div class="space-y-4">
                  <!-- Dynamic config form based on middleware type -->
                  @switch (selectedMiddleware()!.type) {
                    @case ('Routing') {
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">
                          Route Patterns (one per line)
                        </label>
                        <textarea
                          [(ngModel)]="editConfig.routesText"
                          class="w-full h-32 px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500 resize-none font-mono text-sm"
                          placeholder="/api/*&#10;/users/:id"></textarea>
                      </div>
                    }
                    @case ('Authentication') {
                      <div class="space-y-4">
                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1">Authentication Scheme</label>
                          <select
                            [(ngModel)]="editConfig.authScheme"
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500">
                            <option value="JwtBearer">JWT Bearer (API)</option>
                            <option value="OpenIdConnect">OpenID Connect (Web App)</option>
                            <option value="Cookie">Cookie Authentication</option>
                          </select>
                        </div>

                        <!-- Scheme Explanation -->
                        <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                          @switch (editConfig.authScheme) {
                            @case ('JwtBearer') {
                              <p class="font-semibold mb-1">🔑 JWT Bearer Authentication</p>
                              <p>Use this to secure an <strong>API</strong>. The client sends JWT tokens in the Authorization header. There is no human interaction—tokens are obtained out-of-band (e.g., from another identity service).</p>
                            }
                            @case ('OpenIdConnect') {
                              <p class="font-semibold mb-1">🌐 OpenID Connect Authentication</p>
                              <p>Use this to secure a <strong>web application with user interaction</strong>. Users are redirected to an identity provider (IdP) for login/logout. Commonly used with Azure AD, IdentityServer, Auth0, etc.</p>
                            }
                            @case ('Cookie') {
                              <p class="font-semibold mb-1">🍪 Cookie Authentication</p>
                              <p>Use this for <strong>traditional web applications</strong> where authentication state is stored in a browser cookie. Typically used with a custom login page.</p>
                            }
                          }
                        </div>

                        <!-- JWT Bearer Configuration -->
                        @if (editConfig.authScheme === 'JwtBearer') {
                          <div class="space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <h4 class="font-semibold text-sm text-blue-800">JWT Bearer Settings</h4>

                            <div>
                              <label class="block text-sm font-medium text-gray-700 mb-1">Authority (Issuer URL)</label>
                              <input
                                type="text"
                                [(ngModel)]="editConfig.jwtAuthority"
                                class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                                placeholder="https://login.microsoftonline.com/{tenant}/v2.0">
                              <p class="text-xs text-gray-500 mt-1">The URL of the token issuer (identity provider)</p>
                            </div>

                            <div>
                              <label class="block text-sm font-medium text-gray-700 mb-1">Audience</label>
                              <input
                                type="text"
                                [(ngModel)]="editConfig.jwtAudience"
                                class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                                placeholder="api://my-api-client-id">
                              <p class="text-xs text-gray-500 mt-1">The intended recipient of the token (your API identifier)</p>
                            </div>

                            <div class="grid grid-cols-2 gap-3">
                              <label class="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  [(ngModel)]="editConfig.jwtValidateIssuer"
                                  class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary">
                                <span class="text-sm text-gray-700">Validate Issuer</span>
                              </label>
                              <label class="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  [(ngModel)]="editConfig.jwtValidateAudience"
                                  class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary">
                                <span class="text-sm text-gray-700">Validate Audience</span>
                              </label>
                              <label class="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  [(ngModel)]="editConfig.jwtValidateLifetime"
                                  class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary">
                                <span class="text-sm text-gray-700">Validate Lifetime</span>
                              </label>
                              <label class="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  [(ngModel)]="editConfig.jwtRequireHttpsMetadata"
                                  class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary">
                                <span class="text-sm text-gray-700">Require HTTPS Metadata</span>
                              </label>
                            </div>
                          </div>
                        }

                        <!-- OpenID Connect Configuration -->
                        @if (editConfig.authScheme === 'OpenIdConnect') {
                          <div class="space-y-3 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                            <h4 class="font-semibold text-sm text-purple-800">OpenID Connect Settings</h4>

                            <div>
                              <label class="block text-sm font-medium text-gray-700 mb-1">Authority</label>
                              <input
                                type="text"
                                [(ngModel)]="editConfig.oidcAuthority"
                                class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                                placeholder="https://login.microsoftonline.com/{tenant}/v2.0">
                              <p class="text-xs text-gray-500 mt-1">The OpenID Connect provider URL</p>
                            </div>

                            <div class="grid grid-cols-2 gap-3">
                              <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
                                <input
                                  type="text"
                                  [(ngModel)]="editConfig.oidcClientId"
                                  class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                                  placeholder="your-client-id">
                              </div>
                              <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Client Secret</label>
                                <input
                                  type="password"
                                  [(ngModel)]="editConfig.oidcClientSecret"
                                  class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                                  placeholder="••••••••">
                              </div>
                            </div>

                            <div>
                              <label class="block text-sm font-medium text-gray-700 mb-1">Response Type</label>
                              <select
                                [(ngModel)]="editConfig.oidcResponseType"
                                class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500">
                                <option value="code">Authorization Code (code)</option>
                                <option value="id_token">ID Token (id_token)</option>
                                <option value="code id_token">Hybrid (code id_token)</option>
                              </select>
                            </div>

                            <div>
                              <label class="block text-sm font-medium text-gray-700 mb-1">Scopes (comma-separated)</label>
                              <input
                                type="text"
                                [(ngModel)]="editConfig.oidcScopesText"
                                class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                                placeholder="openid, profile, email">
                            </div>

                            <div class="grid grid-cols-2 gap-3">
                              <label class="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  [(ngModel)]="editConfig.oidcSaveTokens"
                                  class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary">
                                <span class="text-sm text-gray-700">Save Tokens</span>
                              </label>
                              <label class="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  [(ngModel)]="editConfig.oidcGetClaimsFromUserInfoEndpoint"
                                  class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary">
                                <span class="text-sm text-gray-700">Get Claims from UserInfo</span>
                              </label>
                            </div>
                          </div>
                        }

                        <!-- Cookie Configuration -->
                        @if (editConfig.authScheme === 'Cookie') {
                          <div class="space-y-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <h4 class="font-semibold text-sm text-green-800">Cookie Authentication Settings</h4>

                            <div>
                              <label class="block text-sm font-medium text-gray-700 mb-1">Cookie Name</label>
                              <input
                                type="text"
                                [(ngModel)]="editConfig.cookieName"
                                class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                                placeholder=".AspNetCore.Cookies">
                            </div>

                            <div class="grid grid-cols-2 gap-3">
                              <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Login Path</label>
                                <input
                                  type="text"
                                  [(ngModel)]="editConfig.cookieLoginPath"
                                  class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                                  placeholder="/Account/Login">
                              </div>
                              <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Logout Path</label>
                                <input
                                  type="text"
                                  [(ngModel)]="editConfig.cookieLogoutPath"
                                  class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                                  placeholder="/Account/Logout">
                              </div>
                            </div>

                            <div>
                              <label class="block text-sm font-medium text-gray-700 mb-1">Access Denied Path</label>
                              <input
                                type="text"
                                [(ngModel)]="editConfig.cookieAccessDeniedPath"
                                class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                                placeholder="/Account/AccessDenied">
                            </div>

                            <div class="grid grid-cols-2 gap-3">
                              <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Expire (minutes)</label>
                                <input
                                  type="number"
                                  [(ngModel)]="editConfig.cookieExpireMinutes"
                                  class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                                  placeholder="60">
                              </div>
                              <div class="flex items-end pb-2">
                                <label class="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    [(ngModel)]="editConfig.cookieSlidingExpiration"
                                    class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary">
                                  <span class="text-sm text-gray-700">Sliding Expiration</span>
                                </label>
                              </div>
                            </div>
                          </div>
                        }
                      </div>
                    }
                    @case ('Authorization') {
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">
                          Required Policies (comma-separated)
                        </label>
                        <input
                          type="text"
                          [(ngModel)]="editConfig.policiesText"
                          class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                          placeholder="admin, manager">
                      </div>
                    }
                    @case ('CORS') {
                      <div class="space-y-3">
                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1">
                            Allowed Origins (comma-separated)
                          </label>
                          <input
                            type="text"
                            [(ngModel)]="editConfig.allowedOriginsText"
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                            placeholder="https://example.com, https://app.example.com">
                        </div>
                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1">
                            Allowed Methods (comma-separated)
                          </label>
                          <input
                            type="text"
                            [(ngModel)]="editConfig.allowedMethodsText"
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                            placeholder="GET, POST, PUT, DELETE">
                        </div>
                        <div class="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="allowCreds"
                            [(ngModel)]="editConfig.allowCredentials"
                            class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary">
                          <label for="allowCreds" class="text-sm font-medium text-gray-700">
                            Allow Credentials
                          </label>
                        </div>
                      </div>
                    }
                    @case ('StaticFiles') {
                      <div class="space-y-3">
                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1">Directory</label>
                          <input
                            type="text"
                            [(ngModel)]="editConfig.directory"
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                            placeholder="wwwroot">
                        </div>
                      </div>
                    }
                    @case ('ExceptionHandling') {
                      <div class="space-y-4">
                        <!-- IExceptionHandler Toggle -->
                        <div class="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="useIExceptionHandler"
                            [(ngModel)]="editConfig.useIExceptionHandler"
                            class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary">
                          <label for="useIExceptionHandler" class="text-sm font-medium text-gray-700">
                            Use IExceptionHandler (TryHandleAsync pattern)
                          </label>
                        </div>

                        @if (editConfig.useIExceptionHandler) {
                          <!-- IExceptionHandler Configuration -->
                          <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
                            <div class="text-xs text-blue-800">
                              <p class="font-semibold mb-2">📘 IExceptionHandler Pattern</p>
                              <p class="mb-2">The <code class="bg-blue-100 px-1 rounded">TryHandleAsync</code> method returns a <code class="bg-blue-100 px-1 rounded">ValueTask&lt;bool&gt;</code>:</p>
                              <ul class="list-disc ml-4 space-y-1">
                                <li><strong>true</strong> = Exception is handled. ASP.NET Core stops calling other handlers.</li>
                                <li><strong>false</strong> = Exception is NOT handled. The next registered IExceptionHandler is called.</li>
                              </ul>
                              <p class="mt-2">Handlers are called in the order they are registered with <code class="bg-blue-100 px-1 rounded">AddExceptionHandler&lt;T&gt;()</code>.</p>
                            </div>

                            <div>
                              <label class="block text-sm font-medium text-gray-700 mb-1">Handler Class Name</label>
                              <input
                                type="text"
                                [(ngModel)]="editConfig.exceptionHandlerClass"
                                class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                                placeholder="GlobalExceptionHandler">
                            </div>

                            <div>
                              <label class="block text-sm font-medium text-gray-700 mb-2">TryHandleAsync Return Value</label>
                              <div class="space-y-2">
                                <label class="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    [value]="true"
                                    [(ngModel)]="editConfig.returnHandled"
                                    name="returnHandled"
                                    class="w-4 h-4 text-brand-primary border-gray-300 focus:ring-brand-primary">
                                  <span class="text-sm text-gray-700">
                                    <strong class="text-green-700">Return true</strong> — Exception is handled, stop calling other handlers
                                  </span>
                                </label>
                                <label class="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    [value]="false"
                                    [(ngModel)]="editConfig.returnHandled"
                                    name="returnHandled"
                                    class="w-4 h-4 text-brand-primary border-gray-300 focus:ring-brand-primary">
                                  <span class="text-sm text-gray-700">
                                    <strong class="text-yellow-700">Return false</strong> — Pass to next handler in registration order
                                  </span>
                                </label>
                              </div>
                            </div>
                          </div>
                        } @else {
                          <!-- Standard Error Handler Route -->
                          <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">
                              Error Handler Route
                            </label>
                            <input
                              type="text"
                              [(ngModel)]="editConfig.errorHandlerRoute"
                              class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                              placeholder="/error">
                          </div>
                        }
                      </div>
                    }
                    @case ('Compression') {
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Algorithms</label>
                        <div class="space-y-2">
                          <label class="flex items-center gap-2">
                            <input
                              type="checkbox"
                              [(ngModel)]="editConfig.gzip"
                              class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary">
                            <span class="text-sm text-gray-700">gzip</span>
                          </label>
                          <label class="flex items-center gap-2">
                            <input
                              type="checkbox"
                              [(ngModel)]="editConfig.brotli"
                              class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary">
                            <span class="text-sm text-gray-700">brotli</span>
                          </label>
                          <label class="flex items-center gap-2">
                            <input
                              type="checkbox"
                              [(ngModel)]="editConfig.deflate"
                              class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary">
                            <span class="text-sm text-gray-700">deflate</span>
                          </label>
                        </div>
                      </div>
                    }
                    @case ('RateLimiting') {
                      <div class="space-y-4">
                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1">Policy Name</label>
                          <input
                            type="text"
                            [(ngModel)]="editConfig.policyName"
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                            placeholder="fixed">
                        </div>

                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1">Limiter Type</label>
                          <select
                            [(ngModel)]="editConfig.limiterType"
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500">
                            <option value="FixedWindow">Fixed Window</option>
                            <option value="SlidingWindow">Sliding Window</option>
                            <option value="TokenBucket">Token Bucket</option>
                            <option value="Concurrency">Concurrency</option>
                          </select>
                        </div>

                        <!-- Limiter Type Explanation -->
                        <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                          @switch (editConfig.limiterType) {
                            @case ('FixedWindow') {
                              <p class="font-semibold mb-1">⏱️ Fixed Window Limiter</p>
                              <p>Limits requests in fixed time windows (e.g., 100 requests per minute). Counter resets at the start of each window. Simple but can allow burst traffic at window boundaries.</p>
                            }
                            @case ('SlidingWindow') {
                              <p class="font-semibold mb-1">📊 Sliding Window Limiter</p>
                              <p>Similar to Fixed Window but divides the window into segments. Provides smoother rate limiting by considering requests from the previous window proportionally.</p>
                            }
                            @case ('TokenBucket') {
                              <p class="font-semibold mb-1">🪣 Token Bucket Limiter</p>
                              <p>Tokens are added at a fixed rate. Each request consumes a token. Allows controlled bursts while maintaining average rate. Great for APIs with variable traffic.</p>
                            }
                            @case ('Concurrency') {
                              <p class="font-semibold mb-1">🔄 Concurrency Limiter</p>
                              <p>Limits the number of concurrent requests (not rate). Ideal for protecting resources with limited capacity like database connections.</p>
                            }
                          }
                        </div>

                        @if (editConfig.limiterType !== 'Concurrency') {
                          <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">
                              {{ editConfig.limiterType === 'TokenBucket' ? 'Token Limit' : 'Permit Limit' }}
                            </label>
                            <input
                              type="number"
                              [(ngModel)]="editConfig.permitLimit"
                              class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                              placeholder="100">
                          </div>
                        } @else {
                          <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Max Concurrent Requests</label>
                            <input
                              type="number"
                              [(ngModel)]="editConfig.permitLimit"
                              class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                              placeholder="10">
                          </div>
                        }

                        @if (editConfig.limiterType === 'FixedWindow' || editConfig.limiterType === 'SlidingWindow') {
                          <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Window (seconds)</label>
                            <input
                              type="number"
                              [(ngModel)]="editConfig.window"
                              class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                              placeholder="60">
                          </div>
                        }

                        @if (editConfig.limiterType === 'TokenBucket') {
                          <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Tokens Per Period</label>
                            <input
                              type="number"
                              [(ngModel)]="editConfig.tokensPerPeriod"
                              class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                              placeholder="10">
                          </div>
                          <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Replenishment Period (seconds)</label>
                            <input
                              type="number"
                              [(ngModel)]="editConfig.replenishmentPeriod"
                              class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                              placeholder="30">
                          </div>
                        }

                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1">Queue Limit</label>
                          <input
                            type="number"
                            [(ngModel)]="editConfig.queueLimit"
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                            placeholder="0">
                          <p class="text-xs text-gray-500 mt-1">Number of requests to queue when limit is reached (0 = no queue)</p>
                        </div>
                      </div>
                    }
                    @case ('Custom') {
                      <div class="space-y-3">
                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1">Class Name</label>
                          <input
                            type="text"
                            [(ngModel)]="editConfig.className"
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                            placeholder="MyCustomMiddleware">
                        </div>
                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1">Custom Code</label>
                          <textarea
                            [(ngModel)]="editConfig.customCode"
                            class="w-full h-32 px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500 resize-none font-mono text-sm"
                            placeholder="// Custom middleware logic"></textarea>
                        </div>
                      </div>
                    }
                    @case ('MinimalAPIEndpoint') {
                      <div class="space-y-3">
                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1">HTTP Method</label>
                          <select
                            [(ngModel)]="editConfig.httpMethod"
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
                            [(ngModel)]="editConfig.path"
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                            placeholder="/api/users">
                        </div>
                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1">Handler Code</label>
                          <textarea
                            [(ngModel)]="editConfig.handlerCode"
                            class="w-full h-32 px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500 resize-none font-mono text-sm"
                            placeholder="() => Results.Ok(new { message = &quot;Hello&quot; })"></textarea>
                        </div>
                      </div>
                    }
                  }

                  <!-- Branch Configuration -->
                  <div class="pt-4 border-t-2 border-gray-200">
                    <div class="flex items-center justify-between mb-3">
                      <label class="text-sm font-medium text-gray-700">Add Conditional Branch</label>
                      <input
                        type="checkbox"
                        [(ngModel)]="editConfig.hasBranch"
                        class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary">
                    </div>

                    @if (editConfig.hasBranch) {
                      <div class="space-y-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <div class="grid grid-cols-2 gap-3">
                          <div>
                            <label class="block text-xs font-medium text-gray-700 mb-1">Condition Type</label>
                            <select
                              [(ngModel)]="editConfig.branchConditionType"
                              class="w-full px-2 py-1.5 text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500">
                              <option value="header">Header</option>
                              <option value="method">Method</option>
                              <option value="path">Path</option>
                              <option value="claim">Claim</option>
                              <option value="authenticated">Is Authenticated</option>
                            </select>
                          </div>
                          <div>
                            <label class="block text-xs font-medium text-gray-700 mb-1">Operator</label>
                            <select
                              [(ngModel)]="editConfig.branchOperator"
                              class="w-full px-2 py-1.5 text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500">
                              <option value="==">Equals (==)</option>
                              <option value="!=">Not Equals (!=)</option>
                              <option value="contains">Contains</option>
                              <option value="startsWith">Starts With</option>
                              <option value="endsWith">Ends With</option>
                            </select>
                          </div>
                        </div>

                        @if (editConfig.branchConditionType !== 'authenticated') {
                          <div class="grid grid-cols-2 gap-3">
                            @if (editConfig.branchConditionType === 'header' || editConfig.branchConditionType === 'claim') {
                              <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Key</label>
                                <input
                                  type="text"
                                  [(ngModel)]="editConfig.branchKey"
                                  class="w-full px-2 py-1.5 text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                                  placeholder="X-API-Key">
                              </div>
                            }
                            <div [class.col-span-2]="editConfig.branchConditionType !== 'header' && editConfig.branchConditionType !== 'claim'">
                              <label class="block text-xs font-medium text-gray-700 mb-1">Value</label>
                              <input
                                type="text"
                                [(ngModel)]="editConfig.branchValue"
                                class="w-full px-2 py-1.5 text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                                placeholder="expected-value">
                            </div>
                          </div>
                        }
                      </div>
                    }
                  </div>
                </div>

                <div class="flex gap-3 mt-6">
                  <button
                    (click)="saveMiddlewareConfig()"
                    class="flex-1 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-blue-800 hover:shadow-md transition-all font-medium">
                    Save Changes
                  </button>
                  <button
                    (click)="closeEditModal()"
                    class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-medium">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        }
    </div>
  `,
})
export class MiddlewareDesignerComponent {
  private readonly service = inject(MiddlewareDesignerService);

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
  protected editConfig: any = {};

  // Middleware library
  protected readonly middlewareLibrary: MiddlewareLibraryItemData[] = [
    {
      type: 'Authentication',
      name: 'Authentication',
      icon: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
      description: 'JWT Bearer, OpenID Connect, or Cookie authentication',
      defaultConfig: { authScheme: 'JwtBearer', jwtValidateIssuer: true, jwtValidateAudience: true, jwtValidateLifetime: true, jwtRequireHttpsMetadata: true },
    },
    {
      type: 'Authorization',
      name: 'Authorization',
      icon: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
      description: 'Check user permissions',
      defaultConfig: { policies: [] },
    },
    {
      type: 'CORS',
      name: 'CORS',
      icon: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',
      description: 'Configure cross-origin requests',
      defaultConfig: { allowedOrigins: ['*'], allowedMethods: ['GET', 'POST'] },
    },
    {
      type: 'StaticFiles',
      name: 'Static Files',
      icon: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>',
      description: 'Serve static files',
      defaultConfig: { directory: 'wwwroot' },
    },
    {
      type: 'ExceptionHandling',
      name: 'Exception Handling',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>',
      description: 'Handle exceptions globally (supports IExceptionHandler)',
      defaultConfig: { errorHandlerRoute: '/error' },
    },
    {
      type: 'Compression',
      name: 'Compression',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">  <path stroke-linecap="round" stroke-linejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>\n',
      description: 'Compress responses',
      defaultConfig: { algorithms: ['gzip', 'brotli'] },
    },
    {
      type: 'RateLimiting',
      name: 'Rate Limiting',
      icon: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
      description: 'Limit request rates to protect your API',
      defaultConfig: { policyName: 'fixed', limiterType: 'FixedWindow', permitLimit: 100, window: 60, queueLimit: 0 },
    },
    {
      type: 'MinimalAPIEndpoint',
      name: 'Minimal API Endpoint',
      icon: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>',
      description: 'Define a minimal API endpoint',
      defaultConfig: { httpMethod: 'GET', path: '/api/hello', handlerCode: '() => "Hello World"' },
    },
    {
      type: 'Custom',
      name: 'Custom Middleware',
      icon: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
      description: 'Add custom middleware logic',
      defaultConfig: { className: 'MyMiddleware', customCode: '' },
    },
  ];

  constructor() {
    // Auto-validate and generate code when pipeline changes
    effect(() => {
      const p = this.pipeline();
      this.validationResult.set(this.service.validatePipeline(p));
      if (p.middlewares.length > 0) {
        this.generatedCode.set(this.service.generateCSharpCode(p));
      } else {
        this.generatedCode.set('// Add middleware to generate code');
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
    const config = middleware.config as MiddlewareConfig;

    // Initialize edit config based on middleware type
    this.editConfig = {
      // Routing
      routesText: config.routes?.join('\n') || '',
      // Auth - new scheme-based config
      authScheme: config.authScheme || 'JwtBearer',
      // JWT Bearer settings
      jwtAuthority: config.jwtAuthority || '',
      jwtAudience: config.jwtAudience || '',
      jwtValidateIssuer: config.jwtValidateIssuer ?? true,
      jwtValidateAudience: config.jwtValidateAudience ?? true,
      jwtValidateLifetime: config.jwtValidateLifetime ?? true,
      jwtRequireHttpsMetadata: config.jwtRequireHttpsMetadata ?? true,
      // OpenID Connect settings
      oidcAuthority: config.oidcAuthority || '',
      oidcClientId: config.oidcClientId || '',
      oidcClientSecret: config.oidcClientSecret || '',
      oidcResponseType: config.oidcResponseType || 'code',
      oidcScopesText: config.oidcScopes?.join(', ') || 'openid, profile, email',
      oidcSaveTokens: config.oidcSaveTokens ?? true,
      oidcGetClaimsFromUserInfoEndpoint: config.oidcGetClaimsFromUserInfoEndpoint ?? true,
      // Cookie settings
      cookieName: config.cookieName || '.AspNetCore.Cookies',
      cookieLoginPath: config.cookieLoginPath || '/Account/Login',
      cookieLogoutPath: config.cookieLogoutPath || '/Account/Logout',
      cookieAccessDeniedPath: config.cookieAccessDeniedPath || '/Account/AccessDenied',
      cookieExpireMinutes: config.cookieExpireMinutes || 60,
      cookieSlidingExpiration: config.cookieSlidingExpiration ?? true,
      // Authz
      policiesText: config.policies?.join(', ') || '',
      // CORS
      allowedOriginsText: config.allowedOrigins?.join(', ') || '',
      allowedMethodsText: config.allowedMethods?.join(', ') || '',
      allowCredentials: config.allowCredentials || false,
      // Static Files
      directory: config.directory || 'wwwroot',
      // Exception Handling
      errorHandlerRoute: config.errorHandlerRoute || '/error',
      useIExceptionHandler: config.useIExceptionHandler || false,
      exceptionHandlerClass: config.exceptionHandlerClass || 'GlobalExceptionHandler',
      returnHandled: config.returnHandled ?? true,
      // Compression
      gzip: config.algorithms?.includes('gzip') || false,
      brotli: config.algorithms?.includes('brotli') || false,
      deflate: config.algorithms?.includes('deflate') || false,
      // Rate Limiting
      policyName: config.policyName || 'fixed',
      limiterType: config.limiterType || 'FixedWindow',
      permitLimit: config.permitLimit || 100,
      window: config.window || 60,
      queueLimit: config.queueLimit || 0,
      tokensPerPeriod: config.tokensPerPeriod || 10,
      replenishmentPeriod: config.replenishmentPeriod || 30,
      // Custom
      className: config.className || '',
      customCode: config.customCode || '',
      // Minimal API
      httpMethod: config.httpMethod || 'GET',
      path: config.path || '',
      handlerCode: config.handlerCode || '',
      // Branch
      hasBranch: !!middleware.branch,
      branchConditionType: middleware.branch?.condition.type || 'header',
      branchOperator: middleware.branch?.condition.operator || '==',
      branchKey: middleware.branch?.condition.key || '',
      branchValue: middleware.branch?.condition.value || '',
    };
  }

  protected saveMiddlewareConfig(): void {
    const middleware = this.selectedMiddleware();
    if (!middleware) return;

    const newConfig: MiddlewareConfig = {};

    // Build config based on type
    switch (middleware.type) {
      case 'Routing':
        newConfig.routes = this.editConfig.routesText
          .split('\n')
          .map((s: string) => s.trim())
          .filter((s: string) => s);
        break;
      case 'Authentication':
        newConfig.authScheme = this.editConfig.authScheme;
        // JWT Bearer settings
        newConfig.jwtAuthority = this.editConfig.jwtAuthority;
        newConfig.jwtAudience = this.editConfig.jwtAudience;
        newConfig.jwtValidateIssuer = this.editConfig.jwtValidateIssuer;
        newConfig.jwtValidateAudience = this.editConfig.jwtValidateAudience;
        newConfig.jwtValidateLifetime = this.editConfig.jwtValidateLifetime;
        newConfig.jwtRequireHttpsMetadata = this.editConfig.jwtRequireHttpsMetadata;
        // OpenID Connect settings
        newConfig.oidcAuthority = this.editConfig.oidcAuthority;
        newConfig.oidcClientId = this.editConfig.oidcClientId;
        newConfig.oidcClientSecret = this.editConfig.oidcClientSecret;
        newConfig.oidcResponseType = this.editConfig.oidcResponseType;
        newConfig.oidcScopes = this.editConfig.oidcScopesText
          ?.split(',')
          .map((s: string) => s.trim())
          .filter((s: string) => s) || ['openid', 'profile', 'email'];
        newConfig.oidcSaveTokens = this.editConfig.oidcSaveTokens;
        newConfig.oidcGetClaimsFromUserInfoEndpoint = this.editConfig.oidcGetClaimsFromUserInfoEndpoint;
        // Cookie settings
        newConfig.cookieName = this.editConfig.cookieName;
        newConfig.cookieLoginPath = this.editConfig.cookieLoginPath;
        newConfig.cookieLogoutPath = this.editConfig.cookieLogoutPath;
        newConfig.cookieAccessDeniedPath = this.editConfig.cookieAccessDeniedPath;
        newConfig.cookieExpireMinutes = this.editConfig.cookieExpireMinutes;
        newConfig.cookieSlidingExpiration = this.editConfig.cookieSlidingExpiration;
        break;
      case 'Authorization':
        newConfig.policies = this.editConfig.policiesText
          .split(',')
          .map((s: string) => s.trim())
          .filter((s: string) => s);
        break;
      case 'CORS':
        newConfig.allowedOrigins = this.editConfig.allowedOriginsText
          .split(',')
          .map((s: string) => s.trim())
          .filter((s: string) => s);
        newConfig.allowedMethods = this.editConfig.allowedMethodsText
          .split(',')
          .map((s: string) => s.trim())
          .filter((s: string) => s);
        newConfig.allowCredentials = this.editConfig.allowCredentials;
        break;
      case 'StaticFiles':
        newConfig.directory = this.editConfig.directory;
        break;
      case 'ExceptionHandling':
        newConfig.errorHandlerRoute = this.editConfig.errorHandlerRoute;
        newConfig.useIExceptionHandler = this.editConfig.useIExceptionHandler;
        newConfig.exceptionHandlerClass = this.editConfig.exceptionHandlerClass;
        newConfig.returnHandled = this.editConfig.returnHandled;
        break;
      case 'Compression':
        newConfig.algorithms = [];
        if (this.editConfig.gzip) newConfig.algorithms.push('gzip');
        if (this.editConfig.brotli) newConfig.algorithms.push('brotli');
        if (this.editConfig.deflate) newConfig.algorithms.push('deflate');
        break;
      case 'RateLimiting':
        newConfig.policyName = this.editConfig.policyName;
        newConfig.limiterType = this.editConfig.limiterType;
        newConfig.permitLimit = this.editConfig.permitLimit;
        newConfig.window = this.editConfig.window;
        newConfig.queueLimit = this.editConfig.queueLimit;
        newConfig.tokensPerPeriod = this.editConfig.tokensPerPeriod;
        newConfig.replenishmentPeriod = this.editConfig.replenishmentPeriod;
        break;
      case 'Custom':
        newConfig.className = this.editConfig.className;
        newConfig.customCode = this.editConfig.customCode;
        break;
      case 'MinimalAPIEndpoint':
        newConfig.httpMethod = this.editConfig.httpMethod;
        newConfig.path = this.editConfig.path;
        newConfig.handlerCode = this.editConfig.handlerCode;
        break;
    }

    // Handle branch
    let branch = undefined;
    if (this.editConfig.hasBranch) {
      const condition: BranchCondition = {
        type: this.editConfig.branchConditionType,
        operator: this.editConfig.branchOperator,
        key: this.editConfig.branchKey,
        value: this.editConfig.branchValue,
      };
      branch = { condition, onTrue: [], onFalse: [] };
    }

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
    this.editConfig = {};
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
    const config = middleware.config as MiddlewareConfig;

    switch (middleware.type) {
      case 'Routing':
        return `Routes: ${config.routes?.join(', ') || 'none'}`;
      case 'Authentication':
        const scheme = config.authScheme || 'JwtBearer';
        switch (scheme) {
          case 'JwtBearer':
            return `JWT Bearer: ${config.jwtAuthority || 'Configure authority'}`;
          case 'OpenIdConnect':
            return `OIDC: ${config.oidcAuthority || 'Configure authority'}`;
          case 'Cookie':
            return `Cookie: ${config.cookieLoginPath || '/Account/Login'}`;
          default:
            return `Scheme: ${scheme}`;
        }
      case 'Authorization':
        return `Policies: ${config.policies?.join(', ') || 'none'}`;
      case 'CORS':
        return `Origins: ${config.allowedOrigins?.join(', ') || 'none'}`;
      case 'StaticFiles':
        return `Directory: ${config.directory || 'wwwroot'}`;
      case 'ExceptionHandling':
        if (config.useIExceptionHandler) {
          return `IExceptionHandler: ${config.exceptionHandlerClass || 'Handler'} (returns ${config.returnHandled ? 'true' : 'false'})`;
        }
        return `Route: ${config.errorHandlerRoute || '/error'}`;
      case 'Compression':
        return `Algorithms: ${config.algorithms?.join(', ') || 'none'}`;
      case 'RateLimiting':
        return `${config.limiterType || 'FixedWindow'}: ${config.permitLimit || 100}/${config.window || 60}s (${config.policyName || 'default'})`;
      case 'Custom':
        return `Class: ${config.className || 'Anonymous'}`;
      case 'MinimalAPIEndpoint':
        return `${config.httpMethod} ${config.path}`;
      default:
        return '';
    }
  }

  protected getBranchConditionText(condition: BranchCondition): string {
    const parts: string[] = [condition.type, condition.operator];
    if (condition.key) parts.push(`[${condition.key}]`);
    if (condition.value) parts.push(`"${condition.value}"`);
    return parts.join(' ');
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
