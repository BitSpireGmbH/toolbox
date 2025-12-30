import { SecurityMiddlewareHandler } from './base/category-handlers';
import type {
  MiddlewareConfig,
  Pipeline,
  SimulationContext,
  SimulationStep,
  MiddlewareSimulationResult,
  ValidationIssue,
} from '../models';

export class AuthenticationHandler extends SecurityMiddlewareHandler {
  readonly type = 'Authentication' as const;

  generateCode(config: MiddlewareConfig, indent = ''): string {
    return `${indent}app.UseAuthentication();\n`;
  }

  override generateServiceRegistration(config: MiddlewareConfig): string {
    let code = '';
    const scheme = config.authScheme || 'JwtBearer';

    switch (scheme) {
      case 'JwtBearer':
        code += `// JWT Bearer Authentication - for API authentication\n`;
        code += `// Client sends JWT tokens in Authorization header, no user interaction\n`;
        code += `builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)\n`;
        code += `    .AddJwtBearer(options =>\n`;
        code += `    {\n`;
        if (config.jwtAuthority) {
          code += `        options.Authority = "${config.jwtAuthority}";\n`;
        }
        if (config.jwtAudience) {
          code += `        options.Audience = "${config.jwtAudience}";\n`;
        }
        code += `        options.RequireHttpsMetadata = ${config.jwtRequireHttpsMetadata ?? true};\n`;
        code += `        options.TokenValidationParameters = new TokenValidationParameters\n`;
        code += `        {\n`;
        code += `            ValidateIssuer = ${config.jwtValidateIssuer ?? true},\n`;
        code += `            ValidateAudience = ${config.jwtValidateAudience ?? true},\n`;
        code += `            ValidateLifetime = ${config.jwtValidateLifetime ?? true},\n`;
        code += `            ValidateIssuerSigningKey = true\n`;
        code += `        };\n`;
        code += `    });\n`;
        break;

      case 'OpenIdConnect':
        code += `// OpenID Connect Authentication - for web applications with user interaction\n`;
        code += `// Users are redirected to the identity provider for login/logout\n`;
        code += `builder.Services.AddAuthentication(options =>\n`;
        code += `{\n`;
        code += `    options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;\n`;
        code += `    options.DefaultChallengeScheme = OpenIdConnectDefaults.AuthenticationScheme;\n`;
        code += `})\n`;
        code += `.AddCookie()\n`;
        code += `.AddOpenIdConnect(options =>\n`;
        code += `{\n`;
        if (config.oidcAuthority) {
          code += `    options.Authority = "${config.oidcAuthority}";\n`;
        }
        if (config.oidcClientId) {
          code += `    options.ClientId = "${config.oidcClientId}";\n`;
        }
        if (config.oidcClientSecret) {
          code += `    options.ClientSecret = "${config.oidcClientSecret}";\n`;
        }
        code += `    options.ResponseType = "${config.oidcResponseType || 'code'}";\n`;
        code += `    options.SaveTokens = ${config.oidcSaveTokens ?? true};\n`;
        code += `    options.GetClaimsFromUserInfoEndpoint = ${config.oidcGetClaimsFromUserInfoEndpoint ?? true};\n`;
        if (config.oidcScopes && config.oidcScopes.length > 0) {
          code += `    \n    // Add scopes\n`;
          code += `    options.Scope.Clear();\n`;
          for (const scope of config.oidcScopes) {
            code += `    options.Scope.Add("${scope}");\n`;
          }
        }
        code += `});\n`;
        break;

      case 'Cookie':
        code += `// Cookie Authentication - for traditional web applications\n`;
        code += `// Authentication state stored in browser cookie, typically with custom login page\n`;
        code += `builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)\n`;
        code += `    .AddCookie(options =>\n`;
        code += `    {\n`;
        if (config.cookieName) {
          code += `        options.Cookie.Name = "${config.cookieName}";\n`;
        }
        if (config.cookieLoginPath) {
          code += `        options.LoginPath = "${config.cookieLoginPath}";\n`;
        }
        if (config.cookieLogoutPath) {
          code += `        options.LogoutPath = "${config.cookieLogoutPath}";\n`;
        }
        if (config.cookieAccessDeniedPath) {
          code += `        options.AccessDeniedPath = "${config.cookieAccessDeniedPath}";\n`;
        }
        if (config.cookieExpireMinutes) {
          code += `        options.ExpireTimeSpan = TimeSpan.FromMinutes(${config.cookieExpireMinutes});\n`;
        }
        code += `        options.SlidingExpiration = ${config.cookieSlidingExpiration ?? true};\n`;
        code += `    });\n`;
        break;
    }

    return code;
  }

  simulate(
    config: MiddlewareConfig,
    context: SimulationContext,
    steps: SimulationStep[]
  ): MiddlewareSimulationResult {
    const stepBase = this.createStepBase(steps, this.type, this.type);
    const scheme = config.authScheme || 'JwtBearer';
    const authHeader = context.headers['Authorization'] || context.headers['authorization'];
    const hasCookie = Object.keys(context.cookies).length > 0 || context.headers['Cookie'] || context.headers['cookie'];

    let authSuccess = false;
    let authMethod = '';
    let failureReason = '';
    let wwwAuthenticateValue = 'Bearer';

    switch (scheme) {
      case 'JwtBearer': {
        authMethod = 'JWT Bearer';
        wwwAuthenticateValue = 'Bearer';
        if (context.isAuthenticated) {
          authSuccess = true;
        } else if (authHeader) {
          const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
          if (bearerMatch) {
            const token = bearerMatch[1];
            const jwtParts = token.split('.');
            if (jwtParts.length === 3) {
              authSuccess = true;
            } else {
              failureReason = 'Invalid JWT format (expected header.payload.signature)';
            }
          } else {
            failureReason = 'Authorization header must use Bearer scheme';
          }
        } else {
          failureReason = 'No Bearer token provided in Authorization header';
        }
        break;
      }

      case 'OpenIdConnect': {
        authMethod = 'OpenID Connect';
        wwwAuthenticateValue = 'Bearer';
        if (context.isAuthenticated) {
          authSuccess = true;
        } else if (hasCookie) {
          authSuccess = true;
        } else {
          failureReason = 'No valid session. User would be redirected to identity provider.';
        }
        break;
      }

      case 'Cookie': {
        authMethod = 'Cookie';
        wwwAuthenticateValue = 'Cookie';
        if (context.isAuthenticated) {
          authSuccess = true;
        } else if (hasCookie) {
          authSuccess = true;
        } else {
          failureReason = `No authentication cookie. User would be redirected to ${config.cookieLoginPath || '/Account/Login'}`;
        }
        break;
      }
    }

    if (!authSuccess) {
      steps.push({
        ...stepBase,
        action: `Authentication failed (${authMethod}): ${failureReason}`,
        decision: 'terminate',
        context: { scheme, authMethod, authenticated: false, reason: failureReason },
      });

      return {
        terminated: true,
        statusCode: 401,
        statusText: 'Unauthorized',
        headers: { 'WWW-Authenticate': wwwAuthenticateValue },
        body: `Authentication required: ${failureReason}`,
      };
    }

    steps.push({
      ...stepBase,
      action: `Authentication successful (${authMethod})`,
      decision: 'continue',
      context: { scheme, authMethod, authenticated: true },
    });

    return {
      terminated: false,
      statusCode: 200,
      statusText: 'OK',
      headers: {},
    };
  }

  override validate(config: MiddlewareConfig, pipeline: Pipeline, middlewareId: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    // Check if Authorization middleware comes before Authentication
    const sortedMiddlewares = [...pipeline.middlewares].sort((a, b) => a.order - b.order);
    const authIndex = sortedMiddlewares.findIndex(m => m.type === 'Authentication');
    const authzIndex = sortedMiddlewares.findIndex(m => m.type === 'Authorization');

    if (authzIndex !== -1 && authIndex !== -1 && authzIndex < authIndex) {
      issues.push({
        type: 'warning',
        middlewareId,
        message: 'Authorization middleware should come after Authentication middleware',
      });
    }

    return issues;
  }

  getDefaultConfig(): MiddlewareConfig {
    return {
      authScheme: 'JwtBearer',
      jwtValidateIssuer: true,
      jwtValidateAudience: true,
      jwtValidateLifetime: true,
      jwtRequireHttpsMetadata: true,
    };
  }
}
