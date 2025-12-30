import { RoutingMiddlewareHandler } from './base/category-handlers';
import type {
  MiddlewareConfig,
  SimulationContext,
  SimulationStep,
  MiddlewareSimulationResult,
} from '../models';

export class StaticFilesHandler extends RoutingMiddlewareHandler {
  readonly type = 'StaticFiles' as const;

  generateCode(config: MiddlewareConfig, indent = ''): string {
    if (config.directory) {
      return `${indent}app.UseStaticFiles(new StaticFileOptions\n${indent}{\n${indent}    FileProvider = new PhysicalFileProvider(Path.Combine(Directory.GetCurrentDirectory(), "${config.directory}")),\n${indent}    RequestPath = "/${config.directory}"\n${indent}});\n`;
    }
    return `${indent}app.UseStaticFiles();\n`;
  }

  simulate(
    config: MiddlewareConfig,
    context: SimulationContext,
    steps: SimulationStep[]
  ): MiddlewareSimulationResult {
    const stepBase = this.createStepBase(steps, this.type, this.type);
    const directory = config.directory || 'wwwroot';
    const isStaticFile = context.path.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$/);

    if (isStaticFile) {
      steps.push({
        ...stepBase,
        action: `Static file served: ${context.path}`,
        decision: 'terminate',
        context: { directory, file: context.path },
      });

      return this.createSuccessResult(`[Static file content from ${directory}${context.path}]`);
    }

    steps.push({
      ...stepBase,
      action: `Not a static file, continuing`,
      decision: 'continue',
      context: { directory, isStaticFile: false },
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
      directory: 'wwwroot',
      defaultFiles: ['index.html'],
    };
  }
}
