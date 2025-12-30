import { InfrastructureMiddlewareHandler } from './base/category-handlers';
import type {
  MiddlewareConfig,
  SimulationContext,
  SimulationStep,
  MiddlewareSimulationResult,
} from '../models';

export class HttpsHandler extends InfrastructureMiddlewareHandler {
  readonly type = 'HTTPS' as const;

  generateCode(config: MiddlewareConfig, indent = ''): string {
    return `${indent}app.UseHttpsRedirection();\n`;
  }

  simulate(
    config: MiddlewareConfig,
    context: SimulationContext,
    steps: SimulationStep[]
  ): MiddlewareSimulationResult {
    const stepBase = this.createStepBase(steps, this.type, this.type);

    steps.push({
      ...stepBase,
      action: `HTTPS redirection configured`,
      decision: 'continue',
      context: {},
    });

    return this.createContinueResult();
  }

  getDefaultConfig(): MiddlewareConfig {
    return {};
  }
}
