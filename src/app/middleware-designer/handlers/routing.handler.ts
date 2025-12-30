import { RoutingMiddlewareHandler } from './base/category-handlers';
import type {
  MiddlewareConfig,
  SimulationContext,
  SimulationStep,
  MiddlewareSimulationResult,
} from '../models';

export class RoutingHandler extends RoutingMiddlewareHandler {
  readonly type = 'Routing' as const;

  generateCode(config: MiddlewareConfig, indent = ''): string {
    return `${indent}app.UseRouting();\n`;
  }

  simulate(
    config: MiddlewareConfig,
    context: SimulationContext,
    steps: SimulationStep[]
  ): MiddlewareSimulationResult {
    const stepBase = this.createStepBase(steps, this.type, this.type);
    const routes = config.routes || [];
    const matched = routes.some(
      (route) =>
        route === '*' ||
        context.path === route ||
        context.path.startsWith(route.replace('*', ''))
    );

    if (!matched && routes.length > 0) {
      steps.push({
        ...stepBase,
        action: 'No route matched',
        decision: 'terminate',
        context: { matched, path: context.path },
      });

      return this.createNotFoundResult('Route not found');
    }

    steps.push({
      ...stepBase,
      action: matched ? `Matched route: ${context.path}` : 'No route matched',
      decision: matched ? 'continue' : 'terminate',
      context: { matched, path: context.path },
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
      routes: ['*'],
    };
  }
}
