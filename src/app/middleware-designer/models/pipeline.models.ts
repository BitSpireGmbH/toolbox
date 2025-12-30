export interface Pipeline {
  id: string;
  name: string;
  middlewares: MiddlewareNode[];
}

export interface MiddlewareNode {
  id: string;
  type: MiddlewareType;
  order: number;
  config: Record<string, unknown>;
  branch?: BranchConfig;
}

export type MiddlewareType =
  | 'Routing'
  | 'Authentication'
  | 'Authorization'
  | 'CORS'
  | 'StaticFiles'
  | 'ExceptionHandling'
  | 'Compression'
  | 'RateLimiting'
  | 'Custom'
  | 'MinimalAPIEndpoint'
  | 'HTTPS';

export interface BranchConfig {
  condition: BranchCondition;
  onTrue?: MiddlewareNode[];
  onFalse?: MiddlewareNode[];
}

export interface BranchCondition {
  type: 'header' | 'method' | 'path' | 'claim' | 'authenticated';
  operator: '==' | '!=' | 'contains' | 'startsWith' | 'endsWith';
  key?: string;
  value?: string;
}

export interface MinimalAPIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  handlerCode: string;
  middlewareId: string;
}
