import { InfrastructureMiddlewareHandler } from './base/category-handlers';
import type {
  MiddlewareConfig,
  Pipeline,
  SimulationContext,
  SimulationStep,
  MiddlewareSimulationResult,
  ValidationIssue,
} from '../models';

export class ExceptionHandlingHandler extends InfrastructureMiddlewareHandler {
  readonly type = 'ExceptionHandling' as const;

  generateCode(config: MiddlewareConfig, indent = ''): string {
    if (config.useIExceptionHandler && config.exceptionHandlerClass) {
      return `${indent}// IExceptionHandler registered in services (see ${config.exceptionHandlerClass} class below)\n`;
    } else if (config.errorHandlerRoute) {
      return `${indent}app.UseExceptionHandler("${config.errorHandlerRoute}");\n`;
    }
    return `${indent}app.UseExceptionHandler("/error");\n`;
  }

  override generateServiceRegistration(config: MiddlewareConfig): string {
    if (config.useIExceptionHandler && config.exceptionHandlerClass) {
      let code = `// Add exception handler services\n`;
      code += `builder.Services.AddExceptionHandler<${config.exceptionHandlerClass}>();\n`;
      code += `builder.Services.AddProblemDetails();\n\n`;
      
      // Generate the IExceptionHandler class implementation
      code += this.generateIExceptionHandlerClass(config.exceptionHandlerClass, config.returnHandled ?? true);
      
      return code;
    }
    return '';
  }

  private generateIExceptionHandlerClass(className: string, returnHandled: boolean): string {
    return `
// ========== IExceptionHandler Implementation ==========
// See: https://learn.microsoft.com/en-us/aspnet/core/fundamentals/error-handling

public class ${className} : IExceptionHandler
{
    private readonly ILogger<${className}> _logger;

    public ${className}(ILogger<${className}> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Attempts to handle the specified exception.
    /// </summary>
    /// <param name="httpContext">The HTTP context.</param>
    /// <param name="exception">The exception to handle.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>
    /// <c>true</c> if the exception was handled (ASP.NET Core stops calling other handlers);
    /// <c>false</c> if not handled (next registered IExceptionHandler is called).
    /// </returns>
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        _logger.LogError(exception, "An unhandled exception occurred: {Message}", exception.Message);

        // Example: Handle specific exception types
        if (exception is ArgumentException argEx)
        {
            httpContext.Response.StatusCode = StatusCodes.Status400BadRequest;
            await httpContext.Response.WriteAsJsonAsync(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Bad Request",
                Detail = argEx.Message
            }, cancellationToken);

            return true; // Exception handled, stop calling other handlers
        }

        // Handle all other exceptions
        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await httpContext.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = StatusCodes.Status500InternalServerError,
            Title = "An error occurred",
            Detail = "An unexpected error occurred. Please try again later."
        }, cancellationToken);

        // Return ${returnHandled}:
        // - true = Exception is handled. No other IExceptionHandler will be called.
        // - false = Exception is NOT handled. The next registered handler is called.
        return ${returnHandled};
    }
}

`;
  }

  simulate(
    config: MiddlewareConfig,
    context: SimulationContext,
    steps: SimulationStep[]
  ): MiddlewareSimulationResult {
    const stepBase = this.createStepBase(steps, this.type, this.type);

    if (config.useIExceptionHandler) {
      const returnHandled = config.returnHandled ?? true;
      steps.push({
        ...stepBase,
        action: `IExceptionHandler: ${config.exceptionHandlerClass || 'Handler'}.TryHandleAsync() → ${returnHandled ? 'true (handled, stops chain)' : 'false (passes to next handler)'}`,
        decision: 'continue',
        context: {
          handlerClass: config.exceptionHandlerClass,
          returnHandled,
          explanation: returnHandled
            ? 'Exception is handled by this handler. No other IExceptionHandler will be called.'
            : 'Exception is NOT handled. ASP.NET Core will call the next registered IExceptionHandler.'
        },
      });
    } else {
      steps.push({
        ...stepBase,
        action: `Exception handler registered: ${config.errorHandlerRoute || '/error'}`,
        decision: 'continue',
        context: { errorRoute: config.errorHandlerRoute || '/error' },
      });
    }

    return this.createContinueResult();
  }

  override validate(config: MiddlewareConfig, pipeline: Pipeline, middlewareId: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    // Exception handling should be early
    const sortedMiddlewares = [...pipeline.middlewares].sort((a, b) => a.order - b.order);
    const exceptionIndex = sortedMiddlewares.findIndex(m => m.id === middlewareId);
    
    if (exceptionIndex > 2 && exceptionIndex !== -1) {
      issues.push({
        type: 'warning',
        middlewareId,
        message: 'Exception handling middleware should be placed early in the pipeline to catch exceptions from other middleware.',
      });
    }

    return issues;
  }

  getDefaultConfig(): MiddlewareConfig {
    return {
      errorHandlerRoute: '/error',
      useIExceptionHandler: false,
      returnHandled: true,
    };
  }
}
