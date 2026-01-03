import type {
  MiddlewareType,
  MiddlewareConfig,
  Pipeline,
  SimulationContext,
  SimulationStep,
  MiddlewareSimulationResult,
  ValidationIssue,
  BranchConfig,
  BranchCondition,
} from '../../models';
import { type IMiddlewareHandler } from './middleware-handler.interface';

export abstract class BaseMiddlewareHandler implements IMiddlewareHandler {
  abstract readonly type: MiddlewareType;
  abstract readonly category: 'security' | 'routing' | 'performance' | 'infrastructure';

  abstract generateCode(config: MiddlewareConfig, indent: string): string;
  abstract simulate(
    config: MiddlewareConfig,
    context: SimulationContext,
    steps: SimulationStep[]
  ): MiddlewareSimulationResult;
  abstract getDefaultConfig(): MiddlewareConfig;

  // Default implementations
  generateServiceRegistration(_config: MiddlewareConfig): string {
    return '';
  }

  validate(_config: MiddlewareConfig, _pipeline: Pipeline, _middlewareId: string): ValidationIssue[] {
    return [];
  }

  supportsBranching(): boolean {
    return true;
  }

  // Shared branching code generation
  generateBranchCode(branch: BranchConfig, indent: string): string {
    let code = '';

    code += `${indent}app.UseWhen(\n`;
    code += `${indent}    ctx => ${this.generateBranchCondition(branch.condition)},\n`;
    code += `${indent}    branch =>\n`;
    code += `${indent}    {\n`;

    if (branch.onTrue) {
      for (const node of branch.onTrue) {
        // This will be handled by the main service to avoid circular dependencies
        code += `${indent}        // Branch middleware: ${node.type}\n`;
      }
    }

    code += `${indent}    });\n`;

    if (branch.onFalse && branch.onFalse.length > 0) {
      code += `${indent}app.UseWhen(\n`;
      code += `${indent}    ctx => !(${this.generateBranchCondition(branch.condition)}),\n`;
      code += `${indent}    branch =>\n`;
      code += `${indent}    {\n`;

      for (const node of branch.onFalse) {
        code += `${indent}        // Branch middleware: ${node.type}\n`;
      }

      code += `${indent}    });\n`;
    }

    return code;
  }

  protected generateBranchCondition(condition: BranchCondition): string {
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

  protected evaluateBranchCondition(
    condition: BranchCondition,
    context: SimulationContext
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

  protected createStepBase(
    steps: SimulationStep[],
    middlewareName: string,
    middlewareType: MiddlewareType
  ) {
    return {
      order: steps.length + 1,
      middlewareName,
      middlewareType,
      timestamp: Date.now(),
      context: {},
    };
  }
}
