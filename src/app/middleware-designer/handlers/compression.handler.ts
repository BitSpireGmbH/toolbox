import { PerformanceMiddlewareHandler } from './base/category-handlers';
import type {
  MiddlewareConfig,
  SimulationContext,
  SimulationStep,
  MiddlewareSimulationResult,
} from '../models';

export class CompressionHandler extends PerformanceMiddlewareHandler {
  readonly type = 'Compression' as const;

  generateCode(config: MiddlewareConfig, indent = ''): string {
    return `${indent}app.UseResponseCompression();\n`;
  }

  override generateServiceRegistration(config: MiddlewareConfig): string {
    let code = `// Add response compression services\n`;
    const hasEnableForHttps = config.enableForHttps;

    if (hasEnableForHttps) {
      code += `// ⚠️ WARNING: Enabling compression for HTTPS can expose your application to CRIME and BREACH attacks\n`;
      code += `builder.Services.AddResponseCompression(options =>\n`;
      code += `{\n`;
      code += `    options.EnableForHttps = true; // SECURITY RISK: Only enable if you understand the implications\n`;
      code += `});\n`;
    } else {
      code += `builder.Services.AddResponseCompression();\n`;
    }

    return code;
  }

  simulate(
    config: MiddlewareConfig,
    context: SimulationContext,
    steps: SimulationStep[]
  ): MiddlewareSimulationResult {
    const stepBase = this.createStepBase(steps, this.type, this.type);
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

    return this.createContinueResult();
  }

  getDefaultConfig(): MiddlewareConfig {
    return {
      algorithms: ['gzip', 'brotli'],
      enableForHttps: false,
    };
  }
}
