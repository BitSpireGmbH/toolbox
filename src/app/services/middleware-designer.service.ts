import { Injectable } from '@angular/core';

// ========== Domain Models ==========

export interface Pipeline {
  id: string;
  name: string;
  middlewares: MiddlewareNode[];
}

export interface MiddlewareNode {
  id: string;
  type: MiddlewareType;
  order: number;
  config: Record<string, unknown>;
  branch?: BranchConfig;
}

export type MiddlewareType =
  | 'Routing'
  | 'Authentication'
  | 'Authorization'
  | 'CORS'
  | 'StaticFiles'
  | 'ExceptionHandling'
  | 'Compression'
  | 'RateLimiting'
  | 'Custom'
  | 'MinimalAPIEndpoint'
  | 'HTTPS';

export interface BranchConfig {
  condition: BranchCondition;
  onTrue?: MiddlewareNode[];
  onFalse?: MiddlewareNode[];
}

export interface BranchCondition {
  type: 'header' | 'method' | 'path' | 'claim' | 'authenticated';
  operator: '==' | '!=' | 'contains' | 'startsWith' | 'endsWith';
  key?: string;
  value?: string;
}

export interface MiddlewareConfig {
  // Routing
  routes?: string[];

  // Authentication
  authScheme?: 'JwtBearer' | 'OpenIdConnect' | 'Cookie';
  // JWT Bearer settings (for API authentication)
  jwtAuthority?: string;
  jwtAudience?: string;
  jwtValidateIssuer?: boolean;
  jwtValidateAudience?: boolean;
  jwtValidateLifetime?: boolean;
  jwtRequireHttpsMetadata?: boolean;
  // OpenID Connect settings (for web application authentication with user interaction)
  oidcAuthority?: string;
  oidcClientId?: string;
  oidcClientSecret?: string;
  oidcResponseType?: string;
  oidcScopes?: string[];
  oidcSaveTokens?: boolean;
  oidcGetClaimsFromUserInfoEndpoint?: boolean;
  // Cookie settings
  cookieName?: string;
  cookieLoginPath?: string;
  cookieLogoutPath?: string;
  cookieAccessDeniedPath?: string;
  cookieExpireMinutes?: number;
  cookieSlidingExpiration?: boolean;

  // Authorization
  policies?: string[];

  // CORS
  allowedOrigins?: string[];
  allowedMethods?: string[];
  allowCredentials?: boolean;

  // Static Files
  directory?: string;
  defaultFiles?: string[];

  // Exception Handling
  errorHandlerRoute?: string;
  useIExceptionHandler?: boolean;
  exceptionHandlerClass?: string;
  returnHandled?: boolean; // true = handled (stops), false = continue to next handler

  // Compression
  algorithms?: ('gzip' | 'brotli' | 'deflate')[];

  // Rate Limiting
  policyName?: string;
  limiterType?: 'FixedWindow' | 'SlidingWindow' | 'TokenBucket' | 'Concurrency';
  permitLimit?: number;
  window?: number; // seconds
  queueLimit?: number;
  tokensPerPeriod?: number;
  replenishmentPeriod?: number; // seconds

  // Custom
  className?: string;
  customCode?: string;

  // Minimal API Endpoint
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path?: string;
  handlerCode?: string;

  // Response Compression
  enableForHttps?: boolean; // Warning: Enabling compression for HTTPS has security risks (CRIME and BREACH attacks)

  // Index signature for compatibility
  [key: string]: unknown;
}

export interface SimulationRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body?: string;
  isAuthenticated: boolean;
  claims: Record<string, string>;
  cookies: Record<string, string>;
}

export interface SimulationResult {
  success: boolean;
  steps: SimulationStep[];
  response: SimulationResponse;
  duration: number;
}

export interface SimulationStep {
  order: number;
  middlewareName: string;
  middlewareType: MiddlewareType;
  action: string;
  decision?: string;
  context: Record<string, unknown>;
  timestamp: number;
}

export interface SimulationResponse {
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body?: string;
  terminated: boolean;
  terminatedBy?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  middlewareId: string;
  message: string;
}

export interface ValidationWarning {
  middlewareId: string;
  message: string;
}

export interface MinimalAPIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  handlerCode: string;
  middlewareId: string;
}

// ========== Service ==========

@Injectable({
  providedIn: 'root',
})
export class MiddlewareDesignerService {
  // ========== Validation ==========

  validatePipeline(pipeline: Pipeline): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Empty pipeline check
    if (pipeline.middlewares.length === 0) {
      // Empty pipeline is acceptable at startup — show no validation messages
      return { valid: true, errors, warnings };
    }

    // Check for circular branches
    const detectCycle = (node: MiddlewareNode, recursionStack: Set<string>): boolean => {
      if (recursionStack.has(node.id)) {
        if (!errors.some(e => e.middlewareId === node.id && e.message === 'Circular branch detected')) {
          errors.push({
            middlewareId: node.id,
            message: 'Circular branch detected',
          });
        }
        return true;
      }

      recursionStack.add(node.id);

      if (node.branch) {
        const trueBranch = node.branch.onTrue || [];
        const falseBranch = node.branch.onFalse || [];

        for (const child of [...trueBranch, ...falseBranch]) {
          if (detectCycle(child, new Set(recursionStack))) {
            return true;
          }
        }
      }

      return false;
    };

    for (const middleware of pipeline.middlewares) {
      detectCycle(middleware, new Set());
    }

    // Middleware order warnings
    const hasAuth = pipeline.middlewares.some((m) => m.type === 'Authentication');
    const hasAuthz = pipeline.middlewares.some((m) => m.type === 'Authorization');

    if (hasAuthz && hasAuth) {
      const authIndex = pipeline.middlewares.findIndex((m) => m.type === 'Authentication');
      const authzIndex = pipeline.middlewares.findIndex((m) => m.type === 'Authorization');

      if (authzIndex < authIndex) {
        warnings.push({
          middlewareId: pipeline.middlewares[authzIndex].id,
          message: 'Authorization should typically come after Authentication',
        });
      }
    }

    // Exception handling should be early
    const exceptionIndex = pipeline.middlewares.findIndex(
      (m) => m.type === 'ExceptionHandling'
    );
    if (exceptionIndex > 2 && exceptionIndex !== -1) {
      warnings.push({
        middlewareId: pipeline.middlewares[exceptionIndex].id,
        message: 'Exception handling is typically placed early in the pipeline',
      });
    }

    // Check for middleware after MinimalAPIEndpoint
    // In ASP.NET Core minimal APIs, app.MapGet() etc. just REGISTER endpoints.
    // The actual endpoint execution happens via implicit endpoint middleware at the END.
    // So middleware placed AFTER MapGet in code actually runs BEFORE the endpoint handler!
    const sortedMiddlewares = [...pipeline.middlewares].sort((a, b) => a.order - b.order);
    for (let i = 0; i < sortedMiddlewares.length; i++) {
      const middleware = sortedMiddlewares[i];
      if (middleware.type === 'MinimalAPIEndpoint') {
        // Check if there are any middlewares after this one
        const middlewaresAfter = sortedMiddlewares.slice(i + 1);
        for (const afterMiddleware of middlewaresAfter) {
          warnings.push({
            middlewareId: afterMiddleware.id,
            message: `⚠️ Code order ≠ Execution order: This middleware appears after the endpoint (${(middleware.config as MiddlewareConfig).httpMethod} ${(middleware.config as MiddlewareConfig).path}) in code, but will actually execute BEFORE the endpoint handler runs. In ASP.NET Core, app.MapXxx() only registers endpoints - all app.Use() middleware runs before endpoint execution regardless of code position.`,
          });
        }
        break; // Only warn once for the first MinimalAPIEndpoint
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ========== Code Generation ==========

  generateCSharpCode(pipeline: Pipeline): string {
    let code = `// Generated Middleware Pipeline: ${pipeline.name}\n`;
    code += `// Generated on: ${new Date().toISOString()}\n\n`;
    code += `var builder = WebApplication.CreateBuilder(args);\n\n`;

    // Add services if needed
    const needsAuth = pipeline.middlewares.some((m) => m.type === 'Authentication');
    const needsAuthz = pipeline.middlewares.some((m) => m.type === 'Authorization');
    const needsCors = pipeline.middlewares.some((m) => m.type === 'CORS');
    const needsRateLimit = pipeline.middlewares.some((m) => m.type === 'RateLimiting');
    const needsExceptionHandler = pipeline.middlewares.some((m) =>
      m.type === 'ExceptionHandling' && (m.config as MiddlewareConfig).useIExceptionHandler
    );

    if (needsAuth || needsAuthz) {
      code += `// Add authentication and authorization services\n`;
      if (needsAuth) {
        // Generate authentication based on scheme
        const authMiddlewares = pipeline.middlewares.filter((m) => m.type === 'Authentication');
        for (const authMiddleware of authMiddlewares) {
          const config = authMiddleware.config as MiddlewareConfig;
          code += this.generateAuthenticationServiceCode(config);
        }
      }
      if (needsAuthz) {
        code += `builder.Services.AddAuthorization();\n`;
      }
      code += `\n`;
    }

    if (needsCors) {
      code += `// Add CORS services\n`;
      code += `builder.Services.AddCors();\n\n`;
    }

    if (needsRateLimit) {
      code += `// Add rate limiting services\n`;
      code += `builder.Services.AddRateLimiter(options =>\n`;
      code += `{\n`;

      // Add rate limiting policies
      const rateLimitMiddlewares = pipeline.middlewares.filter((m) => m.type === 'RateLimiting');
      for (const rlm of rateLimitMiddlewares) {
        const config = rlm.config as MiddlewareConfig;
        if (config.policyName && config.limiterType) {
          code += `    options.AddPolicy("${config.policyName}", context =>\n`;
          code += `        RateLimitPartition.Get${config.limiterType}(\n`;
          code += `            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",\n`;

          switch (config.limiterType) {
            case 'FixedWindow':
              code += `            factory: _ => new FixedWindowRateLimiterOptions\n`;
              code += `            {\n`;
              code += `                PermitLimit = ${config.permitLimit || 10},\n`;
              code += `                Window = TimeSpan.FromSeconds(${config.window || 60}),\n`;
              code += `                QueueLimit = ${config.queueLimit || 0}\n`;
              code += `            }));\n`;
              break;
            case 'SlidingWindow':
              code += `            factory: _ => new SlidingWindowRateLimiterOptions\n`;
              code += `            {\n`;
              code += `                PermitLimit = ${config.permitLimit || 10},\n`;
              code += `                Window = TimeSpan.FromSeconds(${config.window || 60}),\n`;
              code += `                SegmentsPerWindow = 5,\n`;
              code += `                QueueLimit = ${config.queueLimit || 0}\n`;
              code += `            }));\n`;
              break;
            case 'TokenBucket':
              code += `            factory: _ => new TokenBucketRateLimiterOptions\n`;
              code += `            {\n`;
              code += `                TokenLimit = ${config.permitLimit || 10},\n`;
              code += `                TokensPerPeriod = ${config.tokensPerPeriod || 5},\n`;
              code += `                ReplenishmentPeriod = TimeSpan.FromSeconds(${config.replenishmentPeriod || 60}),\n`;
              code += `                QueueLimit = ${config.queueLimit || 0}\n`;
              code += `            }));\n`;
              break;
            case 'Concurrency':
              code += `            factory: _ => new ConcurrencyLimiterOptions\n`;
              code += `            {\n`;
              code += `                PermitLimit = ${config.permitLimit || 10},\n`;
              code += `                QueueLimit = ${config.queueLimit || 0}\n`;
              code += `            }));\n`;
              break;
          }
        }
      }

      code += `});\n\n`;
    }

    // Response Compression services (for Compression middleware)
    const needsCompression = pipeline.middlewares.some((m) => m.type === 'Compression');
    if (needsCompression) {
      code += `// Add response compression services\n`;
      const compressionMiddlewares = pipeline.middlewares.filter((m) => m.type === 'Compression');
      const hasEnableForHttps = compressionMiddlewares.some((m) => (m.config as MiddlewareConfig).enableForHttps);

      if (hasEnableForHttps) {
        code += `// WARNING: Enabling compression for HTTPS has security implications (CRIME and BREACH attacks)\n`;
        code += `// Only enable this if you understand the risks and have mitigations in place\n`;
        code += `builder.Services.AddResponseCompression(options =>\n`;
        code += `{\n`;
        code += `    options.EnableForHttps = true;\n`;
        code += `});\n\n`;
      } else {
        code += `builder.Services.AddResponseCompression();\n\n`;
      }
    }

    if (needsExceptionHandler) {
      code += `// Add exception handler services\n`;
      const exHandlers = pipeline.middlewares.filter((m) =>
        m.type === 'ExceptionHandling' && (m.config as MiddlewareConfig).useIExceptionHandler
      );
      for (const handler of exHandlers) {
        const config = handler.config as MiddlewareConfig;
        if (config.exceptionHandlerClass) {
          code += `builder.Services.AddExceptionHandler<${config.exceptionHandlerClass}>();\n`;
        }
      }
      code += `builder.Services.AddProblemDetails();\n`;
      code += `\n`;

      // Generate the IExceptionHandler class implementations
      for (const handler of exHandlers) {
        const config = handler.config as MiddlewareConfig;
        if (config.exceptionHandlerClass) {
          code += this.generateIExceptionHandlerClass(config.exceptionHandlerClass, config.returnHandled ?? true);
        }
      }
    }

    code += `var app = builder.Build();\n\n`;

    // Generate middleware calls
    const sortedMiddlewares = [...pipeline.middlewares].sort((a, b) => a.order - b.order);

    for (const middleware of sortedMiddlewares) {
      code += this.generateMiddlewareCode(middleware);
    }

    code += `\napp.Run();\n`;

    return code;
  }

  private generateMiddlewareCode(middleware: MiddlewareNode, indent = ''): string {
    let code = '';
    const config = middleware.config as MiddlewareConfig;

    switch (middleware.type) {
      case 'Authentication':
        code += `${indent}app.UseAuthentication();\n`;
        break;

      case 'Authorization':
        code += `${indent}app.UseAuthorization();\n`;
        break;

      case 'CORS':
        if (config.allowedOrigins && config.allowedOrigins.length > 0) {
          code += `${indent}app.UseCors(policy => policy\n`;
          code += `${indent}    .WithOrigins(${config.allowedOrigins.map((o) => `"${o}"`).join(', ')})\n`;
          if (config.allowedMethods && config.allowedMethods.length > 0) {
            code += `${indent}    .WithMethods(${config.allowedMethods.map((m) => `"${m}"`).join(', ')})\n`;
          }
          if (config.allowCredentials) {
            code += `${indent}    .AllowCredentials()\n`;
          }
          code += `${indent});\n`;
        } else {
          code += `${indent}app.UseCors();\n`;
        }
        break;

      case 'StaticFiles':
        if (config.directory) {
          code += `${indent}app.UseStaticFiles(new StaticFileOptions\n`;
          code += `${indent}{\n`;
          code += `${indent}    FileProvider = new PhysicalFileProvider(\n`;
          code += `${indent}        Path.Combine(builder.Environment.ContentRootPath, "${config.directory}")),\n`;
          code += `${indent}    RequestPath = "/${config.directory}"\n`;
          code += `${indent}});\n`;
        } else {
          code += `${indent}app.UseStaticFiles();\n`;
        }
        break;

      case 'ExceptionHandling':
        if (config.useIExceptionHandler && config.exceptionHandlerClass) {
          code += `${indent}app.UseExceptionHandler(options => { });\n`;
          code += `${indent}// IExceptionHandler: ${config.exceptionHandlerClass}\n`;
          code += `${indent}// Returns: ${config.returnHandled ? 'true (handled)' : 'false (continue to next)'}\n`;
        } else if (config.errorHandlerRoute) {
          code += `${indent}app.UseExceptionHandler("${config.errorHandlerRoute}");\n`;
        } else {
          code += `${indent}app.UseExceptionHandler("/error");\n`;
        }
        break;

      case 'Compression':
        code += `${indent}app.UseResponseCompression();\n`;
        break;

      case 'RateLimiting':
        code += `${indent}app.UseRateLimiter();\n`;
        if (config.policyName) {
          code += `${indent}// Rate Limiting Policy: ${config.policyName}\n`;
          code += `${indent}// Limiter Type: ${config.limiterType || 'FixedWindow'}\n`;
        }
        break;

      case 'Custom':
        if (config.customCode) {
          code += `${indent}// Custom middleware: ${config.className || 'Anonymous'}\n`;
          code += `${indent}app.Use(async (context, next) =>\n`;
          code += `${indent}{\n`;
          const customLines = config.customCode.split('\n');
          for (const line of customLines) {
            code += `${indent}    ${line}\n`;
          }
          code += `${indent}    await next();\n`;
          code += `${indent}});\n`;
        } else if (config.className) {
          code += `${indent}app.UseMiddleware<${config.className}>();\n`;
        }
        break;

      case 'MinimalAPIEndpoint':
        if (config.httpMethod && config.path && config.handlerCode) {
          // ASP.NET Core uses PascalCase for method names: MapGet, MapPost, MapPut, MapDelete, MapPatch
          const methodName = config.httpMethod.charAt(0).toUpperCase() + config.httpMethod.slice(1).toLowerCase();
          if (config.policyName) {
            code += `${indent}app.Map${methodName}("${config.path}", ${config.handlerCode})\n`;
            code += `${indent}    .RequireRateLimiting("${config.policyName}");\n`;
          } else {
            code += `${indent}app.Map${methodName}("${config.path}", ${config.handlerCode});\n`;
          }
        }
        break;

      case 'HTTPS':
        code += `${indent}app.UseHttpsRedirection();\n`;
        break;
    }

    // Handle branches
    if (middleware.branch) {
      code += `${indent}app.UseWhen(\n`;
      code += `${indent}    ctx => ${this.generateBranchCondition(middleware.branch.condition)},\n`;
      code += `${indent}    branch =>\n`;
      code += `${indent}    {\n`;

      if (middleware.branch.onTrue) {
        for (const node of middleware.branch.onTrue) {
          code += this.generateMiddlewareCode(node, indent + '        ');
        }
      }

      code += `${indent}    });\n`;

      if (middleware.branch.onFalse && middleware.branch.onFalse.length > 0) {
        code += `${indent}app.UseWhen(\n`;
        code += `${indent}    ctx => !(${this.generateBranchCondition(middleware.branch.condition)}),\n`;
        code += `${indent}    branch =>\n`;
        code += `${indent}    {\n`;

        for (const node of middleware.branch.onFalse) {
          code += this.generateMiddlewareCode(node, indent + '        ');
        }

        code += `${indent}    });\n`;
      }
    }

    return code;
  }

  private generateBranchCondition(condition: BranchCondition): string {
    switch (condition.type) {
      case 'header':
        if (condition.operator === '==') {
          return `ctx.Request.Headers["${condition.key}"] == "${condition.value}"`;
        } else if (condition.operator === '!=') {
          return `ctx.Request.Headers["${condition.key}"] != "${condition.value}"`;
        } else if (condition.operator === 'contains') {
          return `ctx.Request.Headers["${condition.key}"].ToString().Contains("${condition.value}")`;
        }
        break;

      case 'method':
        if (condition.operator === '==') {
          return `ctx.Request.Method == "${condition.value}"`;
        } else if (condition.operator === '!=') {
          return `ctx.Request.Method != "${condition.value}"`;
        }
        break;

      case 'path':
        if (condition.operator === '==') {
          return `ctx.Request.Path == "${condition.value}"`;
        } else if (condition.operator === 'startsWith') {
          return `ctx.Request.Path.StartsWithSegments("${condition.value}")`;
        } else if (condition.operator === 'contains') {
          return `ctx.Request.Path.Value?.Contains("${condition.value}") ?? false`;
        }
        break;

      case 'claim':
        if (condition.operator === '==') {
          return `ctx.User.HasClaim("${condition.key}", "${condition.value}")`;
        } else if (condition.operator === '!=') {
          return `!ctx.User.HasClaim("${condition.key}", "${condition.value}")`;
        }
        break;

      case 'authenticated':
        return `ctx.User.Identity?.IsAuthenticated ?? false`;
    }

    return 'true';
  }

  private generateIExceptionHandlerClass(className: string, returnHandled: boolean): string {
    return `
// ========== IExceptionHandler Implementation ==========
// See: https://learn.microsoft.com/en-us/aspnet/core/fundamentals/error-handling

public class ${className} : IExceptionHandler
{
    private readonly ILogger<${className}> _logger;

    public ${className}(ILogger<${className}> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Attempts to handle the specified exception.
    /// </summary>
    /// <param name="httpContext">The HTTP context.</param>
    /// <param name="exception">The exception to handle.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>
    /// <c>true</c> if the exception was handled (ASP.NET Core stops calling other handlers);
    /// <c>false</c> if not handled (next registered IExceptionHandler is called).
    /// </returns>
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        _logger.LogError(exception, "An unhandled exception occurred: {Message}", exception.Message);

        // Example: Handle specific exception types
        if (exception is ArgumentException argEx)
        {
            httpContext.Response.StatusCode = StatusCodes.Status400BadRequest;
            await httpContext.Response.WriteAsJsonAsync(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Bad Request",
                Detail = argEx.Message
            }, cancellationToken);

            return true; // Exception handled, stop calling other handlers
        }

        // Handle all other exceptions
        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await httpContext.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = StatusCodes.Status500InternalServerError,
            Title = "An error occurred",
            Detail = "An unexpected error occurred. Please try again later."
        }, cancellationToken);

        // Return ${returnHandled}:
        // - true = Exception is handled. No other IExceptionHandler will be called.
        // - false = Exception is NOT handled. The next registered handler is called.
        return ${returnHandled};
    }
}

`;
  }

  private generateAuthenticationServiceCode(config: MiddlewareConfig): string {
    let code = '';
    const scheme = config.authScheme || 'JwtBearer';

    switch (scheme) {
      case 'JwtBearer':
        code += `// JWT Bearer Authentication - for API authentication\n`;
        code += `// Client sends JWT tokens in Authorization header, no user interaction\n`;
        code += `builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)\n`;
        code += `    .AddJwtBearer(options =>\n`;
        code += `    {\n`;
        if (config.jwtAuthority) {
          code += `        options.Authority = "${config.jwtAuthority}";\n`;
        }
        if (config.jwtAudience) {
          code += `        options.Audience = "${config.jwtAudience}";\n`;
        }
        code += `        options.RequireHttpsMetadata = ${config.jwtRequireHttpsMetadata ?? true};\n`;
        code += `        options.TokenValidationParameters = new TokenValidationParameters\n`;
        code += `        {\n`;
        code += `            ValidateIssuer = ${config.jwtValidateIssuer ?? true},\n`;
        code += `            ValidateAudience = ${config.jwtValidateAudience ?? true},\n`;
        code += `            ValidateLifetime = ${config.jwtValidateLifetime ?? true},\n`;
        code += `            ValidateIssuerSigningKey = true\n`;
        code += `        };\n`;
        code += `    });\n`;
        break;

      case 'OpenIdConnect':
        code += `// OpenID Connect Authentication - for web applications with user interaction\n`;
        code += `// Users are redirected to the identity provider for login/logout\n`;
        code += `builder.Services.AddAuthentication(options =>\n`;
        code += `{\n`;
        code += `    options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;\n`;
        code += `    options.DefaultChallengeScheme = OpenIdConnectDefaults.AuthenticationScheme;\n`;
        code += `})\n`;
        code += `.AddCookie()\n`;
        code += `.AddOpenIdConnect(options =>\n`;
        code += `{\n`;
        if (config.oidcAuthority) {
          code += `    options.Authority = "${config.oidcAuthority}";\n`;
        }
        if (config.oidcClientId) {
          code += `    options.ClientId = "${config.oidcClientId}";\n`;
        }
        if (config.oidcClientSecret) {
          code += `    options.ClientSecret = "${config.oidcClientSecret}";\n`;
        }
        code += `    options.ResponseType = "${config.oidcResponseType || 'code'}";\n`;
        code += `    options.SaveTokens = ${config.oidcSaveTokens ?? true};\n`;
        code += `    options.GetClaimsFromUserInfoEndpoint = ${config.oidcGetClaimsFromUserInfoEndpoint ?? true};\n`;
        if (config.oidcScopes && config.oidcScopes.length > 0) {
          code += `    \n    // Add scopes\n`;
          code += `    options.Scope.Clear();\n`;
          for (const scope of config.oidcScopes) {
            code += `    options.Scope.Add("${scope}");\n`;
          }
        }
        code += `});\n`;
        break;

      case 'Cookie':
        code += `// Cookie Authentication - for traditional web applications\n`;
        code += `// Authentication state stored in browser cookie, typically with custom login page\n`;
        code += `builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)\n`;
        code += `    .AddCookie(options =>\n`;
        code += `    {\n`;
        if (config.cookieName) {
          code += `        options.Cookie.Name = "${config.cookieName}";\n`;
        }
        if (config.cookieLoginPath) {
          code += `        options.LoginPath = "${config.cookieLoginPath}";\n`;
        }
        if (config.cookieLogoutPath) {
          code += `        options.LogoutPath = "${config.cookieLogoutPath}";\n`;
        }
        if (config.cookieAccessDeniedPath) {
          code += `        options.AccessDeniedPath = "${config.cookieAccessDeniedPath}";\n`;
        }
        if (config.cookieExpireMinutes) {
          code += `        options.ExpireTimeSpan = TimeSpan.FromMinutes(${config.cookieExpireMinutes});\n`;
        }
        code += `        options.SlidingExpiration = ${config.cookieSlidingExpiration ?? true};\n`;
        code += `    });\n`;
        break;
    }

    return code;
  }

  // ========== Simulation Engine ==========

  simulatePipeline(pipeline: Pipeline, request: SimulationRequest, requestCount = 1): SimulationResult {
    const startTime = Date.now();
    const steps: SimulationStep[] = [];
    let terminated = false;
    let terminatedBy: string | undefined;
    let statusCode = 200;
    let statusText = 'OK';
    const responseHeaders: Record<string, string> = {};
    let responseBody: string | undefined;

    // Track rate limiting state across requests
    const rateLimitState: Record<string, { count: number; limit: number }> = {};

    const context = {
      method: request.method,
      path: request.path,
      headers: { ...request.headers },
      query: { ...request.query },
      body: request.body,
      isAuthenticated: request.isAuthenticated,
      claims: { ...request.claims },
      cookies: { ...request.cookies },
      response: {
        statusCode: 200,
        headers: {} as Record<string, string>,
        body: undefined as string | undefined,
      },
      requestNumber: 1,
      totalRequests: requestCount,
      rateLimitState,
    };

    const sortedMiddlewares = [...pipeline.middlewares].sort((a, b) => a.order - b.order);

    // ASP.NET Core execution order: All app.Use() middleware runs BEFORE endpoint handlers (MapGet, etc.)
    // This is because app.MapXxx() only REGISTERS endpoints - the actual endpoint middleware runs at the end
    // So we need to reorder: run all non-endpoint middleware first, then endpoints
    const regularMiddlewares = sortedMiddlewares.filter(m => m.type !== 'MinimalAPIEndpoint');
    const endpointMiddlewares = sortedMiddlewares.filter(m => m.type === 'MinimalAPIEndpoint');
    const executionOrderMiddlewares = [...regularMiddlewares, ...endpointMiddlewares];

    // If there are middlewares placed after endpoints in code order, add an info step
    const hasMiddlewareAfterEndpoint = sortedMiddlewares.some((m, i) => {
      if (m.type === 'MinimalAPIEndpoint') {
        return sortedMiddlewares.slice(i + 1).some(after => after.type !== 'MinimalAPIEndpoint');
      }
      return false;
    });

    // Simulate multiple requests if requestCount > 1
    for (let reqNum = 1; reqNum <= requestCount && !terminated; reqNum++) {
      context.requestNumber = reqNum;

      if (requestCount > 1) {
        steps.push({
          order: steps.length + 1,
          middlewareName: 'Request',
          middlewareType: 'Custom',
          action: `📨 Processing request ${reqNum} of ${requestCount}`,
          decision: 'continue',
          context: { requestNumber: reqNum },
          timestamp: Date.now(),
        });
      }

      if (hasMiddlewareAfterEndpoint && reqNum === 1) {
        steps.push({
          order: steps.length + 1,
          middlewareName: 'Pipeline Info',
          middlewareType: 'Custom',
          action: `⚠️ Note: Code order ≠ Execution order! Some middleware appears after MapXxx() in code but runs BEFORE the endpoint. Simulation shows actual execution order.`,
          decision: 'info',
          context: { warning: 'execution-order-differs-from-code-order' },
          timestamp: Date.now(),
        });
      }

      for (let i = 0; i < executionOrderMiddlewares.length && !terminated; i++) {
        const middleware = executionOrderMiddlewares[i];
        const result = this.simulateMiddleware(middleware, context, steps);

        if (result.terminated) {
          terminated = true;
          terminatedBy = middleware.type;
          statusCode = result.statusCode;
          statusText = result.statusText;
          context.response.statusCode = statusCode;
          Object.assign(responseHeaders, result.headers);
          responseBody = result.body;
        }
      }
    }

    const duration = Date.now() - startTime;

    return {
      success: !terminated || statusCode < 400,
      steps,
      response: {
        statusCode: context.response.statusCode || statusCode,
        statusText,
        headers: { ...context.response.headers, ...responseHeaders },
        body: context.response.body || responseBody,
        terminated,
        terminatedBy,
      },
      duration,
    };
  }

  private simulateMiddleware(
    middleware: MiddlewareNode,
    context: {
      method: string;
      path: string;
      headers: Record<string, string>;
      query: Record<string, string>;
      body?: string;
      isAuthenticated: boolean;
      claims: Record<string, string>;
      cookies: Record<string, string>;
      response: {
        statusCode: number;
        headers: Record<string, string>;
        body?: string;
      };
      requestNumber: number;
      totalRequests: number;
      rateLimitState: Record<string, { count: number; limit: number }>;
    },
    steps: SimulationStep[]
  ): {
    terminated: boolean;
    statusCode: number;
    statusText: string;
    headers: Record<string, string>;
    body?: string;
  } {
    const config = middleware.config as MiddlewareConfig;
    const stepBase = {
      order: steps.length + 1,
      middlewareName: middleware.type,
      middlewareType: middleware.type,
      timestamp: Date.now(),
      context: {},
    };

    switch (middleware.type) {
      case 'Routing': {
        const routes = config.routes || [];
        const matched = routes.some(
          (route) =>
            route === '*' ||
            context.path === route ||
            context.path.startsWith(route.replace('*', ''))
        );

        steps.push({
          ...stepBase,
          action: matched ? `Matched route: ${context.path}` : 'No route matched',
          decision: matched ? 'continue' : 'terminate',
          context: { matched, path: context.path },
        });

        if (!matched && routes.length > 0) {
          return {
            terminated: true,
            statusCode: 404,
            statusText: 'Not Found',
            headers: {},
            body: 'Route not found',
          };
        }
        break;
      }

      case 'Authentication': {
        const scheme = config.authScheme || 'JwtBearer';
        const authHeader = context.headers['Authorization'] || context.headers['authorization'];
        const hasCookie = Object.keys(context.cookies).length > 0 || context.headers['Cookie'] || context.headers['cookie'];

        let authSuccess = false;
        let authMethod = '';
        let failureReason = '';
        let wwwAuthenticateValue = 'Bearer';

        switch (scheme) {
          case 'JwtBearer': {
            authMethod = 'JWT Bearer';
            wwwAuthenticateValue = 'Bearer';
            // Check for Bearer token in Authorization header
            if (context.isAuthenticated) {
              authSuccess = true;
            } else if (authHeader) {
              const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
              if (bearerMatch) {
                const token = bearerMatch[1];
                // Basic JWT format validation (header.payload.signature)
                const jwtParts = token.split('.');
                if (jwtParts.length === 3) {
                  authSuccess = true;
                } else {
                  failureReason = 'Invalid JWT format (expected header.payload.signature)';
                }
              } else {
                failureReason = 'Authorization header must use Bearer scheme';
              }
            } else {
              failureReason = 'No Bearer token provided in Authorization header';
            }
            break;
          }

          case 'OpenIdConnect': {
            authMethod = 'OpenID Connect';
            wwwAuthenticateValue = 'Bearer';
            // OIDC typically results in a cookie after redirect flow
            if (context.isAuthenticated) {
              authSuccess = true;
            } else if (hasCookie) {
              // Simulate having a valid session cookie from OIDC flow
              authSuccess = true;
            } else {
              failureReason = 'No valid session. User would be redirected to identity provider.';
            }
            break;
          }

          case 'Cookie': {
            authMethod = 'Cookie';
            wwwAuthenticateValue = 'Cookie';
            // Check for authentication cookie
            if (context.isAuthenticated) {
              authSuccess = true;
            } else if (hasCookie) {
              authSuccess = true;
            } else {
              failureReason = `No authentication cookie. User would be redirected to ${config.cookieLoginPath || '/Account/Login'}`;
            }
            break;
          }
        }

        if (!authSuccess) {
          steps.push({
            ...stepBase,
            action: `Authentication failed (${authMethod}): ${failureReason}`,
            decision: 'terminate',
            context: { scheme, authMethod, authenticated: false, reason: failureReason },
          });

          return {
            terminated: true,
            statusCode: 401,
            statusText: 'Unauthorized',
            headers: { 'WWW-Authenticate': wwwAuthenticateValue },
            body: `Authentication required: ${failureReason}`,
          };
        }

        steps.push({
          ...stepBase,
          action: `Authentication successful (${authMethod})`,
          decision: 'continue',
          context: { scheme, authMethod, authenticated: true },
        });
        break;
      }

      case 'Authorization': {
        const policies = config.policies || [];
        const hasRequiredClaims = policies.length === 0 || policies.some((policy) => context.claims[policy]);

        if (!hasRequiredClaims) {
          steps.push({
            ...stepBase,
            action: `Authorization failed: Missing required policy`,
            decision: 'terminate',
            context: { policies, claims: context.claims },
          });

          return {
            terminated: true,
            statusCode: 403,
            statusText: 'Forbidden',
            headers: {},
            body: 'Access denied',
          };
        }

        steps.push({
          ...stepBase,
          action: `Authorization successful`,
          decision: 'continue',
          context: { policies, authorized: true },
        });
        break;
      }

      case 'CORS': {
        const origin = context.headers['Origin'] || context.headers['origin'];
        const allowedOrigins = config.allowedOrigins || ['*'];

        const allowed =
          allowedOrigins.includes('*') ||
          (origin && allowedOrigins.includes(origin));

        if (!allowed && origin) {
          steps.push({
            ...stepBase,
            action: `CORS check failed: Origin "${origin}" not allowed`,
            decision: 'terminate',
            context: { origin, allowedOrigins },
          });

          return {
            terminated: true,
            statusCode: 403,
            statusText: 'Forbidden',
            headers: {},
            body: 'CORS policy violation',
          };
        }

        const corsHeaders: Record<string, string> = {};
        if (allowed && origin) {
          corsHeaders['Access-Control-Allow-Origin'] = origin;
          if (config.allowCredentials) {
            corsHeaders['Access-Control-Allow-Credentials'] = 'true';
          }
          Object.assign(context.response.headers, corsHeaders);
        }

        steps.push({
          ...stepBase,
          action: `CORS check passed`,
          decision: 'continue',
          context: { origin, allowed, corsHeaders },
        });
        break;
      }

      case 'StaticFiles': {
        const directory = config.directory || 'wwwroot';
        const isStaticFile = context.path.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$/);

        if (isStaticFile) {
          steps.push({
            ...stepBase,
            action: `Static file served: ${context.path}`,
            decision: 'terminate',
            context: { directory, file: context.path },
          });

          return {
            terminated: true,
            statusCode: 200,
            statusText: 'OK',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: `[Static file content from ${directory}${context.path}]`,
          };
        }

        steps.push({
          ...stepBase,
          action: `Not a static file, continuing`,
          decision: 'continue',
          context: { directory, isStaticFile: false },
        });
        break;
      }

      case 'ExceptionHandling': {
        if (config.useIExceptionHandler) {
          const returnHandled = config.returnHandled ?? true;
          steps.push({
            ...stepBase,
            action: `IExceptionHandler: ${config.exceptionHandlerClass || 'Handler'}.TryHandleAsync() → ${returnHandled ? 'true (handled, stops chain)' : 'false (passes to next handler)'}`,
            decision: 'continue',
            context: {
              handlerClass: config.exceptionHandlerClass,
              returnHandled,
              explanation: returnHandled
                ? 'Exception is handled by this handler. No other IExceptionHandler will be called.'
                : 'Exception is NOT handled. ASP.NET Core will call the next registered IExceptionHandler.'
            },
          });
        } else {
          steps.push({
            ...stepBase,
            action: `Exception handler registered: ${config.errorHandlerRoute || '/error'}`,
            decision: 'continue',
            context: { errorRoute: config.errorHandlerRoute || '/error' },
          });
        }
        break;
      }

      case 'Compression': {
        const algorithms = config.algorithms || ['gzip'];
        const acceptEncoding = context.headers['Accept-Encoding'] || context.headers['accept-encoding'];

        if (acceptEncoding) {
          const supported = algorithms.find((alg) => acceptEncoding.includes(alg));
          if (supported) {
            context.response.headers['Content-Encoding'] = supported;
          }
        }

        steps.push({
          ...stepBase,
          action: `Compression configured: ${algorithms.join(', ')}`,
          decision: 'continue',
          context: { algorithms, acceptEncoding },
        });
        break;
      }

      case 'RateLimiting': {
        const policyName = config.policyName || 'default';
        const limiterType = config.limiterType || 'FixedWindow';
        const permitLimit = config.permitLimit || 10;

        // Initialize rate limit state for this policy if not exists
        if (!context.rateLimitState[policyName]) {
          context.rateLimitState[policyName] = { count: 0, limit: permitLimit };
        }

        // Increment request count
        context.rateLimitState[policyName].count++;
        const currentCount = context.rateLimitState[policyName].count;
        const isRateLimited = currentCount > permitLimit;

        if (isRateLimited) {
          steps.push({
            ...stepBase,
            action: `❌ Rate limit EXCEEDED for policy "${policyName}" (${limiterType}): ${currentCount}/${permitLimit} requests`,
            decision: 'terminate',
            context: {
              policyName,
              limiterType,
              permitLimit,
              currentCount,
              exceeded: true,
              requestNumber: context.requestNumber
            },
          });

          return {
            terminated: true,
            statusCode: 429,
            statusText: 'Too Many Requests',
            headers: { 'Retry-After': String(config.window || 60) },
            body: `Rate limit exceeded. Request ${currentCount} exceeded limit of ${permitLimit}. Please try again later.`,
          };
        }

        steps.push({
          ...stepBase,
          action: `✅ Rate limit OK (${limiterType}): ${currentCount}/${permitLimit} requests (policy: ${policyName})`,
          decision: 'continue',
          context: { policyName, limiterType, permitLimit, currentCount, requestNumber: context.requestNumber },
        });
        break;
      }

      case 'Custom': {
        steps.push({
          ...stepBase,
          action: `Custom middleware executed: ${config.className || 'Anonymous'}`,
          decision: 'continue',
          context: { className: config.className },
        });
        break;
      }

      case 'MinimalAPIEndpoint': {
        if (config.httpMethod === context.method && config.path === context.path) {
          steps.push({
            ...stepBase,
            action: `✅ Minimal API endpoint matched: ${config.httpMethod} ${config.path}`,
            decision: 'terminate (endpoint handler executes, response returned)',
            context: { method: config.httpMethod, path: config.path, isTerminal: true },
          });

          // Add a note explaining the execution order
          steps.push({
            order: steps.length + 1,
            middlewareName: 'Pipeline Info',
            middlewareType: 'MinimalAPIEndpoint',
            action: `ℹ️ Note: In ASP.NET Core, app.MapXxx() only REGISTERS endpoints. Any app.Use() middleware placed after MapXxx() in code actually runs BEFORE the endpoint handler. The visual order in the designer matches code order, but actual execution order differs.`,
            decision: 'info',
            context: { reason: 'Endpoint registration vs middleware execution order' },
            timestamp: Date.now(),
          });

          context.response.statusCode = 200;
          context.response.body = `[Handler result: ${config.handlerCode}]`;

          return {
            terminated: true,
            statusCode: 200,
            statusText: 'OK',
            headers: { 'Content-Type': 'application/json' },
            body: context.response.body,
          };
        }

        steps.push({
          ...stepBase,
          action: `Minimal API endpoint not matched (expected ${config.httpMethod} ${config.path}, got ${context.method} ${context.path})`,
          decision: 'continue (path did not match, checking next middleware)',
          context: { expected: `${config.httpMethod} ${config.path}`, actual: `${context.method} ${context.path}` },
        });
        break;
      }
    }

    // Handle branches
    if (middleware.branch) {
      const conditionMet = this.evaluateBranchCondition(middleware.branch.condition, context);

      steps.push({
        ...stepBase,
        action: `Branch condition evaluated`,
        decision: conditionMet ? 'true-branch' : 'false-branch',
        context: { condition: middleware.branch.condition, result: conditionMet },
      });

      const branchNodes = conditionMet
        ? middleware.branch.onTrue || []
        : middleware.branch.onFalse || [];

      for (const node of branchNodes) {
        const result = this.simulateMiddleware(node, context, steps);
        if (result.terminated) {
          return result;
        }
      }
    }

    return {
      terminated: false,
      statusCode: 200,
      statusText: 'OK',
      headers: {},
    };
  }

  private evaluateBranchCondition(
    condition: BranchCondition,
    context: {
      method: string;
      path: string;
      headers: Record<string, string>;
      isAuthenticated: boolean;
      claims: Record<string, string>;
    }
  ): boolean {
    switch (condition.type) {
      case 'header': {
        const headerValue = context.headers[condition.key || ''] || '';
        const targetValue = condition.value || '';

        switch (condition.operator) {
          case '==':
            return headerValue === targetValue;
          case '!=':
            return headerValue !== targetValue;
          case 'contains':
            return headerValue.includes(targetValue);
          case 'startsWith':
            return headerValue.startsWith(targetValue);
          case 'endsWith':
            return headerValue.endsWith(targetValue);
        }
        break;
      }

      case 'method':
        if (condition.operator === '==') {
          return context.method === condition.value;
        } else if (condition.operator === '!=') {
          return context.method !== condition.value;
        }
        break;

      case 'path':
        switch (condition.operator) {
          case '==':
            return context.path === condition.value;
          case '!=':
            return context.path !== condition.value;
          case 'contains':
            return context.path.includes(condition.value || '');
          case 'startsWith':
            return context.path.startsWith(condition.value || '');
          case 'endsWith':
            return context.path.endsWith(condition.value || '');
        }
        break;

      case 'claim': {
        const claimValue = context.claims[condition.key || ''];
        if (condition.operator === '==') {
          return claimValue === condition.value;
        } else if (condition.operator === '!=') {
          return claimValue !== condition.value;
        }
        break;
      }

      case 'authenticated':
        return context.isAuthenticated;
    }

    return false;
  }

  // ========== Minimal API Visualization ==========

  extractMinimalAPIEndpoints(pipeline: Pipeline): MinimalAPIEndpoint[] {
    const endpoints: MinimalAPIEndpoint[] = [];

    for (const middleware of pipeline.middlewares) {
      if (middleware.type === 'MinimalAPIEndpoint') {
        const config = middleware.config as MiddlewareConfig;
        if (config.httpMethod && config.path && config.handlerCode) {
          endpoints.push({
            method: config.httpMethod,
            path: config.path,
            handlerCode: config.handlerCode,
            middlewareId: middleware.id,
          });
        }
      }
    }

    return endpoints;
  }
}
