import { SecurityMiddlewareHandler } from './base/category-handlers';
import type {
  MiddlewareConfig,
  SimulationContext,
  SimulationStep,
  MiddlewareSimulationResult,
} from '../models';

export class AuthorizationHandler extends SecurityMiddlewareHandler {
  readonly type = 'Authorization' as const;

  generateCode(config: MiddlewareConfig, indent = ''): string {
    return `${indent}app.UseAuthorization();\n`;
  }

  override generateServiceRegistration(_config: MiddlewareConfig): string {
    return `builder.Services.AddAuthorization();\n`;
  }

  simulate(
    _config: MiddlewareConfig,
    context: SimulationContext,
    steps: SimulationStep[]
  ): MiddlewareSimulationResult {
    const stepBase = this.createStepBase(steps, this.type, this.type);
    const policies = config.policies || [];
    const hasRequiredClaims = policies.length === 0 || policies.some((policy) => context.claims[policy]);

    if (!hasRequiredClaims) {
      steps.push({
        ...stepBase,
        action: `Authorization failed: Missing required policy`,
        decision: 'terminate',
        context: { policies, claims: context.claims },
      });

      return this.createForbiddenResult('Access denied');
    }

    steps.push({
      ...stepBase,
      action: `Authorization successful`,
      decision: 'continue',
      context: { policies, authorized: true },
    });

    return {
      terminated: false,
      statusCode: 200,
      statusText: 'OK',
      headers: {},
    };
  }

  getDefaultConfig(): MiddlewareConfig {
    return {
      policies: [],
    };
  }
}
