import { type MiddlewareType } from './pipeline.models';

export interface SimulationRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body?: string;
  isAuthenticated: boolean;
  claims: Record<string, string>;
  cookies: Record<string, string>;
}

export interface SimulationResult {
  success: boolean;
  steps: SimulationStep[];
  response: SimulationResponse;
  duration: number;
}

export interface SimulationStep {
  order: number;
  middlewareName: string;
  middlewareType: MiddlewareType;
  action: string;
  decision?: string;
  context: Record<string, unknown>;
  timestamp: number;
}

export interface SimulationResponse {
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body?: string;
  terminated: boolean;
  terminatedBy?: string;
}

export interface SimulationContext {
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body?: string;
  isAuthenticated: boolean;
  claims: Record<string, string>;
  cookies: Record<string, string>;
  response: {
    statusCode: number;
    headers: Record<string, string>;
    body?: string;
  };
  requestNumber: number;
  totalRequests: number;
  rateLimitState: Record<string, { count: number; limit: number }>;
}

export interface MiddlewareSimulationResult {
  terminated: boolean;
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body?: string;
}
