import { MiddlewareNode, MiddlewareConfig, BranchCondition } from '../services/middleware-designer.service';

export interface EditConfig {
  // Routing
  routesText?: string;
  // Auth - scheme-based config
  authScheme?: 'JwtBearer' | 'OpenIdConnect' | 'Cookie';
  // JWT Bearer settings
  jwtAuthority?: string;
  jwtAudience?: string;
  jwtValidateIssuer?: boolean;
  jwtValidateAudience?: boolean;
  jwtValidateLifetime?: boolean;
  jwtRequireHttpsMetadata?: boolean;
  // OpenID Connect settings
  oidcAuthority?: string;
  oidcClientId?: string;
  oidcClientSecret?: string;
  oidcResponseType?: string;
  oidcScopesText?: string;
  oidcSaveTokens?: boolean;
  oidcGetClaimsFromUserInfoEndpoint?: boolean;
  // Cookie settings
  cookieName?: string;
  cookieLoginPath?: string;
  cookieLogoutPath?: string;
  cookieAccessDeniedPath?: string;
  cookieExpireMinutes?: number;
  cookieSlidingExpiration?: boolean;
  // Authz
  policiesText?: string;
  // CORS
  allowedOriginsText?: string;
  allowedMethodsText?: string;
  allowCredentials?: boolean;
  // Static Files
  directory?: string;
  // Exception Handling
  errorHandlerRoute?: string;
  useIExceptionHandler?: boolean;
  exceptionHandlerClass?: string;
  returnHandled?: boolean;
  // Compression
  gzip?: boolean;
  brotli?: boolean;
  deflate?: boolean;
  // Rate Limiting
  policyName?: string;
  limiterType?: 'FixedWindow' | 'SlidingWindow' | 'TokenBucket' | 'Concurrency';
  permitLimit?: number;
  window?: number;
  queueLimit?: number;
  tokensPerPeriod?: number;
  replenishmentPeriod?: number;
  // Custom
  className?: string;
  customCode?: string;
  // Minimal API
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path?: string;
  handlerCode?: string;
  // Branch
  hasBranch?: boolean;
  branchConditionType?: 'header' | 'method' | 'path' | 'claim' | 'authenticated';
  branchOperator?: '==' | '!=' | 'contains' | 'startsWith' | 'endsWith';
  branchKey?: string;
  branchValue?: string;
}

/**
 * Initializes edit config from a middleware node
 */
export function initializeEditConfig(middleware: MiddlewareNode): EditConfig {
  const config = middleware.config as MiddlewareConfig;
  
  return {
    // Routing
    routesText: config.routes?.join('\n') || '',
    // Auth - new scheme-based config
    authScheme: config.authScheme || 'JwtBearer',
    // JWT Bearer settings
    jwtAuthority: config.jwtAuthority || '',
    jwtAudience: config.jwtAudience || '',
    jwtValidateIssuer: config.jwtValidateIssuer ?? true,
    jwtValidateAudience: config.jwtValidateAudience ?? true,
    jwtValidateLifetime: config.jwtValidateLifetime ?? true,
    jwtRequireHttpsMetadata: config.jwtRequireHttpsMetadata ?? true,
    // OpenID Connect settings
    oidcAuthority: config.oidcAuthority || '',
    oidcClientId: config.oidcClientId || '',
    oidcClientSecret: config.oidcClientSecret || '',
    oidcResponseType: config.oidcResponseType || 'code',
    oidcScopesText: config.oidcScopes?.join(', ') || 'openid, profile, email',
    oidcSaveTokens: config.oidcSaveTokens ?? true,
    oidcGetClaimsFromUserInfoEndpoint: config.oidcGetClaimsFromUserInfoEndpoint ?? true,
    // Cookie settings
    cookieName: config.cookieName || '.AspNetCore.Cookies',
    cookieLoginPath: config.cookieLoginPath || '/Account/Login',
    cookieLogoutPath: config.cookieLogoutPath || '/Account/Logout',
    cookieAccessDeniedPath: config.cookieAccessDeniedPath || '/Account/AccessDenied',
    cookieExpireMinutes: config.cookieExpireMinutes || 60,
    cookieSlidingExpiration: config.cookieSlidingExpiration ?? true,
    // Authz
    policiesText: config.policies?.join(', ') || '',
    // CORS
    allowedOriginsText: config.allowedOrigins?.join(', ') || '',
    allowedMethodsText: config.allowedMethods?.join(', ') || '',
    allowCredentials: config.allowCredentials || false,
    // Static Files
    directory: config.directory || 'wwwroot',
    // Exception Handling
    errorHandlerRoute: config.errorHandlerRoute || '/error',
    useIExceptionHandler: config.useIExceptionHandler || false,
    exceptionHandlerClass: config.exceptionHandlerClass || 'GlobalExceptionHandler',
    returnHandled: config.returnHandled ?? true,
    // Compression
    gzip: config.algorithms?.includes('gzip') || false,
    brotli: config.algorithms?.includes('brotli') || false,
    deflate: config.algorithms?.includes('deflate') || false,
    // Rate Limiting
    policyName: config.policyName || 'fixed',
    limiterType: config.limiterType || 'FixedWindow',
    permitLimit: config.permitLimit || 100,
    window: config.window || 60,
    queueLimit: config.queueLimit || 0,
    tokensPerPeriod: config.tokensPerPeriod || 10,
    replenishmentPeriod: config.replenishmentPeriod || 30,
    // Custom
    className: config.className || '',
    customCode: config.customCode || '',
    // Minimal API
    httpMethod: config.httpMethod || 'GET',
    path: config.path || '',
    handlerCode: config.handlerCode || '',
    // Branch
    hasBranch: !!middleware.branch,
    branchConditionType: middleware.branch?.condition.type || 'header',
    branchOperator: middleware.branch?.condition.operator || '==',
    branchKey: middleware.branch?.condition.key || '',
    branchValue: middleware.branch?.condition.value || '',
  };
}

/**
 * Builds middleware config from edit config based on middleware type
 */
export function buildMiddlewareConfig(type: string, editConfig: EditConfig): MiddlewareConfig {
  const newConfig: MiddlewareConfig = {};

  switch (type) {
    case 'Routing':
      newConfig.routes = editConfig.routesText
        ?.split('\n')
        .map((s: string) => s.trim())
        .filter((s: string) => s) || [];
      break;
    case 'Authentication':
      newConfig.authScheme = editConfig.authScheme;
      // JWT Bearer settings
      newConfig.jwtAuthority = editConfig.jwtAuthority;
      newConfig.jwtAudience = editConfig.jwtAudience;
      newConfig.jwtValidateIssuer = editConfig.jwtValidateIssuer;
      newConfig.jwtValidateAudience = editConfig.jwtValidateAudience;
      newConfig.jwtValidateLifetime = editConfig.jwtValidateLifetime;
      newConfig.jwtRequireHttpsMetadata = editConfig.jwtRequireHttpsMetadata;
      // OpenID Connect settings
      newConfig.oidcAuthority = editConfig.oidcAuthority;
      newConfig.oidcClientId = editConfig.oidcClientId;
      newConfig.oidcClientSecret = editConfig.oidcClientSecret;
      newConfig.oidcResponseType = editConfig.oidcResponseType;
      newConfig.oidcScopes = editConfig.oidcScopesText
        ?.split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s) || ['openid', 'profile', 'email'];
      newConfig.oidcSaveTokens = editConfig.oidcSaveTokens;
      newConfig.oidcGetClaimsFromUserInfoEndpoint = editConfig.oidcGetClaimsFromUserInfoEndpoint;
      // Cookie settings
      newConfig.cookieName = editConfig.cookieName;
      newConfig.cookieLoginPath = editConfig.cookieLoginPath;
      newConfig.cookieLogoutPath = editConfig.cookieLogoutPath;
      newConfig.cookieAccessDeniedPath = editConfig.cookieAccessDeniedPath;
      newConfig.cookieExpireMinutes = editConfig.cookieExpireMinutes;
      newConfig.cookieSlidingExpiration = editConfig.cookieSlidingExpiration;
      break;
    case 'Authorization':
      newConfig.policies = editConfig.policiesText
        ?.split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s) || [];
      break;
    case 'CORS':
      newConfig.allowedOrigins = editConfig.allowedOriginsText
        ?.split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s) || [];
      newConfig.allowedMethods = editConfig.allowedMethodsText
        ?.split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s) || [];
      newConfig.allowCredentials = editConfig.allowCredentials;
      break;
    case 'StaticFiles':
      newConfig.directory = editConfig.directory;
      break;
    case 'ExceptionHandling':
      newConfig.errorHandlerRoute = editConfig.errorHandlerRoute;
      newConfig.useIExceptionHandler = editConfig.useIExceptionHandler;
      newConfig.exceptionHandlerClass = editConfig.exceptionHandlerClass;
      newConfig.returnHandled = editConfig.returnHandled;
      break;
    case 'Compression':
      newConfig.algorithms = [];
      if (editConfig.gzip) newConfig.algorithms.push('gzip');
      if (editConfig.brotli) newConfig.algorithms.push('brotli');
      if (editConfig.deflate) newConfig.algorithms.push('deflate');
      break;
    case 'RateLimiting':
      newConfig.policyName = editConfig.policyName;
      newConfig.limiterType = editConfig.limiterType;
      newConfig.permitLimit = editConfig.permitLimit;
      newConfig.window = editConfig.window;
      newConfig.queueLimit = editConfig.queueLimit;
      newConfig.tokensPerPeriod = editConfig.tokensPerPeriod;
      newConfig.replenishmentPeriod = editConfig.replenishmentPeriod;
      break;
    case 'Custom':
      newConfig.className = editConfig.className;
      newConfig.customCode = editConfig.customCode;
      break;
    case 'MinimalAPIEndpoint':
      newConfig.httpMethod = editConfig.httpMethod;
      newConfig.path = editConfig.path;
      newConfig.handlerCode = editConfig.handlerCode;
      break;
  }

  return newConfig;
}

/**
 * Builds branch from edit config
 */
export function buildBranch(editConfig: EditConfig) {
  if (!editConfig.hasBranch) {
    return undefined;
  }

  // Validate required fields
  if (!editConfig.branchConditionType || !editConfig.branchOperator) {
    return undefined;
  }

  const condition: BranchCondition = {
    type: editConfig.branchConditionType,
    operator: editConfig.branchOperator,
    key: editConfig.branchKey,
    value: editConfig.branchValue,
  };

  return { condition, onTrue: [], onFalse: [] };
}

/**
 * Gets a human-readable summary of middleware configuration
 */
export function getMiddlewareConfigSummary(middleware: MiddlewareNode): string {
  const config = middleware.config as MiddlewareConfig;

  switch (middleware.type) {
    case 'Routing':
      return `Routes: ${config.routes?.join(', ') || 'none'}`;
    case 'Authentication':
      const scheme = config.authScheme || 'JwtBearer';
      switch (scheme) {
        case 'JwtBearer':
          return `JWT Bearer: ${config.jwtAuthority || 'Configure authority'}`;
        case 'OpenIdConnect':
          return `OIDC: ${config.oidcAuthority || 'Configure authority'}`;
        case 'Cookie':
          return `Cookie: ${config.cookieLoginPath || '/Account/Login'}`;
        default:
          return `Scheme: ${scheme}`;
      }
    case 'Authorization':
      return `Policies: ${config.policies?.join(', ') || 'none'}`;
    case 'CORS':
      return `Origins: ${config.allowedOrigins?.join(', ') || 'none'}`;
    case 'StaticFiles':
      return `Directory: ${config.directory || 'wwwroot'}`;
    case 'ExceptionHandling':
      if (config.useIExceptionHandler) {
        return `IExceptionHandler: ${config.exceptionHandlerClass || 'Handler'} (returns ${config.returnHandled ? 'true' : 'false'})`;
      }
      return `Route: ${config.errorHandlerRoute || '/error'}`;
    case 'Compression':
      return `Algorithms: ${config.algorithms?.join(', ') || 'none'}`;
    case 'RateLimiting':
      return `${config.limiterType || 'FixedWindow'}: ${config.permitLimit || 100}/${config.window || 60}s (${config.policyName || 'default'})`;
    case 'Custom':
      return `Class: ${config.className || 'Anonymous'}`;
    case 'MinimalAPIEndpoint':
      return `${config.httpMethod} ${config.path}`;
    default:
      return '';
  }
}

/**
 * Gets human-readable text for branch condition
 */
export function getBranchConditionText(condition: BranchCondition): string {
  const parts: string[] = [condition.type, condition.operator];
  if (condition.key) parts.push(`[${condition.key}]`);
  if (condition.value) parts.push(`"${condition.value}"`);
  return parts.join(' ');
}
