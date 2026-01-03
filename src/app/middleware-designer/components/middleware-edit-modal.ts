import { Component, input, output, ChangeDetectionStrategy, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { MiddlewareNode } from '../models';
import { EditConfig } from '../middleware-config.utils';

@Component({
  selector: 'app-middleware-edit-modal',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (middleware(); as mw) {
      <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div class="p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-xl font-bold text-gray-800">
                Edit {{ mw.type }}
              </h2>
              <button
                (click)="dismiss.emit()"
                class="text-gray-500 hover:text-gray-700 text-2xl leading-none">
                ×
              </button>
            </div>

            <div class="space-y-4">
              <!-- Dynamic config form based on middleware type -->
              @switch (mw.type) {
                @case ('Routing') {
                  <div>
                    <label for="routing-patterns" class="block text-sm font-medium text-gray-700 mb-1">
                      Route Patterns (one per line)
                    </label>
                    <textarea
                      id="routing-patterns"
                      [(ngModel)]="config().routesText"
                      class="w-full h-32 px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500 resize-none font-mono text-sm"
                      placeholder="/api/*&#10;/users/:id"></textarea>
                  </div>
                }
                @case ('Authentication') {
                  <div class="space-y-4">
                    <div>
                      <label for="auth-scheme" class="block text-sm font-medium text-gray-700 mb-1">Authentication Scheme</label>
                      <select
                        id="auth-scheme"
                        [(ngModel)]="config().authScheme"
                        class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500">
                        <option value="JwtBearer">JWT Bearer (API)</option>
                        <option value="OpenIdConnect">OpenID Connect (Web App)</option>
                        <option value="Cookie">Cookie Authentication</option>
                      </select>
                    </div>

                    <!-- Scheme Explanation -->
                    <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                      @switch (config().authScheme) {
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
                    @if (config().authScheme === 'JwtBearer') {
                      <div class="space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 class="font-semibold text-sm text-blue-800">JWT Bearer Settings</h4>

                        <div>
                          <label for="jwt-authority" class="block text-sm font-medium text-gray-700 mb-1">Authority (Issuer URL)</label>
                          <input
                            id="jwt-authority"
                            type="text"
                            [(ngModel)]="config().jwtAuthority"
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                            placeholder="https://login.microsoftonline.com/{tenant}/v2.0">
                          <p class="text-xs text-gray-500 mt-1">The URL of the token issuer (identity provider)</p>
                        </div>

                        <div>
                          <label for="jwt-audience" class="block text-sm font-medium text-gray-700 mb-1">Audience</label>
                          <input
                            id="jwt-audience"
                            type="text"
                            [(ngModel)]="config().jwtAudience"
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                            placeholder="api://my-api-client-id">
                          <p class="text-xs text-gray-500 mt-1">The intended recipient of the token (your API identifier)</p>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                          <label class="flex items-center gap-2">
                            <input
                              type="checkbox"
                              [(ngModel)]="config().jwtValidateIssuer"
                              class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary">
                            <span class="text-sm text-gray-700">Validate Issuer</span>
                          </label>
                          <label class="flex items-center gap-2">
                            <input
                              type="checkbox"
                              [(ngModel)]="config().jwtValidateAudience"
                              class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary">
                            <span class="text-sm text-gray-700">Validate Audience</span>
                          </label>
                          <label class="flex items-center gap-2">
                            <input
                              type="checkbox"
                              [(ngModel)]="config().jwtValidateLifetime"
                              class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary">
                            <span class="text-sm text-gray-700">Validate Lifetime</span>
                          </label>
                          <label class="flex items-center gap-2">
                            <input
                              type="checkbox"
                              [(ngModel)]="config().jwtRequireHttpsMetadata"
                              class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary">
                            <span class="text-sm text-gray-700">Require HTTPS Metadata</span>
                          </label>
                        </div>
                      </div>
                    }

                    <!-- OpenID Connect Configuration -->
                    @if (config().authScheme === 'OpenIdConnect') {
                      <div class="space-y-3 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <h4 class="font-semibold text-sm text-purple-800">OpenID Connect Settings</h4>

                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1" for="authority">
              Authority
            </label>
            <input
              id="authority"
                            type="text"
                            [(ngModel)]="config().oidcAuthority"
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                            placeholder="https://login.microsoftonline.com/{tenant}/v2.0">
                          <p class="text-xs text-gray-500 mt-1">The OpenID Connect provider URL</p>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                          <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1" for="client-id">
              Client ID
            </label>
            <input
              id="client-id"
                              type="text"
                              [(ngModel)]="config().oidcClientId"
                              class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                              placeholder="your-client-id">
                          </div>
                          <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1" for="client-secret">
              Client Secret
            </label>
            <input
              id="client-secret"
                              type="password"
                              [(ngModel)]="config().oidcClientSecret"
                              class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                              placeholder="••••••••">
                          </div>
                        </div>

                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1" for="response-type">
              Response Type
            </label>
            <select
              id="response-type"
                            [(ngModel)]="config().oidcResponseType"
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500">
                            <option value="code">Authorization Code (code)</option>
                            <option value="id_token">ID Token (id_token)</option>
                            <option value="code id_token">Hybrid (code id_token)</option>
                          </select>
                        </div>

                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1" for="scopes--comma-separated">
              Scopes (comma-separated)
            </label>
            <input
              id="scopes--comma-separated"
                            type="text"
                            [(ngModel)]="config().oidcScopesText"
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                            placeholder="openid, profile, email">
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                          <label class="flex items-center gap-2">
                            <input
                              type="checkbox"
                              [(ngModel)]="config().oidcSaveTokens"
                              class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary">
                            <span class="text-sm text-gray-700">Save Tokens</span>
                          </label>
                          <label class="flex items-center gap-2">
                            <input
                              type="checkbox"
                              [(ngModel)]="config().oidcGetClaimsFromUserInfoEndpoint"
                              class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary">
                            <span class="text-sm text-gray-700">Get Claims from UserInfo</span>
                          </label>
                        </div>
                      </div>
                    }

                    <!-- Cookie Configuration -->
                    @if (config().authScheme === 'Cookie') {
                      <div class="space-y-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <h4 class="font-semibold text-sm text-green-800">Cookie Authentication Settings</h4>

                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1" for="cookie-name">
              Cookie Name
            </label>
            <input
              id="cookie-name"
                            type="text"
                            [(ngModel)]="config().cookieName"
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                            placeholder=".AspNetCore.Cookies">
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                          <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1" for="login-path">
              Login Path
            </label>
            <input
              id="login-path"
                              type="text"
                              [(ngModel)]="config().cookieLoginPath"
                              class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                              placeholder="/Account/Login">
                          </div>
                          <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1" for="logout-path">
              Logout Path
            </label>
            <input
              id="logout-path"
                              type="text"
                              [(ngModel)]="config().cookieLogoutPath"
                              class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                              placeholder="/Account/Logout">
                          </div>
                        </div>

                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1" for="access-denied-path">
              Access Denied Path
            </label>
            <input
              id="access-denied-path"
                            type="text"
                            [(ngModel)]="config().cookieAccessDeniedPath"
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                            placeholder="/Account/AccessDenied">
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                          <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1" for="expire--minutes">
              Expire (minutes)
            </label>
            <input
              id="expire--minutes"
                              type="number"
                              [(ngModel)]="config().cookieExpireMinutes"
                              class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                              placeholder="60">
                          </div>
                          <div class="flex items-end pb-2">
                            <label class="flex items-center gap-2">
                              <input
                                type="checkbox"
                                [(ngModel)]="config().cookieSlidingExpiration"
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
                    <label class="block text-sm font-medium text-gray-700 mb-1" for="required-policies--comma-separ">
              Required Policies (comma-separated)
            </label>
            <input
              id="required-policies--comma-separ"
                      type="text"
                      [(ngModel)]="config().policiesText"
                      class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                      placeholder="admin, manager">
                  </div>
                }
                @case ('CORS') {
                  <div class="space-y-3">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="allowed-origins--comma-separat">
              Allowed Origins (comma-separated)
            </label>
            <input
              id="allowed-origins--comma-separat"
                        type="text"
                        [(ngModel)]="config().allowedOriginsText"
                        class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                        placeholder="https://example.com, https://app.example.com">
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="allowed-methods--comma-separat">
              Allowed Methods (comma-separated)
            </label>
            <input
              id="allowed-methods--comma-separat"
                        type="text"
                        [(ngModel)]="config().allowedMethodsText"
                        class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                        placeholder="GET, POST, PUT, DELETE">
                    </div>
                    <div class="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="allowCreds"
                        [(ngModel)]="config().allowCredentials"
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
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="directory">
              Directory
            </label>
            <input
              id="directory"
                        type="text"
                        [(ngModel)]="config().directory"
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
                        [(ngModel)]="config().useIExceptionHandler"
                        class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary">
                      <label for="useIExceptionHandler" class="text-sm font-medium text-gray-700">
                        Use IExceptionHandler (TryHandleAsync pattern)
                      </label>
                    </div>

                    @if (config().useIExceptionHandler) {
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
                          <label class="block text-sm font-medium text-gray-700 mb-1" for="handler-class-name">
              Handler Class Name
            </label>
            <input
              id="handler-class-name"
                            type="text"
                            [(ngModel)]="config().exceptionHandlerClass"
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                            placeholder="GlobalExceptionHandler">
                        </div>

                        <div>
                          <fieldset>
                            <legend class="block text-sm font-medium text-gray-700 mb-2">TryHandleAsync Return Value</legend>
                            <div class="space-y-2">
                              <label class="flex items-center gap-2">
                                <input
                                  type="radio"
                                  [value]="true"
                                [(ngModel)]="config().returnHandled"
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
                                [(ngModel)]="config().returnHandled"
                                name="returnHandled"
                                class="w-4 h-4 text-brand-primary border-gray-300 focus:ring-brand-primary">
                              <span class="text-sm text-gray-700">
                                <strong class="text-yellow-700">Return false</strong> — Pass to next handler in registration order
                              </span>
                            </label>
                          </div>
                          </fieldset>
                        </div>
                      </div>
                    } @else {
                      <!-- Standard Error Handler Route -->
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="error-handler-route">
              Error Handler Route
            </label>
            <input
              id="error-handler-route"
                          type="text"
                          [(ngModel)]="config().errorHandlerRoute"
                          class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                          placeholder="/error">
                      </div>
                    }
                  </div>
                }
                @case ('Compression') {
                  <div class="space-y-4">
                    <div>
                      <fieldset>
                        <legend class="block text-sm font-medium text-gray-700 mb-2">Algorithms</legend>
                        <div class="space-y-2">
                          <label class="flex items-center gap-2">
                            <input
                              type="checkbox"
                              [(ngModel)]="config().gzip"
                            class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary">
                          <span class="text-sm text-gray-700">gzip</span>
                        </label>
                        <label class="flex items-center gap-2">
                          <input
                            type="checkbox"
                            [(ngModel)]="config().brotli"
                            class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary">
                          <span class="text-sm text-gray-700">brotli</span>
                        </label>
                        <label class="flex items-center gap-2">
                          <input
                            type="checkbox"
                            [(ngModel)]="config().deflate"
                            class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary">
                          <span class="text-sm text-gray-700">deflate</span>
                        </label>
                      </div>
                      </fieldset>
                    </div>

                    <div>
                      <label class="flex items-center gap-2">
                        <input
                          type="checkbox"
                          [(ngModel)]="config().enableForHttps"
                          class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary">
                        <span class="text-sm text-gray-700">Enable for HTTPS</span>
                      </label>
                      @if (config().enableForHttps) {
                        <div class="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                          <p class="font-semibold mb-1">⚠️ Security Warning</p>
                          <p>Enabling compression for HTTPS has security implications. It can make your application vulnerable to CRIME and BREACH attacks. Only enable this if you understand the risks and have appropriate mitigations in place.</p>
                        </div>
                      }
                    </div>
                  </div>
                }
                @case ('RateLimiting') {
                  <div class="space-y-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="policy-name">
              Policy Name
            </label>
            <input
              id="policy-name"
                        type="text"
                        [(ngModel)]="config().policyName"
                        class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                        placeholder="fixed">
                    </div>

                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="limiter-type">
              Limiter Type
            </label>
            <select
              id="limiter-type"
                        [(ngModel)]="config().limiterType"
                        class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500">
                        <option value="FixedWindow">Fixed Window</option>
                        <option value="SlidingWindow">Sliding Window</option>
                        <option value="TokenBucket">Token Bucket</option>
                        <option value="Concurrency">Concurrency</option>
                      </select>
                    </div>

                    <!-- Limiter Type Explanation -->
                    <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                      @switch (config().limiterType) {
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

                    @if (config().limiterType !== 'Concurrency') {
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="config---limitertype------t">
              {{ config().limiterType === 'TokenBucket' ? 'Token Limit' : 'Permit Limit' }}
            </label>
            <input
              id="config---limitertype------t"
                          type="number"
                          [(ngModel)]="config().permitLimit"
                          class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                          placeholder="100">
                      </div>
                    } @else {
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="max-concurrent-requests">
              Max Concurrent Requests
            </label>
            <input
              id="max-concurrent-requests"
                          type="number"
                          [(ngModel)]="config().permitLimit"
                          class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                          placeholder="10">
                      </div>
                    }

                    @if (config().limiterType === 'FixedWindow' || config().limiterType === 'SlidingWindow') {
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="window--seconds">
              Window (seconds)
            </label>
            <input
              id="window--seconds"
                          type="number"
                          [(ngModel)]="config().window"
                          class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                          placeholder="60">
                      </div>
                    }

                    @if (config().limiterType === 'TokenBucket') {
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="tokens-per-period">
              Tokens Per Period
            </label>
            <input
              id="tokens-per-period"
                          type="number"
                          [(ngModel)]="config().tokensPerPeriod"
                          class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                          placeholder="10">
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="replenishment-period--seconds">
              Replenishment Period (seconds)
            </label>
            <input
              id="replenishment-period--seconds"
                          type="number"
                          [(ngModel)]="config().replenishmentPeriod"
                          class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                          placeholder="30">
                      </div>
                    }

                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="queue-limit">
              Queue Limit
            </label>
            <input
              id="queue-limit"
                        type="number"
                        [(ngModel)]="config().queueLimit"
                        class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                        placeholder="0">
                      <p class="text-xs text-gray-500 mt-1">Number of requests to queue when limit is reached (0 = no queue)</p>
                    </div>
                  </div>
                }
                @case ('Custom') {
                  <div class="space-y-3">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="class-name">
              Class Name
            </label>
            <input
              id="class-name"
                        type="text"
                        [(ngModel)]="config().className"
                        class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                        placeholder="MyCustomMiddleware">
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="custom-code">
              Custom Code
            </label>
            <textarea
              id="custom-code"
                        [(ngModel)]="config().customCode"
                        class="w-full h-32 px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500 resize-none font-mono text-sm"
                        placeholder="// Custom middleware logic"></textarea>
                    </div>
                  </div>
                }
                @case ('MinimalAPIEndpoint') {
                  <div class="space-y-3">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="http-method">
              HTTP Method
            </label>
            <select
              id="http-method"
                        [(ngModel)]="config().httpMethod"
                        class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500">
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                        <option value="PATCH">PATCH</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="path">
              Path
            </label>
            <input
              id="path"
                        type="text"
                        [(ngModel)]="config().path"
                        class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500"
                        placeholder="/api/users">
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="handler-code">
              Handler Code
            </label>
            <textarea
              id="handler-code"
                        [(ngModel)]="config().handlerCode"
                        class="w-full h-32 px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary-500 resize-none font-mono text-sm"
                        placeholder="() => Results.Ok(new { message = &quot;Hello&quot; })"></textarea>
                    </div>
                  </div>
                }
              }

              <!-- Branch Configuration -->
              <div class="pt-4 border-t-2 border-gray-200">
                <div class="flex items-center justify-between mb-3">
                  <label class="text-sm font-medium text-gray-700" for="add-conditional-branch">
              Add Conditional Branch
            </label>
            <input
              id="add-conditional-branch"
                    type="checkbox"
                    [(ngModel)]="config().hasBranch"
                    class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary">
                </div>

                @if (config().hasBranch) {
                  <div class="space-y-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label class="block text-xs font-medium text-gray-700 mb-1" for="condition-type">
              Condition Type
            </label>
            <select
              id="condition-type"
                          [(ngModel)]="config().branchConditionType"
                          class="w-full px-2 py-1.5 text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500">
                          <option value="header">Header</option>
                          <option value="method">Method</option>
                          <option value="path">Path</option>
                          <option value="claim">Claim</option>
                          <option value="authenticated">Is Authenticated</option>
                        </select>
                      </div>
                      <div>
                        <label class="block text-xs font-medium text-gray-700 mb-1" for="operator">
              Operator
            </label>
            <select
              id="operator"
                          [(ngModel)]="config().branchOperator"
                          class="w-full px-2 py-1.5 text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500">
                          <option value="==">Equals (==)</option>
                          <option value="!=">Not Equals (!=)</option>
                          <option value="contains">Contains</option>
                          <option value="startsWith">Starts With</option>
                          <option value="endsWith">Ends With</option>
                        </select>
                      </div>
                    </div>

                    @if (config().branchConditionType !== 'authenticated') {
                      <div class="grid grid-cols-2 gap-3">
                        @if (config().branchConditionType === 'header' || config().branchConditionType === 'claim') {
                          <div>
                            <label class="block text-xs font-medium text-gray-700 mb-1" for="key">
              Key
            </label>
            <input
              id="key"
                              type="text"
                              [(ngModel)]="config().branchKey"
                              class="w-full px-2 py-1.5 text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                              placeholder="X-API-Key">
                          </div>
                        }
                        <div [class.col-span-2]="config().branchConditionType !== 'header' && config().branchConditionType !== 'claim'">
                          <label class="block text-xs font-medium text-gray-700 mb-1" for="value">
              Value
            </label>
            <input
              id="value"
                            type="text"
                            [(ngModel)]="config().branchValue"
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
                (click)="save.emit()"
                class="flex-1 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-blue-800 hover:shadow-md transition-all font-medium">
                Save Changes
              </button>
              <button
                (click)="dismiss.emit()"
                class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-medium">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class MiddlewareEditModalComponent {
  readonly middleware = input<MiddlewareNode | null>(null);
  readonly config = model.required<EditConfig>();

  readonly save = output<void>();
  readonly dismiss = output<void>();
}
