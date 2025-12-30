import { InfrastructureMiddlewareHandler } from './base/category-handlers';
import type {
  MiddlewareConfig,
  SimulationContext,
  SimulationStep,
  MiddlewareSimulationResult,
} from '../models';

export class CustomHandler extends InfrastructureMiddlewareHandler {
  readonly type = 'Custom' as const;

  generateCode(config: MiddlewareConfig, indent = ''): string {
    if (config.customCode) {
      return `${indent}app.Use(async (context, next) =>\n${indent}{\n${indent}    ${config.customCode}\n${indent}    await next();\n${indent}});\n`;
    } else if (config.className) {
      return `${indent}app.UseMiddleware<${config.className}>();\n`;
    }
    return '';
  }

  simulate(
    config: MiddlewareConfig,
    context: SimulationContext,
    steps: SimulationStep[]
  ): MiddlewareSimulationResult {
    const stepBase = this.createStepBase(steps, this.type, this.type);

    steps.push({
      ...stepBase,
      action: `Custom middleware executed: ${config.className || 'Anonymous'}`,
      decision: 'continue',
      context: { className: config.className },
    });

    return this.createContinueResult();
  }

  getDefaultConfig(): MiddlewareConfig {
    return {
      customCode: '// Your custom middleware code here',
    };
  }
}
