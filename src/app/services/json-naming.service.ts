import { Injectable, inject } from '@angular/core';
import { DotnetRuntimeService, invokeWasm } from './dotnet-runtime.service';

/**
 * Mirrors the C# contracts in
 * `dotnet/Toolbox.Wasm.Core/Serialization/SerializationContracts.cs`. The shapes are
 * produced by source-generated camelCase serialization on that side, and pinned there by
 * `SerializationJsonFacadeTests`, so these interfaces describe the wire format rather
 * than re-deriving it.
 */
export type JsonNamingPolicyId =
  | 'None'
  | 'CamelCase'
  | 'SnakeCaseLower'
  | 'SnakeCaseUpper'
  | 'KebabCaseLower'
  | 'KebabCaseUpper';

export interface NamingPolicyInfo {
  id: string;
  label: string;
  /** What the policy does to `IPAddress` - the name naive implementations get wrong. */
  example: string;
}

export interface NamingResult {
  /** `None` when this runtime did not recognise the policy that was asked for. */
  policy: string;
  /** C# property name → the JSON name the real policy produces. */
  names: Record<string, string>;
}

/** C# property name → serialized name, as resolved by the real .NET naming policy. */
export type NamingMap = ReadonlyMap<string, string>;

/**
 * Mirrors `RoundTripOptions`. Every field maps onto one real `JsonReaderOptions` or
 * `JsonWriterOptions` setting; the defaults are System.Text.Json's own.
 */
export interface RoundTripOptions {
  allowTrailingCommas: boolean;
  skipComments: boolean;
  /** 0 means System.Text.Json's default of 64, not "unlimited". */
  maxDepth: number;
  writeIndented: boolean;
  indentSize: number;
  indentWithTabs: boolean;
  /** Switches to `JavaScriptEncoder.UnsafeRelaxedJsonEscaping`. */
  relaxedEscaping: boolean;
}

export interface RoundTripError {
  message: string;
  /** Zero-based, as System.Text.Json reports it. Absent for positionless failures. */
  lineNumber: number | null;
  bytePositionInLine: number | null;
}

/** A place where .NET and JavaScript genuinely disagree about a value. */
export interface RoundTripNote {
  path: string;
  kind: string;
  detail: string;
  raw: string;
}

export interface RoundTripResult {
  /** Absent when {@link error} is set. */
  output?: string;
  error?: RoundTripError;
  notes: RoundTripNote[];
}

/**
 * Resolves property names through the real `System.Text.Json.JsonNamingPolicy` running in
 * WebAssembly.
 *
 * This exists because the reimplementation is the part that goes wrong. `camelCase` is
 * not "lowercase the first character": .NET lowercases the whole leading run of capitals,
 * so `IPAddress` is `ipAddress` and `ID` is `id`. Guessing wrong makes the generator emit
 * a `[JsonPropertyName]` that was never needed, or omit one that was - a bug that only
 * surfaces at runtime in the app consuming the generated model.
 *
 * Unlike {@link JwtVerifyService} this is an *upgrade* rather than a requirement: the
 * generator has always worked without the runtime and still does. {@link resolve}
 * therefore reports failure by returning `null` instead of throwing, so the caller can
 * fall back to its own approximation and say the names are unverified.
 */
@Injectable({ providedIn: 'root' })
export class JsonNamingService {
  private readonly runtime = inject(DotnetRuntimeService);

  readonly runtimeStatus = this.runtime.status;

  /**
   * @returns the resolved names, or `null` when the runtime is unavailable.
   */
  async resolve(names: readonly string[], policy: JsonNamingPolicyId): Promise<NamingMap | null> {
    if (names.length === 0) {
      return new Map();
    }

    try {
      const result = await invokeWasm<NamingResult>(this.runtime, wasm =>
        wasm.SerializationInterop.ApplyNaming(JSON.stringify({ policy, names }))
      );
      return new Map(Object.entries(result.names));
    } catch {
      return null;
    }
  }

  /**
   * Reads `payload` with the real `JsonDocument` and writes it back with the real
   * `Utf8JsonWriter`, under `options`.
   *
   * Deliberately the reader/writer layer rather than `Deserialize<T>`: binding into the
   * model the tool just generated would need a C# compiler in the browser, which the
   * toolbox does not ship. What is left is still .NET's answer to the questions that
   * actually catch people out - which characters get escaped, exactly where a parse error
   * is, and what a number too large for a double turns into.
   *
   * Unlike {@link resolve} there is no fallback at all: `JSON.parse` would report a
   * different error at a different place and escape nothing, so an approximation here
   * would be a wrong answer rather than a rough one. A load failure throws.
   */
  roundTrip(payload: string, options: RoundTripOptions): Promise<RoundTripResult> {
    return invokeWasm<RoundTripResult>(this.runtime, wasm =>
      wasm.SerializationInterop.RoundTrip(payload, JSON.stringify(options))
    );
  }

  /**
   * The policies this runtime actually ships, for building the picker. Sourced from .NET
   * rather than hard-coded so the list cannot claim a policy the deployed runtime is too
   * old to apply.
   *
   * @returns the catalog, or `null` when the runtime is unavailable.
   */
  async policies(): Promise<readonly NamingPolicyInfo[] | null> {
    try {
      return await invokeWasm<NamingPolicyInfo[]>(this.runtime, wasm =>
        wasm.SerializationInterop.GetNamingPolicies()
      );
    } catch {
      return null;
    }
  }
}
