import { PerformanceMiddlewareHandler } from './base/category-handlers';
import type {
  MiddlewareConfig,
  SimulationContext,
  SimulationStep,
  MiddlewareSimulationResult,
} from '../models';

export class RateLimitingHandler extends PerformanceMiddlewareHandler {
  readonly type = 'RateLimiting' as const;

  generateCode(config: MiddlewareConfig, indent = ''): string {
    let code = `${indent}app.UseRateLimiter();\n`;
    
    if (config.policyName) {
      code += `${indent}// Rate limiting policy "${config.policyName}" configured in services\n`;
    }
    
    return code;
  }

  override generateServiceRegistration(config: MiddlewareConfig): string {
    const policyName = config.policyName || 'default';
    const limiterType = config.limiterType || 'FixedWindow';
    const permitLimit = config.permitLimit || 10;
    const window = config.window || 60;

    let code = `builder.Services.AddRateLimiter(options =>\n`;
    code += `{\n`;
    code += `    options.AddPolicy("${policyName}", context =>\n`;
    code += `        RateLimitPartition.Get${limiterType}(context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ =>\n`;

    switch (limiterType) {
      case 'FixedWindow':
        code += `            new FixedWindowRateLimiterOptions\n`;
        code += `            {\n`;
        code += `                PermitLimit = ${permitLimit},\n`;
        code += `                Window = TimeSpan.FromSeconds(${window}),\n`;
        if (config.queueLimit !== undefined) {
          code += `                QueueLimit = ${config.queueLimit},\n`;
        }
        code += `            }\n`;
        break;

      case 'SlidingWindow':
        code += `            new SlidingWindowRateLimiterOptions\n`;
        code += `            {\n`;
        code += `                PermitLimit = ${permitLimit},\n`;
        code += `                Window = TimeSpan.FromSeconds(${window}),\n`;
        if (config.queueLimit !== undefined) {
          code += `                QueueLimit = ${config.queueLimit},\n`;
        }
        code += `                SegmentsPerWindow = 8,\n`;
        code += `            }\n`;
        break;

      case 'TokenBucket':
        code += `            new TokenBucketRateLimiterOptions\n`;
        code += `            {\n`;
        code += `                TokenLimit = ${permitLimit},\n`;
        code += `                TokensPerPeriod = ${config.tokensPerPeriod || 10},\n`;
        code += `                ReplenishmentPeriod = TimeSpan.FromSeconds(${config.replenishmentPeriod || 60}),\n`;
        if (config.queueLimit !== undefined) {
          code += `                QueueLimit = ${config.queueLimit},\n`;
        }
        code += `            }\n`;
        break;

      case 'Concurrency':
        code += `            new ConcurrencyLimiterOptions\n`;
        code += `            {\n`;
        code += `                PermitLimit = ${permitLimit},\n`;
        if (config.queueLimit !== undefined) {
          code += `                QueueLimit = ${config.queueLimit},\n`;
        }
        code += `            }\n`;
        break;
    }

    code += `        )\n`;
    code += `    );\n`;
    code += `});\n`;

    return code;
  }

  simulate(
    config: MiddlewareConfig,
    context: SimulationContext,
    steps: SimulationStep[]
  ): MiddlewareSimulationResult {
    const stepBase = this.createStepBase(steps, this.type, this.type);
    const policyName = config.policyName || 'default';
    const limiterType = config.limiterType || 'FixedWindow';
    const permitLimit = config.permitLimit || 10;

    // Initialize rate limit state for this policy if not exists
    if (!context.rateLimitState[policyName]) {
      context.rateLimitState[policyName] = { count: 0, limit: permitLimit };
    }

    // Increment request count
    context.rateLimitState[policyName].count++;
    const currentCount = context.rateLimitState[policyName].count;
    const isRateLimited = currentCount > permitLimit;

    if (isRateLimited) {
      steps.push({
        ...stepBase,
        action: `❌ Rate limit EXCEEDED for policy "${policyName}" (${limiterType}): ${currentCount}/${permitLimit} requests`,
        decision: 'terminate',
        context: {
          policyName,
          limiterType,
          permitLimit,
          currentCount,
          exceeded: true,
          requestNumber: context.requestNumber
        },
      });

      return this.createRateLimitResult(
        `Rate limit exceeded. Request ${currentCount} exceeded limit of ${permitLimit}. Please try again later.`,
        config.window || 60
      );
    }

    steps.push({
      ...stepBase,
      action: `✅ Rate limit OK (${limiterType}): ${currentCount}/${permitLimit} requests (policy: ${policyName})`,
      decision: 'continue',
      context: { policyName, limiterType, permitLimit, currentCount, requestNumber: context.requestNumber },
    });

    return this.createContinueResult();
  }

  getDefaultConfig(): MiddlewareConfig {
    return {
      policyName: 'default',
      limiterType: 'FixedWindow',
      permitLimit: 10,
      window: 60,
    };
  }
}
