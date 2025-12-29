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
  | 'MinimalAPIEndpoint';

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
  authProvider?: 'Bearer' | 'Cookie' | 'Basic';
  
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
      errors.push({
        middlewareId: 'pipeline',
        message: 'Pipeline cannot be empty',
      });
      return { valid: false, errors, warnings };
    }

    // Check for circular branches
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const detectCycle = (node: MiddlewareNode): boolean => {
      if (recursionStack.has(node.id)) {
        errors.push({
          middlewareId: node.id,
          message: 'Circular branch detected',
        });
        return true;
      }

      if (visited.has(node.id)) {
        return false;
      }

      visited.add(node.id);
      recursionStack.add(node.id);

      if (node.branch) {
        const trueBranch = node.branch.onTrue || [];
        const falseBranch = node.branch.onFalse || [];

        for (const child of [...trueBranch, ...falseBranch]) {
          if (detectCycle(child)) {
            return true;
          }
        }
      }

      recursionStack.delete(node.id);
      return false;
    };

    for (const middleware of pipeline.middlewares) {
      detectCycle(middleware);
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
      code += `// Add authentication services\n`;
      if (needsAuth) {
        code += `builder.Services.AddAuthentication();\n`;
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
          const method = config.httpMethod.toLowerCase();
          if (config.policyName) {
            code += `${indent}app.Map${config.httpMethod}("${config.path}", ${config.handlerCode})\n`;
            code += `${indent}    .RequireRateLimiting("${config.policyName}");\n`;
          } else {
            code += `${indent}app.Map${config.httpMethod}("${config.path}", ${config.handlerCode});\n`;
          }
        }
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

  // ========== JSON Import/Export ==========

  exportToJSON(pipeline: Pipeline): string {
    return JSON.stringify(pipeline, null, 2);
  }

  importFromJSON(json: string): Pipeline {
    try {
      const pipeline = JSON.parse(json) as Pipeline;

      // Validate structure
      if (!pipeline.id || !pipeline.name || !Array.isArray(pipeline.middlewares)) {
        throw new Error('Invalid pipeline structure');
      }

      // Validate middleware nodes
      for (const middleware of pipeline.middlewares) {
        if (!middleware.id || !middleware.type || typeof middleware.order !== 'number') {
          throw new Error(`Invalid middleware node: ${middleware.id}`);
        }
      }

      return pipeline;
    } catch (error) {
      throw new Error(`Failed to import pipeline: ${error}`);
    }
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

      for (let i = 0; i < sortedMiddlewares.length && !terminated; i++) {
        const middleware = sortedMiddlewares[i];
        const result = this.simulateMiddleware(middleware, context, steps);

        if (result.terminated) {
          terminated = true;
          terminatedBy = middleware.type;
          statusCode = result.statusCode;
          statusText = result.statusText;
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
        const provider = config.authProvider || 'Bearer';
        const authHeader = context.headers['Authorization'] || context.headers['authorization'];

        if (!context.isAuthenticated && !authHeader) {
          steps.push({
            ...stepBase,
            action: `Authentication failed: No ${provider} token provided`,
            decision: 'terminate',
            context: { provider, authenticated: false },
          });

          return {
            terminated: true,
            statusCode: 401,
            statusText: 'Unauthorized',
            headers: { 'WWW-Authenticate': provider },
            body: 'Authentication required',
          };
        }

        steps.push({
          ...stepBase,
          action: `Authentication successful: ${provider}`,
          decision: 'continue',
          context: { provider, authenticated: true },
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
            action: `Minimal API endpoint matched: ${config.httpMethod} ${config.path}`,
            decision: 'terminate',
            context: { method: config.httpMethod, path: config.path },
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
          action: `Minimal API endpoint not matched`,
          decision: 'continue',
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
