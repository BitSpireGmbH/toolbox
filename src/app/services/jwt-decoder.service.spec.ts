import { describe, it, expect, beforeEach } from 'vitest';
import { JwtDecoderService } from './jwt-decoder.service';

describe('JwtDecoderService', () => {
  let service: JwtDecoderService;

  beforeEach(() => {
    service = new JwtDecoderService();
  });

  describe('decodeToken', () => {
    it('should decode a valid JWT token', () => {
      // This is a sample JWT token (not real, for testing only)
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      
      const result = service.decodeToken(token);

      expect(result.header).toBeDefined();
      expect(result.header.alg).toBe('HS256');
      expect(result.header.typ).toBe('JWT');
      
      expect(result.payload).toBeDefined();
      expect(result.payload.sub).toBe('1234567890');
      expect(result.payload['name']).toBe('John Doe');
      expect(result.payload.iat).toBe(1516239022);
    });

    it('should handle Bearer prefix', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const tokenWithBearer = `Bearer ${token}`;
      
      const result = service.decodeToken(tokenWithBearer);

      expect(result.payload.sub).toBe('1234567890');
    });

    it('should throw error for invalid format', () => {
      expect(() => {
        service.decodeToken('invalid.token');
      }).toThrow('Invalid JWT format');
    });

    it('should throw error for malformed token', () => {
      expect(() => {
        service.decodeToken('not.a.valid.jwt.token');
      }).toThrow();
    });

    it('should detect expired tokens', () => {
      // Token with exp in the past (timestamp: 1000000000 = Sep 8, 2001)
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiZXhwIjoxMDAwMDAwMDAwfQ.5m7HS9zY1kvLe-a3xN2VQ7AXYF3XBtpqNjYBmCXgI5Y';
      
      const result = service.decodeToken(expiredToken);

      expect(result.isExpired).toBe(true);
      expect(result.expiresAt).toBeDefined();
    });

    it('should detect not-yet-valid tokens', () => {
      // Token with nbf in the future (timestamp: 9999999999 = Nov 20, 2286)
      const futureToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwibmJmIjo5OTk5OTk5OTk5fQ.0q3F4y3Y-Bq-Zv2W9qK8B4Y3L5Z7R8X1N6M3P5J4K7Y';
      
      const result = service.decodeToken(futureToken);

      expect(result.isNotYetValid).toBe(true);
      expect(result.notBefore).toBeDefined();
    });

    it('should convert timestamps to dates', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyNDAwMDB9.4Adcj0vt_FHYXqhQJqJczGkHqCeeFq3OZceLPqwLJVo';
      
      const result = service.decodeToken(token);

      expect(result.issuedAt).toBeInstanceOf(Date);
      expect(result.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('getClaimExplanations', () => {
    it('should provide explanations for standard claims', () => {
      const payload = {
        iss: 'https://example.com',
        sub: 'user123',
        aud: 'app123',
        exp: 1735504800,
        iat: 1735501200
      };

      const explanations = service.getClaimExplanations(payload);

      expect(explanations.length).toBeGreaterThan(0);
      
      const issExplanation = explanations.find(e => e.name === 'iss');
      expect(issExplanation).toBeDefined();
      expect(issExplanation?.isStandard).toBe(true);
      expect(issExplanation?.explanation).toContain('Issuer');
    });

    it('should identify custom claims', () => {
      const payload = {
        sub: 'user123',
        customClaim: 'customValue',
        anotherCustom: 42
      };

      const explanations = service.getClaimExplanations(payload);

      const customExplanation = explanations.find(e => e.name === 'customClaim');
      expect(customExplanation).toBeDefined();
      expect(customExplanation?.isStandard).toBe(false);
      expect(customExplanation?.explanation).toContain('Custom claim');
    });

    it('should format timestamp values', () => {
      const payload = {
        exp: 1735504800,
        iat: 1735501200
      };

      const explanations = service.getClaimExplanations(payload);

      const expExplanation = explanations.find(e => e.name === 'exp');
      expect(typeof expExplanation?.value).toBe('string');
      expect(expExplanation?.value).toContain('1735504800');
    });
  });

  describe('getHeaderExplanations', () => {
    it('should provide explanations for standard headers', () => {
      const header = {
        alg: 'HS256',
        typ: 'JWT',
        kid: 'key-123'
      };

      const explanations = service.getHeaderExplanations(header);

      expect(explanations.length).toBe(3);
      
      const algExplanation = explanations.find(e => e.name === 'alg');
      expect(algExplanation?.isStandard).toBe(true);
      expect(algExplanation?.explanation).toContain('Algorithm');
    });

    it('should identify custom headers', () => {
      const header = {
        alg: 'RS256',
        typ: 'JWT',
        customHeader: 'customValue'
      };

      const explanations = service.getHeaderExplanations(header);

      const customExplanation = explanations.find(e => e.name === 'customHeader');
      expect(customExplanation).toBeDefined();
      expect(customExplanation?.isStandard).toBe(false);
    });
  });

  describe('getValidityMessage', () => {
    it('should return expired status for expired tokens', () => {
      const decoded = {
        header: { alg: 'HS256', typ: 'JWT' },
        payload: { sub: 'user123', exp: 1000000000 },
        isExpired: true,
        isNotYetValid: false,
        expiresAt: new Date(1000000000 * 1000)
      };

      const result = service.getValidityMessage(decoded);

      expect(result.status).toBe('expired');
      expect(result.message).toContain('expired');
      expect(result.color).toBe('red');
    });

    it('should return not-yet-valid status', () => {
      const decoded = {
        header: { alg: 'HS256', typ: 'JWT' },
        payload: { sub: 'user123', nbf: 9999999999 },
        isExpired: false,
        isNotYetValid: true,
        notBefore: new Date(9999999999 * 1000)
      };

      const result = service.getValidityMessage(decoded);

      expect(result.status).toBe('not-yet-valid');
      expect(result.message).toContain('not yet valid');
      expect(result.color).toBe('orange');
    });

    it('should return valid status for valid tokens', () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const decoded = {
        header: { alg: 'HS256', typ: 'JWT' },
        payload: { sub: 'user123', exp: futureTime },
        isExpired: false,
        isNotYetValid: false,
        expiresAt: new Date(futureTime * 1000)
      };

      const result = service.getValidityMessage(decoded);

      expect(result.status).toBe('valid');
      expect(result.message).toContain('valid');
      expect(result.color).toBe('green');
    });

    it('should return no-expiration status when no exp claim', () => {
      const decoded = {
        header: { alg: 'HS256', typ: 'JWT' },
        payload: { sub: 'user123' },
        isExpired: false,
        isNotYetValid: false
      };

      const result = service.getValidityMessage(decoded);

      expect(result.status).toBe('no-expiration');
      expect(result.message).toContain('no expiration');
      expect(result.color).toBe('blue');
    });
  });
});
