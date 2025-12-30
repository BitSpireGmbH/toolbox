import { describe, it, expect, beforeEach } from 'vitest';
import {
  MiddlewareDesignerService,
  Pipeline,
  MiddlewareNode,
  SimulationRequest,
  BranchCondition,
} from './middleware-designer.service';

describe('MiddlewareDesignerService', () => {
  let service: MiddlewareDesignerService;

  beforeEach(() => {
    service = new MiddlewareDesignerService();
  });

  describe('Validation', () => {
    it('should accept empty pipeline at startup', () => {
      const pipeline: Pipeline = { id: '1', name: 'Test', middlewares: [] };
      const result = service.validatePipeline(pipeline);

      // Empty pipeline is acceptable at startup
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect circular branches', () => {
      const nodeA: MiddlewareNode = {
        id: 'a',
        type: 'Routing',
        order: 0,
        config: {},
      };

      const nodeB: MiddlewareNode = {
        id: 'b',
        type: 'Authentication',
        order: 1,
        config: {},
      };

      // Create circular reference
      nodeA.branch = {
        condition: { type: 'authenticated', operator: '==', value: 'true' },
        onTrue: [nodeB],
      };

      nodeB.branch = {
        condition: { type: 'authenticated', operator: '==', value: 'true' },
        onTrue: [nodeA],
      };

      const pipeline: Pipeline = { id: '1', name: 'Test', middlewares: [nodeA, nodeB] };
      const result = service.validatePipeline(pipeline);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn when authorization comes before authentication', () => {
      const pipeline: Pipeline = {
        id: '1',
        name: 'Test',
        middlewares: [
          { id: '1', type: 'Authorization', order: 0, config: {} },
          { id: '2', type: 'Authentication', order: 1, config: {} },
        ],
      };

      const result = service.validatePipeline(pipeline);

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('Authorization');
    });

    it('should warn when exception handling is not early', () => {
      const pipeline: Pipeline = {
        id: '1',
        name: 'Test',
        middlewares: [
          { id: '1', type: 'Routing', order: 0, config: {} },
          { id: '2', type: 'Authentication', order: 1, config: {} },
          { id: '3', type: 'Authorization', order: 2, config: {} },
          { id: '4', type: 'ExceptionHandling', order: 3, config: {} },
        ],
      };

      const result = service.validatePipeline(pipeline);

      expect(result.warnings.some((w) => w.message.includes('Exception'))).toBe(true);
    });

    it('should accept valid pipeline', () => {
      const pipeline: Pipeline = {
        id: '1',
        name: 'Test',
        middlewares: [
          { id: '1', type: 'Routing', order: 0, config: {} },
          { id: '2', type: 'Authentication', order: 1, config: {} },
        ],
      };

      const result = service.validatePipeline(pipeline);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Code Generation', () => {
    it('should generate basic pipeline code', () => {
      const pipeline: Pipeline = {
        id: '1',
        name: 'Test Pipeline',
        middlewares: [
          { id: '1', type: 'Routing', order: 0, config: {} },
          { id: '2', type: 'Authentication', order: 1, config: { authScheme: 'JwtBearer' } },
        ],
      };

      const code = service.generateCSharpCode(pipeline);

      expect(code).toContain('var builder = WebApplication.CreateBuilder(args);');
      expect(code).toContain('var app = builder.Build();');

      expect(code).toContain('app.UseAuthentication();');
      expect(code).toContain('app.Run();');
    });

    it('should generate CORS configuration', () => {
      const pipeline: Pipeline = {
        id: '1',
        name: 'Test',
        middlewares: [
          {
            id: '1',
            type: 'CORS',
            order: 0,
            config: {
              allowedOrigins: ['https://example.com'],
              allowedMethods: ['GET', 'POST'],
              allowCredentials: true,
            },
          },
        ],
      };

      const code = service.generateCSharpCode(pipeline);

      expect(code).toContain('app.UseCors(policy => policy');
      expect(code).toContain('WithOrigins("https://example.com")');
      expect(code).toContain('WithMethods("GET", "POST")');
      expect(code).toContain('AllowCredentials()');
    });

    it('should generate static files configuration', () => {
      const pipeline: Pipeline = {
        id: '1',
        name: 'Test',
        middlewares: [
          {
            id: '1',
            type: 'StaticFiles',
            order: 0,
            config: { directory: 'public' },
          },
        ],
      };

      const code = service.generateCSharpCode(pipeline);

      expect(code).toContain('app.UseStaticFiles(');
      expect(code).toContain('public');
    });

    it('should generate custom middleware', () => {
      const pipeline: Pipeline = {
        id: '1',
        name: 'Test',
        middlewares: [
          {
            id: '1',
            type: 'Custom',
            order: 0,
            config: {
              className: 'MyMiddleware',
            },
          },
        ],
      };

      const code = service.generateCSharpCode(pipeline);

      expect(code).toContain('app.UseMiddleware<MyMiddleware>();');
    });

    it('should generate minimal API endpoint', () => {
      const pipeline: Pipeline = {
        id: '1',
        name: 'Test',
        middlewares: [
          {
            id: '1',
            type: 'MinimalAPIEndpoint',
            order: 0,
            config: {
              httpMethod: 'GET',
              path: '/api/hello',
              handlerCode: '() => "Hello World"',
            },
          },
        ],
      };

      const code = service.generateCSharpCode(pipeline);

      // ASP.NET Core uses PascalCase: MapGet, MapPost, etc.
      expect(code).toContain('app.MapGet("/api/hello", () => "Hello World");');
    });

    it('should generate branch conditions', () => {
      const pipeline: Pipeline = {
        id: '1',
        name: 'Test',
        middlewares: [
          {
            id: '1',
            type: 'Routing',
            order: 0,
            config: {},
            branch: {
              condition: {
                type: 'authenticated',
                operator: '==',
                value: 'true',
              },
              onTrue: [
                {
                  id: '2',
                  type: 'Authorization',
                  order: 1,
                  config: {},
                },
              ],
            },
          },
        ],
      };

      const code = service.generateCSharpCode(pipeline);

      expect(code).toContain('app.UseWhen(');
      expect(code).toContain('ctx.User.Identity?.IsAuthenticated ?? false');
    });
  });

  describe('JSON Import/Export', () => {
    it('should export pipeline to JSON', () => {
      const pipeline: Pipeline = {
        id: '1',
        name: 'Test',
        middlewares: [
          { id: 'm1', type: 'Routing', order: 0, config: { routes: ['/api/*'] } },
        ],
      };

      const json = service.exportToJSON(pipeline);
      const parsed = JSON.parse(json);

      expect(parsed.id).toBe('1');
      expect(parsed.name).toBe('Test');
      expect(parsed.middlewares).toHaveLength(1);
    });

    it('should import pipeline from JSON', () => {
      const json = JSON.stringify({
        id: '1',
        name: 'Test',
        middlewares: [
          { id: 'm1', type: 'Routing', order: 0, config: { routes: ['/api/*'] } },
        ],
      });

      const pipeline = service.importFromJSON(json);

      expect(pipeline.id).toBe('1');
      expect(pipeline.name).toBe('Test');
      expect(pipeline.middlewares).toHaveLength(1);
    });

    it('should reject invalid JSON structure', () => {
      const invalidJson = JSON.stringify({ foo: 'bar' });

      expect(() => service.importFromJSON(invalidJson)).toThrow();
    });

    it('should round-trip JSON export/import', () => {
      const original: Pipeline = {
        id: '1',
        name: 'Test',
        middlewares: [
          { id: 'm1', type: 'Routing', order: 0, config: { routes: ['/api/*'] } },
          { id: 'm2', type: 'Authentication', order: 1, config: { authScheme: 'JwtBearer' } },
        ],
      };

      const json = service.exportToJSON(original);
      const imported = service.importFromJSON(json);

      expect(imported).toEqual(original);
    });
  });

  describe('Simulation Engine', () => {
    describe('Authentication', () => {
      it('should return 401 when authentication fails', () => {
        const pipeline: Pipeline = {
          id: '1',
          name: 'Test',
          middlewares: [
            { id: '1', type: 'Authentication', order: 0, config: { authScheme: 'JwtBearer' } },
          ],
        };

        const request: SimulationRequest = {
          method: 'GET',
          path: '/api/users',
          headers: {},
          query: {},
          isAuthenticated: false,
          claims: {},
          cookies: {},
        };

        const result = service.simulatePipeline(pipeline, request);

        expect(result.response.statusCode).toBe(401);
        expect(result.response.terminated).toBe(true);
        expect(result.response.terminatedBy).toBe('Authentication');
      });

      it('should continue when authentication succeeds', () => {
        const pipeline: Pipeline = {
          id: '1',
          name: 'Test',
          middlewares: [
            { id: '1', type: 'Authentication', order: 0, config: { authScheme: 'JwtBearer' } },
            { id: '2', type: 'Routing', order: 1, config: {} },
          ],
        };

        const request: SimulationRequest = {
          method: 'GET',
          path: '/api/users',
          headers: { Authorization: 'Bearer header.payload.signature' },
          query: {},
          isAuthenticated: true,
          claims: {},
          cookies: {},
        };

        const result = service.simulatePipeline(pipeline, request);

        expect(result.steps).toHaveLength(2);
        expect(result.steps[0].decision).toBe('continue');
      });
    });

    describe('Authorization', () => {
      it('should return 403 when authorization fails', () => {
        const pipeline: Pipeline = {
          id: '1',
          name: 'Test',
          middlewares: [
            {
              id: '1',
              type: 'Authorization',
              order: 0,
              config: { policies: ['admin'] },
            },
          ],
        };

        const request: SimulationRequest = {
          method: 'GET',
          path: '/api/admin',
          headers: {},
          query: {},
          isAuthenticated: true,
          claims: { role: 'user' },
          cookies: {},
        };

        const result = service.simulatePipeline(pipeline, request);

        expect(result.response.statusCode).toBe(403);
        expect(result.response.terminated).toBe(true);
      });

      it('should continue when authorization succeeds', () => {
        const pipeline: Pipeline = {
          id: '1',
          name: 'Test',
          middlewares: [
            {
              id: '1',
              type: 'Authorization',
              order: 0,
              config: { policies: ['admin'] },
            },
          ],
        };

        const request: SimulationRequest = {
          method: 'GET',
          path: '/api/admin',
          headers: {},
          query: {},
          isAuthenticated: true,
          claims: { admin: 'true' },
          cookies: {},
        };

        const result = service.simulatePipeline(pipeline, request);

        expect(result.steps[0].decision).toBe('continue');
      });
    });

    describe('Routing', () => {
      it('should return 404 when route not matched', () => {
        const pipeline: Pipeline = {
          id: '1',
          name: 'Test',
          middlewares: [
            {
              id: '1',
              type: 'Routing',
              order: 0,
              config: { routes: ['/api/users', '/api/posts'] },
            },
          ],
        };

        const request: SimulationRequest = {
          method: 'GET',
          path: '/api/invalid',
          headers: {},
          query: {},
          isAuthenticated: false,
          claims: {},
          cookies: {},
        };

        const result = service.simulatePipeline(pipeline, request);

        expect(result.response.statusCode).toBe(404);
        expect(result.response.terminated).toBe(true);
      });

      it('should continue when route matches', () => {
        const pipeline: Pipeline = {
          id: '1',
          name: 'Test',
          middlewares: [
            {
              id: '1',
              type: 'Routing',
              order: 0,
              config: { routes: ['/api/*'] },
            },
          ],
        };

        const request: SimulationRequest = {
          method: 'GET',
          path: '/api/users',
          headers: {},
          query: {},
          isAuthenticated: false,
          claims: {},
          cookies: {},
        };

        const result = service.simulatePipeline(pipeline, request);

        expect(result.steps[0].decision).toBe('continue');
      });
    });

    describe('CORS', () => {
      it('should reject when origin not allowed', () => {
        const pipeline: Pipeline = {
          id: '1',
          name: 'Test',
          middlewares: [
            {
              id: '1',
              type: 'CORS',
              order: 0,
              config: { allowedOrigins: ['https://example.com'] },
            },
          ],
        };

        const request: SimulationRequest = {
          method: 'GET',
          path: '/api/users',
          headers: { Origin: 'https://evil.com' },
          query: {},
          isAuthenticated: false,
          claims: {},
          cookies: {},
        };

        const result = service.simulatePipeline(pipeline, request);

        expect(result.response.statusCode).toBe(403);
        expect(result.response.terminated).toBe(true);
      });

      it('should allow when origin matches', () => {
        const pipeline: Pipeline = {
          id: '1',
          name: 'Test',
          middlewares: [
            {
              id: '1',
              type: 'CORS',
              order: 0,
              config: { allowedOrigins: ['https://example.com'] },
            },
          ],
        };

        const request: SimulationRequest = {
          method: 'GET',
          path: '/api/users',
          headers: { Origin: 'https://example.com' },
          query: {},
          isAuthenticated: false,
          claims: {},
          cookies: {},
        };

        const result = service.simulatePipeline(pipeline, request);

        expect(result.steps[0].decision).toBe('continue');
      });
    });

    describe('Static Files', () => {
      it('should serve static file and terminate', () => {
        const pipeline: Pipeline = {
          id: '1',
          name: 'Test',
          middlewares: [
            {
              id: '1',
              type: 'StaticFiles',
              order: 0,
              config: { directory: 'wwwroot' },
            },
          ],
        };

        const request: SimulationRequest = {
          method: 'GET',
          path: '/styles.css',
          headers: {},
          query: {},
          isAuthenticated: false,
          claims: {},
          cookies: {},
        };

        const result = service.simulatePipeline(pipeline, request);

        expect(result.response.statusCode).toBe(200);
        expect(result.response.terminated).toBe(true);
        expect(result.response.body).toContain('Static file');
      });

      it('should continue when not a static file', () => {
        const pipeline: Pipeline = {
          id: '1',
          name: 'Test',
          middlewares: [
            {
              id: '1',
              type: 'StaticFiles',
              order: 0,
              config: { directory: 'wwwroot' },
            },
          ],
        };

        const request: SimulationRequest = {
          method: 'GET',
          path: '/api/users',
          headers: {},
          query: {},
          isAuthenticated: false,
          claims: {},
          cookies: {},
        };

        const result = service.simulatePipeline(pipeline, request);

        expect(result.steps[0].decision).toBe('continue');
      });
    });

    describe('Branches', () => {
      it('should execute true branch when condition met', () => {
        const pipeline: Pipeline = {
          id: '1',
          name: 'Test',
          middlewares: [
            {
              id: '1',
              type: 'Routing',
              order: 0,
              config: {},
              branch: {
                condition: { type: 'authenticated', operator: '==', value: 'true' },
                onTrue: [
                  {
                    id: '2',
                    type: 'Authorization',
                    order: 1,
                    config: {},
                  },
                ],
              },
            },
          ],
        };

        const request: SimulationRequest = {
          method: 'GET',
          path: '/api/users',
          headers: {},
          query: {},
          isAuthenticated: true,
          claims: {},
          cookies: {},
        };

        const result = service.simulatePipeline(pipeline, request);

        expect(result.steps.some((s) => s.decision === 'true-branch')).toBe(true);
        expect(result.steps.some((s) => s.middlewareName === 'Authorization')).toBe(true);
      });

      it('should execute false branch when condition not met', () => {
        const pipeline: Pipeline = {
          id: '1',
          name: 'Test',
          middlewares: [
            {
              id: '1',
              type: 'Routing',
              order: 0,
              config: {},
              branch: {
                condition: { type: 'authenticated', operator: '==', value: 'true' },
                onTrue: [],
                onFalse: [
                  {
                    id: '2',
                    type: 'Custom',
                    order: 1,
                    config: { className: 'RedirectMiddleware' },
                  },
                ],
              },
            },
          ],
        };

        const request: SimulationRequest = {
          method: 'GET',
          path: '/api/users',
          headers: {},
          query: {},
          isAuthenticated: false,
          claims: {},
          cookies: {},
        };

        const result = service.simulatePipeline(pipeline, request);

        expect(result.steps.some((s) => s.decision === 'false-branch')).toBe(true);
        expect(result.steps.some((s) => s.middlewareName === 'Custom')).toBe(true);
      });

      it('should evaluate header condition correctly', () => {
        const pipeline: Pipeline = {
          id: '1',
          name: 'Test',
          middlewares: [
            {
              id: '1',
              type: 'Routing',
              order: 0,
              config: {},
              branch: {
                condition: {
                  type: 'header',
                  operator: '==',
                  key: 'X-API-Key',
                  value: 'secret',
                },
                onTrue: [
                  {
                    id: '2',
                    type: 'Custom',
                    order: 1,
                    config: {},
                  },
                ],
              },
            },
          ],
        };

        const request: SimulationRequest = {
          method: 'GET',
          path: '/api/users',
          headers: { 'X-API-Key': 'secret' },
          query: {},
          isAuthenticated: false,
          claims: {},
          cookies: {},
        };

        const result = service.simulatePipeline(pipeline, request);

        expect(result.steps.some((s) => s.decision === 'true-branch')).toBe(true);
      });

      it('should evaluate method condition correctly', () => {
        const pipeline: Pipeline = {
          id: '1',
          name: 'Test',
          middlewares: [
            {
              id: '1',
              type: 'Routing',
              order: 0,
              config: {},
              branch: {
                condition: {
                  type: 'method',
                  operator: '==',
                  value: 'POST',
                },
                onTrue: [
                  {
                    id: '2',
                    type: 'Custom',
                    order: 1,
                    config: {},
                  },
                ],
              },
            },
          ],
        };

        const request: SimulationRequest = {
          method: 'POST',
          path: '/api/users',
          headers: {},
          query: {},
          isAuthenticated: false,
          claims: {},
          cookies: {},
        };

        const result = service.simulatePipeline(pipeline, request);

        expect(result.steps.some((s) => s.decision === 'true-branch')).toBe(true);
      });

      it('should evaluate path condition with startsWith', () => {
        const pipeline: Pipeline = {
          id: '1',
          name: 'Test',
          middlewares: [
            {
              id: '1',
              type: 'Routing',
              order: 0,
              config: {},
              branch: {
                condition: {
                  type: 'path',
                  operator: 'startsWith',
                  value: '/admin',
                },
                onTrue: [
                  {
                    id: '2',
                    type: 'Authorization',
                    order: 1,
                    config: {},
                  },
                ],
              },
            },
          ],
        };

        const request: SimulationRequest = {
          method: 'GET',
          path: '/admin/users',
          headers: {},
          query: {},
          isAuthenticated: false,
          claims: {},
          cookies: {},
        };

        const result = service.simulatePipeline(pipeline, request);

        expect(result.steps.some((s) => s.decision === 'true-branch')).toBe(true);
      });

      it('should evaluate claim condition correctly', () => {
        const pipeline: Pipeline = {
          id: '1',
          name: 'Test',
          middlewares: [
            {
              id: '1',
              type: 'Routing',
              order: 0,
              config: {},
              branch: {
                condition: {
                  type: 'claim',
                  operator: '==',
                  key: 'role',
                  value: 'admin',
                },
                onTrue: [
                  {
                    id: '2',
                    type: 'Custom',
                    order: 1,
                    config: {},
                  },
                ],
              },
            },
          ],
        };

        const request: SimulationRequest = {
          method: 'GET',
          path: '/api/users',
          headers: {},
          query: {},
          isAuthenticated: true,
          claims: { role: 'admin' },
          cookies: {},
        };

        const result = service.simulatePipeline(pipeline, request);

        expect(result.steps.some((s) => s.decision === 'true-branch')).toBe(true);
      });
    });

    describe('Minimal API Endpoints', () => {
      it('should match and terminate at endpoint', () => {
        const pipeline: Pipeline = {
          id: '1',
          name: 'Test',
          middlewares: [
            {
              id: '1',
              type: 'MinimalAPIEndpoint',
              order: 0,
              config: {
                httpMethod: 'GET',
                path: '/api/hello',
                handlerCode: '() => "Hello World"',
              },
            },
          ],
        };

        const request: SimulationRequest = {
          method: 'GET',
          path: '/api/hello',
          headers: {},
          query: {},
          isAuthenticated: false,
          claims: {},
          cookies: {},
        };

        const result = service.simulatePipeline(pipeline, request);

        expect(result.response.statusCode).toBe(200);
        expect(result.response.terminated).toBe(true);
        expect(result.response.body).toContain('Handler result');
      });

      it('should not match different method', () => {
        const pipeline: Pipeline = {
          id: '1',
          name: 'Test',
          middlewares: [
            {
              id: '1',
              type: 'MinimalAPIEndpoint',
              order: 0,
              config: {
                httpMethod: 'POST',
                path: '/api/users',
                handlerCode: '() => "Created"',
              },
            },
          ],
        };

        const request: SimulationRequest = {
          method: 'GET',
          path: '/api/users',
          headers: {},
          query: {},
          isAuthenticated: false,
          claims: {},
          cookies: {},
        };

        const result = service.simulatePipeline(pipeline, request);

        expect(result.response.terminated).toBe(false);
      });
    });

    describe('Edge Cases', () => {
      it('should handle null claims gracefully', () => {
        const pipeline: Pipeline = {
          id: '1',
          name: 'Test',
          middlewares: [
            {
              id: '1',
              type: 'Authorization',
              order: 0,
              config: { policies: ['admin'] },
            },
          ],
        };

        const request: SimulationRequest = {
          method: 'GET',
          path: '/api/users',
          headers: {},
          query: {},
          isAuthenticated: true,
          claims: {},
          cookies: {},
        };

        const result = service.simulatePipeline(pipeline, request);

        expect(result.response.statusCode).toBe(403);
      });

      it('should handle case-insensitive headers', () => {
        const pipeline: Pipeline = {
          id: '1',
          name: 'Test',
          middlewares: [
            {
              id: '1',
              type: 'Authentication',
              order: 0,
              config: { authScheme: 'JwtBearer' },
            },
          ],
        };

        const request: SimulationRequest = {
          method: 'GET',
          path: '/api/users',
          headers: { authorization: 'Bearer header.payload.signature' },
          query: {},
          isAuthenticated: true,
          claims: {},
          cookies: {},
        };

        const result = service.simulatePipeline(pipeline, request);

        expect(result.steps[0].decision).toBe('continue');
      });

      it('should handle empty branch arrays', () => {
        const pipeline: Pipeline = {
          id: '1',
          name: 'Test',
          middlewares: [
            {
              id: '1',
              type: 'Routing',
              order: 0,
              config: {},
              branch: {
                condition: { type: 'authenticated', operator: '==', value: 'true' },
                onTrue: [],
                onFalse: [],
              },
            },
          ],
        };

        const request: SimulationRequest = {
          method: 'GET',
          path: '/api/users',
          headers: {},
          query: {},
          isAuthenticated: true,
          claims: {},
          cookies: {},
        };

        const result = service.simulatePipeline(pipeline, request);

        expect(result.steps).toHaveLength(2);
      });
    });
  });

  describe('Minimal API Visualization', () => {
    it('should extract minimal API endpoints', () => {
      const pipeline: Pipeline = {
        id: '1',
        name: 'Test',
        middlewares: [
          {
            id: '1',
            type: 'MinimalAPIEndpoint',
            order: 0,
            config: {
              httpMethod: 'GET',
              path: '/api/users',
              handlerCode: '() => users',
            },
          },
          {
            id: '2',
            type: 'MinimalAPIEndpoint',
            order: 1,
            config: {
              httpMethod: 'POST',
              path: '/api/users',
              handlerCode: '(User user) => CreateUser(user)',
            },
          },
          {
            id: '3',
            type: 'Routing',
            order: 2,
            config: {},
          },
        ],
      };

      const endpoints = service.extractMinimalAPIEndpoints(pipeline);

      expect(endpoints).toHaveLength(2);
      expect(endpoints[0].method).toBe('GET');
      expect(endpoints[0].path).toBe('/api/users');
      expect(endpoints[1].method).toBe('POST');
    });

    it('should return empty array when no endpoints', () => {
      const pipeline: Pipeline = {
        id: '1',
        name: 'Test',
        middlewares: [
          { id: '1', type: 'Routing', order: 0, config: {} },
          { id: '2', type: 'Authentication', order: 1, config: {} },
        ],
      };

      const endpoints = service.extractMinimalAPIEndpoints(pipeline);

      expect(endpoints).toHaveLength(0);
    });
  });

  describe('Middleware after MinimalAPIEndpoint warning', () => {
    it('should warn when middleware is placed after MinimalAPIEndpoint', () => {
      const pipeline: Pipeline = {
        id: '1',
        name: 'Test',
        middlewares: [
          {
            id: '1',
            type: 'MinimalAPIEndpoint',
            order: 0,
            config: { httpMethod: 'GET', path: '/api/users', handlerCode: '() => "Hello"' },
          },
          { id: '2', type: 'Custom', order: 1, config: { className: 'MyMiddleware' } },
        ],
      };

      const result = service.validatePipeline(pipeline);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.middlewareId === '2')).toBe(true);
      expect(result.warnings.some((w) => w.message.includes('Code order') && w.message.includes('Execution order'))).toBe(true);
    });

    it('should not warn when middleware is placed before MinimalAPIEndpoint', () => {
      const pipeline: Pipeline = {
        id: '1',
        name: 'Test',
        middlewares: [
          { id: '1', type: 'Authentication', order: 0, config: {} },
          { id: '2', type: 'Custom', order: 1, config: { className: 'MyMiddleware' } },
          {
            id: '3',
            type: 'MinimalAPIEndpoint',
            order: 2,
            config: { httpMethod: 'GET', path: '/api/users', handlerCode: '() => "Hello"' },
          },
        ],
      };

      const result = service.validatePipeline(pipeline);

      // Should not have warnings about execution order (may have other warnings)
      expect(result.warnings.every((w) => !w.message.includes('Code order'))).toBe(true);
    });

    it('should warn for multiple middlewares after MinimalAPIEndpoint', () => {
      const pipeline: Pipeline = {
        id: '1',
        name: 'Test',
        middlewares: [
          {
            id: '1',
            type: 'MinimalAPIEndpoint',
            order: 0,
            config: { httpMethod: 'GET', path: '/api/users', handlerCode: '() => "Hello"' },
          },
          { id: '2', type: 'Custom', order: 1, config: { className: 'Middleware1' } },
          { id: '3', type: 'Authentication', order: 2, config: {} },
        ],
      };

      const result = service.validatePipeline(pipeline);

      // Both middlewares after endpoint should have warnings
      expect(result.warnings.filter((w) => w.message.includes('Code order')).length).toBe(2);
    });
  });

  describe('Simulation execution order with MinimalAPIEndpoint', () => {
    it('should execute middleware before endpoint even if placed after in code order', () => {
      const pipeline: Pipeline = {
        id: '1',
        name: 'Test',
        middlewares: [
          {
            id: '1',
            type: 'MinimalAPIEndpoint',
            order: 0,
            config: { httpMethod: 'GET', path: '/api/users', handlerCode: '() => "Hello"' },
          },
          { id: '2', type: 'Custom', order: 1, config: { className: 'MyMiddleware' } },
        ],
      };

      const request: SimulationRequest = {
        method: 'GET',
        path: '/api/users',
        headers: {},
        query: {},
        isAuthenticated: false,
        claims: {},
        cookies: {},
      };

      const result = service.simulatePipeline(pipeline, request);

      // Find the step indices
      const customMiddlewareStepIndex = result.steps.findIndex(
        (s) => s.middlewareName === 'Custom' && s.action.includes('MyMiddleware')
      );
      const endpointStepIndex = result.steps.findIndex(
        (s) => s.middlewareType === 'MinimalAPIEndpoint' && s.action.includes('matched')
      );

      // Custom middleware should execute before the endpoint
      expect(customMiddlewareStepIndex).toBeLessThan(endpointStepIndex);
    });

    it('should show info step when code order differs from execution order', () => {
      const pipeline: Pipeline = {
        id: '1',
        name: 'Test',
        middlewares: [
          {
            id: '1',
            type: 'MinimalAPIEndpoint',
            order: 0,
            config: { httpMethod: 'GET', path: '/api/users', handlerCode: '() => "Hello"' },
          },
          { id: '2', type: 'Custom', order: 1, config: { className: 'MyMiddleware' } },
        ],
      };

      const request: SimulationRequest = {
        method: 'GET',
        path: '/api/users',
        headers: {},
        query: {},
        isAuthenticated: false,
        claims: {},
        cookies: {},
      };

      const result = service.simulatePipeline(pipeline, request);

      // Should have an info step about execution order
      expect(result.steps.some((s) => s.action.includes('Code order') && s.action.includes('Execution order'))).toBe(true);
    });

    it('should not show info step when no middleware is after endpoint', () => {
      const pipeline: Pipeline = {
        id: '1',
        name: 'Test',
        middlewares: [
          { id: '1', type: 'Authentication', order: 0, config: {} },
          {
            id: '2',
            type: 'MinimalAPIEndpoint',
            order: 1,
            config: { httpMethod: 'GET', path: '/api/users', handlerCode: '() => "Hello"' },
          },
        ],
      };

      const request: SimulationRequest = {
        method: 'GET',
        path: '/api/users',
        headers: {},
        query: {},
        isAuthenticated: true,
        claims: {},
        cookies: {},
      };

      const result = service.simulatePipeline(pipeline, request);

      // Should not have the execution order warning info step
      expect(result.steps.every((s) => !s.action.includes('Code order ≠ Execution order'))).toBe(true);
    });
  });
});
