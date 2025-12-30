import { Injectable } from '@angular/core';
import type { IMiddlewareHandler } from './handlers/base';
import type { MiddlewareType } from './models';
import {
  AuthenticationHandler,
  AuthorizationHandler,
  CorsHandler,
  RoutingHandler,
  StaticFilesHandler,
  MinimalApiEndpointHandler,
  CompressionHandler,
  RateLimitingHandler,
  ExceptionHandlingHandler,
  HttpsHandler,
  CustomHandler,
} from './handlers';

@Injectable({
  providedIn: 'root',
})
export class MiddlewareHandlerFactory {
  private readonly handlers = new Map<MiddlewareType, IMiddlewareHandler>();

  constructor() {
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.register(new AuthenticationHandler());
    this.register(new AuthorizationHandler());
    this.register(new CorsHandler());
    this.register(new RoutingHandler());
    this.register(new StaticFilesHandler());
    this.register(new MinimalApiEndpointHandler());
    this.register(new CompressionHandler());
    this.register(new RateLimitingHandler());
    this.register(new ExceptionHandlingHandler());
    this.register(new HttpsHandler());
    this.register(new CustomHandler());
  }

  private register(handler: IMiddlewareHandler): void {
    this.handlers.set(handler.type, handler);
  }

  getHandler(type: MiddlewareType): IMiddlewareHandler {
    const handler = this.handlers.get(type);
    if (!handler) {
      throw new Error(`No handler registered for type: ${type}`);
    }
    return handler;
  }

  getAllHandlers(): IMiddlewareHandler[] {
    return Array.from(this.handlers.values());
  }

  getHandlersByCategory(category: 'security' | 'routing' | 'performance' | 'infrastructure'): IMiddlewareHandler[] {
    return this.getAllHandlers().filter(h => h.category === category);
  }
}
