import { InjectionToken } from '@angular/core';
import type { CSharpVersion } from './csharp-version.model';

/**
 * Injection token for registering C# version providers.
 * This follows the Dependency Inversion Principle (DIP) -
 * high-level modules depend on abstractions, not concrete implementations.
 *
 * To add a new C# version (e.g., C# 15), simply create a new provider file
 * and register it using this token. No modification of existing code required.
 *
 * @example
 * // In your version provider file (e.g., csharp15.provider.ts):
 * export const CSHARP_15_VERSION: CSharpVersion = {
 *   version: '15',
 *   releaseYear: 2026,
 *   features: [...],
 *   color: { background: '...', border: '...', text: '...' }
 * };
 *
 * // In app.config.ts or feature module:
 * providers: [
 *   { provide: CSHARP_VERSION_TOKEN, useValue: CSHARP_15_VERSION, multi: true }
 * ]
 */
export const CSHARP_VERSION_TOKEN = new InjectionToken<CSharpVersion>(
  'CSHARP_VERSION_TOKEN'
);
