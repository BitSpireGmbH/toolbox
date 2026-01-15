import { describe, it, expect, beforeEach } from 'vitest';
import { TypedDiHelperService } from './typed-di-helper.service';

describe('TypedDiHelperService', () => {
  let service: TypedDiHelperService;

  beforeEach(() => {
    service = new TypedDiHelperService();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('generateHttpCode', () => {
    it('should generate basic http code', () => {
      const result = service.generateHttpCode({
        serviceName: 'MyService',
        interfaceName: 'IMyService',
        baseUrl: 'https://api.test.com',
        timeout: 30,
        useResilience: false
      });

      expect(result).toContain('public class MyService : IMyService');
      expect(result).toContain('client.BaseAddress = new Uri("https://api.test.com")');
      expect(result).not.toContain('AddStandardResilienceHandler');
    });

    it('should include resilience handler when enabled', () => {
      const result = service.generateHttpCode({
        serviceName: 'MyService',
        interfaceName: 'IMyService',
        baseUrl: 'https://api.test.com',
        timeout: 30,
        useResilience: true
      });

      expect(result).toContain('AddStandardResilienceHandler()');
    });
  });

  describe('generateSignalRCode', () => {
    it('should generate basic signalr code', () => {
      const result = service.generateSignalRCode({
        hubName: 'MyHub',
        interfaceName: 'IMyClient',
        route: '/myhub',
        enableDetailedErrors: false,
        useMessagePack: false
      });

      expect(result).toContain('public class MyHub : Hub<IMyClient>');
      expect(result).toContain('app.MapHub<MyHub>("/myhub")');
      expect(result).not.toContain('EnableDetailedErrors');
    });

    it('should include detailed errors and messagepack when enabled', () => {
      const result = service.generateSignalRCode({
        hubName: 'MyHub',
        interfaceName: 'IMyClient',
        route: '/myhub',
        enableDetailedErrors: true,
        useMessagePack: true
      });

      expect(result).toContain('options.EnableDetailedErrors = true');
      expect(result).toContain('.AddMessagePackProtocol()');
    });
  });
});
