import { SecurityMiddlewareHandler } from './base/category-handlers';
import type {
  MiddlewareConfig,
  SimulationContext,
  SimulationStep,
  MiddlewareSimulationResult,
} from '../models';

export class CorsHandler extends SecurityMiddlewareHandler {
  readonly type = 'CORS' as const;

  generateCode(config: MiddlewareConfig, indent = ''): string {
    let code = `${indent}app.UseCors(policy =>\n`;
    code += `${indent}{\n`;

    if (config.allowedOrigins && config.allowedOrigins.length > 0) {
      const origins = config.allowedOrigins.map(o => `"${o}"`).join(', ');
      code += `${indent}    policy.WithOrigins(${origins})\n`;
    } else {
      code += `${indent}    policy.AllowAnyOrigin()\n`;
    }

    if (config.allowedMethods && config.allowedMethods.length > 0) {
      const methods = config.allowedMethods.map(m => `"${m}"`).join(', ');
      code += `${indent}          .WithMethods(${methods})\n`;
    } else {
      code += `${indent}          .AllowAnyMethod()\n`;
    }

    code += `${indent}          .AllowAnyHeader()`;

    if (config.allowCredentials) {
      code += `\n${indent}          .AllowCredentials()`;
    }

    code += `;\n`;
    code += `${indent}});\n`;

    return code;
  }

  override generateServiceRegistration(config: MiddlewareConfig): string {
    // No separate service registration needed when policy is inline
    return '';
  }

  simulate(
    config: MiddlewareConfig,
    context: SimulationContext,
    steps: SimulationStep[]
  ): MiddlewareSimulationResult {
    const stepBase = this.createStepBase(steps, this.type, this.type);
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

      return this.createForbiddenResult('CORS policy violation');
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

    return {
      terminated: false,
      statusCode: 200,
      statusText: 'OK',
      headers: {},
    };
  }

  getDefaultConfig(): MiddlewareConfig {
    return {
      allowedOrigins: ['*'],
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowCredentials: false,
    };
  }
}
