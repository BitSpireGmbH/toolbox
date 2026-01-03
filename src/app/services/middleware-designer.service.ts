import { Injectable, inject } from '@angular/core';
import { MiddlewareHandlerFactory } from '../middleware-designer/middleware-handler.factory';
import type {
  Pipeline,
  MiddlewareNode,
  MiddlewareConfig,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  SimulationRequest,
  SimulationResult,
  SimulationStep,
  SimulationContext,
  MinimalAPIEndpoint,
  BranchCondition,
  MiddlewareSimulationResult,
} from '../middleware-designer/models';

// Re-export types for backward compatibility
export type {
  Pipeline,
  MiddlewareNode,
  MiddlewareConfig,
  BranchConfig,
  BranchCondition,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  SimulationRequest,
  SimulationResult,
  SimulationStep,
  SimulationResponse,
  MinimalAPIEndpoint,
} from '../middleware-designer/models';

// ========== Service ==========


@Injectable({
  providedIn: 'root',
})
export class MiddlewareDesignerService {
  private readonly factory = inject(MiddlewareHandlerFactory);

  // ========== Validation ==========

  validatePipeline(pipeline: Pipeline): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Empty pipeline check
    if (pipeline.middlewares.length === 0) {
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

    // Collect validation issues from handlers
    for (const middleware of pipeline.middlewares) {
      const handler = this.factory.getHandler(middleware.type);
      const issues = handler.validate(middleware.config as MiddlewareConfig, pipeline, middleware.id);
      
      for (const issue of issues) {
        if (issue.type === 'error') {
          errors.push({ middlewareId: issue.middlewareId, message: issue.message });
        } else {
          warnings.push({ middlewareId: issue.middlewareId, message: issue.message });
        }
      }
    }

    // Check for middleware after a MinimalAPIEndpoint
    const sortedMiddlewares = [...pipeline.middlewares].sort((a, b) => a.order - b.order);
    const endpointIndex = sortedMiddlewares.findIndex(m => m.type === 'MinimalAPIEndpoint');

    if (endpointIndex > -1) {
      for (let i = endpointIndex + 1; i < sortedMiddlewares.length; i++) {
        const middleware = sortedMiddlewares[i];
        if (middleware.type !== 'MinimalAPIEndpoint') {
          warnings.push({
            middlewareId: middleware.id,
            message:
              'Code order vs. execution order: Middleware placed after an endpoint in code will still run before the endpoint handler.',
          });
        }
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

    // Collect service registrations from handlers
    const serviceRegistrations = new Set<string>();
    for (const middleware of pipeline.middlewares) {
      const handler = this.factory.getHandler(middleware.type);
      const registration = handler.generateServiceRegistration(middleware.config as MiddlewareConfig);
      if (registration) {
        serviceRegistrations.add(registration);
      }
    }

    // Add all unique service registrations
    if (serviceRegistrations.size > 0) {
      code += [...serviceRegistrations].join('\n') + '\n\n';
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
    const handler = this.factory.getHandler(middleware.type);
    let code = handler.generateCode(middleware.config as MiddlewareConfig, indent);

    // Handle branches
    if (middleware.branch) {
      if (handler.generateBranchCode) {
        handler.generateBranchCode(middleware.branch, indent);
        // Replace placeholder comments with actual middleware code
        const onTrueNodes = middleware.branch.onTrue || [];
        const onFalseNodes = middleware.branch.onFalse || [];
        
        // For now, add a simplified version
        // A more sophisticated implementation would properly nest the middleware
        code += `${indent}app.UseWhen(\n`;
        code += `${indent}    ctx => ${this.generateBranchCondition(middleware.branch.condition)},\n`;
        code += `${indent}    branch =>\n`;
        code += `${indent}    {\n`;
        
        for (const node of onTrueNodes) {
          code += this.generateMiddlewareCode(node, indent + '        ');
        }
        
        code += `${indent}    });\n`;
        
        if (onFalseNodes.length > 0) {
          code += `${indent}app.UseWhen(\n`;
          code += `${indent}    ctx => !(${this.generateBranchCondition(middleware.branch.condition)}),\n`;
          code += `${indent}    branch =>\n`;
          code += `${indent}    {\n`;
          
          for (const node of onFalseNodes) {
            code += this.generateMiddlewareCode(node, indent + '        ');
          }
          
          code += `${indent}    });\n`;
        }
      }
    }

    return code;
  }

  private generateBranchCondition(condition: BranchCondition): string {
    // Delegate to base handler for condition generation
    // This is a simplified version for now
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

    const context: SimulationContext = {
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

    // ASP.NET Core execution order: All app.Use() middleware runs BEFORE endpoint handlers
    const regularMiddlewares = sortedMiddlewares.filter(m => m.type !== 'MinimalAPIEndpoint');
    const endpointMiddlewares = sortedMiddlewares.filter(m => m.type === 'MinimalAPIEndpoint');
    const executionOrderMiddlewares = [...regularMiddlewares, ...endpointMiddlewares];

    // Check if middleware is placed after endpoints in code order
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
    context: SimulationContext,
    steps: SimulationStep[]
  ): MiddlewareSimulationResult {
    const handler = this.factory.getHandler(middleware.type);
    const result = handler.simulate(middleware.config as MiddlewareConfig, context, steps);

    // Handle branches
    if (middleware.branch && !result.terminated) {
      const conditionMet = this.evaluateBranchCondition(middleware.branch.condition, context);

      steps.push({
        order: steps.length + 1,
        middlewareName: middleware.type,
        middlewareType: middleware.type,
        action: `Branch condition evaluated`,
        decision: conditionMet ? 'true-branch' : 'false-branch',
        context: { condition: middleware.branch.condition, result: conditionMet },
        timestamp: Date.now(),
      });

      const branchNodes = conditionMet
        ? middleware.branch.onTrue || []
        : middleware.branch.onFalse || [];

      for (const node of branchNodes) {
        const branchResult = this.simulateMiddleware(node, context, steps);
        if (branchResult.terminated) {
          return branchResult;
        }
      }
    }

    return result;
  }

  private evaluateBranchCondition(condition: BranchCondition, context: SimulationContext): boolean {
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
          case 'startsWith':
            return context.path.startsWith(condition.value || '');
          case 'contains':
            return context.path.includes(condition.value || '');
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
