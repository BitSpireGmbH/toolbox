import type {
  MiddlewareType,
  MiddlewareConfig,
  Pipeline,
  SimulationContext,
  SimulationStep,
  MiddlewareSimulationResult,
  ValidationIssue,
  BranchConfig,
} from '../../models';

export interface IMiddlewareHandler {
  readonly type: MiddlewareType;
  readonly category: 'security' | 'routing' | 'performance' | 'infrastructure';

  /**
   * Generate the middleware registration code (e.g., app.UseXxx())
   */
  generateCode(config: MiddlewareConfig, indent: string): string;

  /**
   * Generate service registration code (e.g., builder.Services.AddXxx())
   * Returns empty string if no service registration is needed
   */
  generateServiceRegistration(config: MiddlewareConfig): string;

  /**
   * Simulate middleware behavior
   */
  simulate(
    config: MiddlewareConfig,
    context: SimulationContext,
    steps: SimulationStep[]
  ): MiddlewareSimulationResult;

  /**
   * Validate middleware configuration in context of the pipeline
   */
  validate(config: MiddlewareConfig, pipeline: Pipeline, middlewareId: string): ValidationIssue[];

  /**
   * Get default configuration for this middleware type
   */
  getDefaultConfig(): MiddlewareConfig;

  /**
   * Check if this middleware supports branching
   */
  supportsBranching(): boolean;

  /**
   * Generate branch code (app.UseWhen())
   * Can be overridden for custom branching behavior
   */
  generateBranchCode?(branch: BranchConfig, indent: string): string;
}
