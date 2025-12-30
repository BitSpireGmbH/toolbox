import { BaseMiddlewareHandler } from './base-middleware.handler';
import type { MiddlewareSimulationResult } from '../../models';

export abstract class SecurityMiddlewareHandler extends BaseMiddlewareHandler {
  readonly category = 'security' as const;

  protected createUnauthorizedResult(message: string, statusCode = 401): MiddlewareSimulationResult {
    return {
      terminated: true,
      statusCode,
      statusText: statusCode === 401 ? 'Unauthorized' : 'Forbidden',
      headers: statusCode === 401 ? { 'WWW-Authenticate': 'Bearer' } : {},
      body: message,
    };
  }

  protected createForbiddenResult(message: string): MiddlewareSimulationResult {
    return this.createUnauthorizedResult(message, 403);
  }
}

export abstract class RoutingMiddlewareHandler extends BaseMiddlewareHandler {
  readonly category = 'routing' as const;

  protected createNotFoundResult(message: string): MiddlewareSimulationResult {
    return {
      terminated: true,
      statusCode: 404,
      statusText: 'Not Found',
      headers: {},
      body: message,
    };
  }

  protected createSuccessResult(body: string, contentType = 'application/octet-stream'): MiddlewareSimulationResult {
    return {
      terminated: true,
      statusCode: 200,
      statusText: 'OK',
      headers: { 'Content-Type': contentType },
      body,
    };
  }
}

export abstract class PerformanceMiddlewareHandler extends BaseMiddlewareHandler {
  readonly category = 'performance' as const;

  protected createContinueResult(): MiddlewareSimulationResult {
    return {
      terminated: false,
      statusCode: 200,
      statusText: 'OK',
      headers: {},
    };
  }

  protected createRateLimitResult(message: string, retryAfter: number): MiddlewareSimulationResult {
    return {
      terminated: true,
      statusCode: 429,
      statusText: 'Too Many Requests',
      headers: { 'Retry-After': String(retryAfter) },
      body: message,
    };
  }
}

export abstract class InfrastructureMiddlewareHandler extends BaseMiddlewareHandler {
  readonly category = 'infrastructure' as const;

  protected createContinueResult(): MiddlewareSimulationResult {
    return {
      terminated: false,
      statusCode: 200,
      statusText: 'OK',
      headers: {},
    };
  }
}
