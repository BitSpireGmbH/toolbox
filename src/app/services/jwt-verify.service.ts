import { Injectable, inject } from '@angular/core';
import { DotnetRuntimeService, invokeWasm } from './dotnet-runtime.service';

/**
 * Mirrors the C# contracts in `dotnet/Toolbox.Wasm.Core/Crypto/JwtContracts.cs`. The
 * shapes are produced by source-generated camelCase serialization on that side, and
 * pinned there by `CryptoJsonFacadeTests`, so these interfaces describe the wire format
 * rather than re-deriving it.
 */
export type JwtSecretEncoding = 'utf8' | 'base64' | 'base64url';

export type JwtVerifyStatus =
  | 'verified'
  | 'mismatch'
  | 'unsupported-algorithm'
  | 'alg-none'
  | 'malformed';

export interface JwtVerification {
  /** Only ever true for a genuine cryptographic match. */
  verified: boolean;
  status: JwtVerifyStatus;
  /** Absent when the token is too malformed to name an algorithm. */
  algorithm?: string;
  detail: string;
}

export interface JwtVerifyRequest {
  token: string;
  secret: string;
  secretEncoding: JwtSecretEncoding;
}

/**
 * Verifies JWT signatures with the real `System.Security.Cryptography` in WebAssembly.
 *
 * Like {@link LinqVisualizerService} and unlike {@link RegexTesterService} there is
 * deliberately **no JavaScript fallback**. The Regex Tester has one because `RegExp` is a
 * defensible degraded mode; here an approximation would be worse than useless. A
 * hand-rolled HMAC that quietly got the signing input wrong would tell people their
 * tokens are forged when they are fine - or, far worse, the reverse. When the runtime is
 * unavailable the tool says so and declines to judge.
 */
@Injectable({ providedIn: 'root' })
export class JwtVerifyService {
  private readonly runtime = inject(DotnetRuntimeService);

  readonly runtimeStatus = this.runtime.status;
  readonly runtimeFailure = this.runtime.failure;

  /**
   * No error handling for bad tokens: .NET classifies those and returns them in the
   * payload's `status` field. A throw from here means the runtime itself broke.
   */
  verify(request: JwtVerifyRequest): Promise<JwtVerification> {
    return invokeWasm<JwtVerification>(this.runtime, wasm =>
      wasm.CryptoInterop.VerifyJwt(JSON.stringify(request))
    );
  }
}
