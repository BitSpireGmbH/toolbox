import { RoutingMiddlewareHandler } from './base/category-handlers';
import type {
  MiddlewareConfig,
  Pipeline,
  SimulationContext,
  SimulationStep,
  MiddlewareSimulationResult,
  ValidationIssue,
} from '../models';

export class MinimalApiEndpointHandler extends RoutingMiddlewareHandler {
  readonly type = 'MinimalAPIEndpoint' as const;

  generateCode(config: MiddlewareConfig, indent = ''): string {
    if (config.httpMethod && config.path && config.handlerCode) {
      let code = '';
      code += `${indent}app.Map${config.httpMethod.charAt(0) + config.httpMethod.slice(1).toLowerCase()}("${config.path}", `;
      
      if (config.handlerCode.includes('=>') || config.handlerCode.includes('async')) {
        code += `${config.handlerCode})`;
      } else {
        code += `() => ${config.handlerCode})`;
      }
      
      if (config.policyName) {
        code += `\n${indent}    .RequireRateLimiting("${config.policyName}")`;
      }
      
      code += `;\n`;
      return code;
    }
    return '';
  }

  simulate(
    config: MiddlewareConfig,
    context: SimulationContext,
    steps: SimulationStep[]
  ): MiddlewareSimulationResult {
    const stepBase = this.createStepBase(steps, this.type, this.type);

    if (config.httpMethod === context.method && config.path === context.path) {
      steps.push({
        ...stepBase,
        action: `✅ Minimal API endpoint matched: ${config.httpMethod} ${config.path}`,
        decision: 'terminate (endpoint handler executes, response returned)',
        context: { method: config.httpMethod, path: config.path, isTerminal: true },
      });

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

      return this.createSuccessResult(context.response.body, 'application/json');
    }

    steps.push({
      ...stepBase,
      action: `Minimal API endpoint not matched (expected ${config.httpMethod} ${config.path}, got ${context.method} ${context.path})`,
      decision: 'continue (path did not match, checking next middleware)',
      context: { expected: `${config.httpMethod} ${config.path}`, actual: `${context.method} ${context.path}` },
    });

    return {
      terminated: false,
      statusCode: 200,
      statusText: 'OK',
      headers: {},
    };
  }

  override validate(_config: MiddlewareConfig, _pipeline: Pipeline, _middlewareId: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    return issues;
  }

  getDefaultConfig(): MiddlewareConfig {
    return {
      httpMethod: 'GET',
      path: '/api/hello',
      handlerCode: '"Hello World"',
    };
  }
}
