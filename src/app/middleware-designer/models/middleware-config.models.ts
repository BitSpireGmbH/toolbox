export interface MiddlewareConfig {
  // Routing
  routes?: string[];

  // Authentication
  authScheme?: 'JwtBearer' | 'OpenIdConnect' | 'Cookie';
  // JWT Bearer settings (for API authentication)
  jwtAuthority?: string;
  jwtAudience?: string;
  jwtValidateIssuer?: boolean;
  jwtValidateAudience?: boolean;
  jwtValidateLifetime?: boolean;
  jwtRequireHttpsMetadata?: boolean;
  // OpenID Connect settings (for web application authentication with user interaction)
  oidcAuthority?: string;
  oidcClientId?: string;
  oidcClientSecret?: string;
  oidcResponseType?: string;
  oidcScopes?: string[];
  oidcSaveTokens?: boolean;
  oidcGetClaimsFromUserInfoEndpoint?: boolean;
  // Cookie settings
  cookieName?: string;
  cookieLoginPath?: string;
  cookieLogoutPath?: string;
  cookieAccessDeniedPath?: string;
  cookieExpireMinutes?: number;
  cookieSlidingExpiration?: boolean;

  // Authorization
  policies?: string[];

  // CORS
  allowedOrigins?: string[];
  allowedMethods?: string[];
  allowCredentials?: boolean;

  // Static Files
  directory?: string;
  defaultFiles?: string[];

  // Exception Handling
  errorHandlerRoute?: string;
  useIExceptionHandler?: boolean;
  exceptionHandlerClass?: string;
  returnHandled?: boolean; // true = handled (stops), false = continue to next handler

  // Compression
  algorithms?: ('gzip' | 'brotli' | 'deflate')[];

  // Rate Limiting
  policyName?: string;
  limiterType?: 'FixedWindow' | 'SlidingWindow' | 'TokenBucket' | 'Concurrency';
  permitLimit?: number;
  window?: number; // seconds
  queueLimit?: number;
  tokensPerPeriod?: number;
  replenishmentPeriod?: number; // seconds

  // Custom
  className?: string;
  customCode?: string;

  // Minimal API Endpoint
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path?: string;
  handlerCode?: string;

  // Response Compression
  enableForHttps?: boolean; // Warning: Enabling compression for HTTPS has security risks (CRIME and BREACH attacks)

  // Index signature for compatibility
  [key: string]: unknown;
}
