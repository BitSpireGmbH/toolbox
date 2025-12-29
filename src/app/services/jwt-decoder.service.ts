import { Injectable } from '@angular/core';
import { jwtDecode } from 'jwt-decode';

export interface JwtHeader {
  alg?: string;
  typ?: string;
  kid?: string;
  [key: string]: unknown;
}

export interface JwtPayload {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
  [key: string]: unknown;
}

export interface DecodedJwt {
  header: JwtHeader;
  payload: JwtPayload;
  isExpired: boolean;
  isNotYetValid: boolean;
  expiresAt?: Date;
  notBefore?: Date;
  issuedAt?: Date;
}

export interface ClaimExplanation {
  name: string;
  value: unknown;
  explanation: string;
  isStandard: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class JwtDecoderService {
  /**
   * Decodes a JWT token and extracts header, payload, and validity information
   */
  decodeToken(token: string): DecodedJwt {
    // Remove Bearer prefix if present
    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
    
    // Validate JWT format (should have 3 parts separated by dots)
    const parts = cleanToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format. A JWT must have three parts separated by dots (header.payload.signature)');
    }

    try {
      // Decode header manually (jwt-decode only decodes payload by default)
      const header = JSON.parse(atob(parts[0])) as JwtHeader;
      
      // Decode payload using jwt-decode library
      const payload = jwtDecode<JwtPayload>(cleanToken);
      
      const now = Math.floor(Date.now() / 1000);
      
      // Check expiration
      const isExpired = payload.exp ? payload.exp < now : false;
      
      // Check not before
      const isNotYetValid = payload.nbf ? payload.nbf > now : false;
      
      // Convert timestamps to dates
      const expiresAt = payload.exp ? new Date(payload.exp * 1000) : undefined;
      const notBefore = payload.nbf ? new Date(payload.nbf * 1000) : undefined;
      const issuedAt = payload.iat ? new Date(payload.iat * 1000) : undefined;
      
      return {
        header,
        payload,
        isExpired,
        isNotYetValid,
        expiresAt,
        notBefore,
        issuedAt
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to decode JWT: ${error.message}`);
      }
      throw new Error('Failed to decode JWT: Unknown error');
    }
  }

  /**
   * Get explanations for standard JWT claims
   */
  getClaimExplanations(payload: JwtPayload): ClaimExplanation[] {
    const explanations: ClaimExplanation[] = [];
    
    const standardClaims: Record<string, string> = {
      iss: 'Issuer - Identifies who issued the token (e.g., authentication server)',
      sub: 'Subject - Identifies the subject of the token (typically the user ID)',
      aud: 'Audience - Identifies the recipients that the JWT is intended for',
      exp: 'Expiration Time - Time after which the token expires (Unix timestamp)',
      nbf: 'Not Before - Time before which the token must not be accepted (Unix timestamp)',
      iat: 'Issued At - Time at which the token was issued (Unix timestamp)',
      jti: 'JWT ID - Unique identifier for the token, used to prevent replay attacks'
    };

    // Add standard claims
    for (const [key, explanation] of Object.entries(standardClaims)) {
      if (key in payload) {
        let value = payload[key];
        
        // Format timestamp values
        if ((key === 'exp' || key === 'nbf' || key === 'iat') && typeof value === 'number') {
          const date = new Date(value * 1000);
          value = `${value} (${date.toLocaleString()})`;
        }
        
        explanations.push({
          name: key,
          value,
          explanation,
          isStandard: true
        });
      }
    }

    // Add custom claims
    for (const [key, value] of Object.entries(payload)) {
      if (!(key in standardClaims)) {
        explanations.push({
          name: key,
          value,
          explanation: 'Custom claim - Application-specific data stored in the token',
          isStandard: false
        });
      }
    }

    return explanations;
  }

  /**
   * Get explanation for header fields
   */
  getHeaderExplanations(header: JwtHeader): ClaimExplanation[] {
    const explanations: ClaimExplanation[] = [];
    
    const standardHeaders: Record<string, string> = {
      alg: 'Algorithm - Cryptographic algorithm used to sign the token (e.g., HS256, RS256)',
      typ: 'Type - Declares that this is a JWT token',
      kid: 'Key ID - Identifier for the key used to sign the token'
    };

    // Add standard headers
    for (const [key, explanation] of Object.entries(standardHeaders)) {
      if (key in header) {
        explanations.push({
          name: key,
          value: header[key],
          explanation,
          isStandard: true
        });
      }
    }

    // Add custom headers
    for (const [key, value] of Object.entries(header)) {
      if (!(key in standardHeaders)) {
        explanations.push({
          name: key,
          value,
          explanation: 'Custom header parameter',
          isStandard: false
        });
      }
    }

    return explanations;
  }

  /**
   * Get validity status message
   */
  getValidityMessage(decoded: DecodedJwt): { status: 'valid' | 'expired' | 'not-yet-valid' | 'no-expiration'; message: string; color: string } {
    if (decoded.isExpired) {
      const expiredAgo = decoded.expiresAt 
        ? this.formatTimeAgo(decoded.expiresAt)
        : '';
      return {
        status: 'expired',
        message: `Token expired ${expiredAgo}`,
        color: 'red'
      };
    }

    if (decoded.isNotYetValid) {
      const validIn = decoded.notBefore
        ? this.formatTimeUntil(decoded.notBefore)
        : '';
      return {
        status: 'not-yet-valid',
        message: `Token not yet valid (valid ${validIn})`,
        color: 'orange'
      };
    }

    if (decoded.expiresAt) {
      const expiresIn = this.formatTimeUntil(decoded.expiresAt);
      return {
        status: 'valid',
        message: `Token valid (expires ${expiresIn})`,
        color: 'green'
      };
    }

    return {
      status: 'no-expiration',
      message: 'Token has no expiration time',
      color: 'blue'
    };
  }

  /**
   * Format time ago
   */
  private formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  }

  /**
   * Format time until
   */
  private formatTimeUntil(date: Date): string {
    const seconds = Math.floor((date.getTime() - Date.now()) / 1000);
    
    if (seconds < 60) return `in ${seconds} second${seconds !== 1 ? 's' : ''}`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `in ${hours} hour${hours !== 1 ? 's' : ''}`;
    
    const days = Math.floor(hours / 24);
    return `in ${days} day${days !== 1 ? 's' : ''}`;
  }
}
