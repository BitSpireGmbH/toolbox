import { Injectable, inject } from '@angular/core';
import { DotnetRuntimeService, invokeWasm } from './dotnet-runtime.service';

/**
 * Mirrors the C# contracts in `dotnet/Toolbox.Wasm.Core/Layout/LayoutContracts.cs`. The
 * shapes are produced by source-generated camelCase serialization on that side, and
 * pinned there by `LayoutJsonFacadeTests`, so these interfaces describe the wire format
 * rather than re-deriving it.
 */
export type LayoutTarget = 'X64' | 'Arm64' | 'X86' | 'Wasm32';

export interface LayoutField {
  name: string;
  type: string;
  offset: number;
  size: number;
  alignment: number;
  /** Bytes inserted before this field to satisfy its alignment. */
  paddingBefore: number;
  /** The offset came from `[FieldOffset]` rather than from packing. */
  isExplicit: boolean;
  /** These bytes are shared with another field. */
  overlaps: boolean;
}

export interface LayoutSuggestion {
  fieldOrder: string[];
  size: number;
  paddingBytes: number;
}

export interface StructLayout {
  name: string;
  /** `Sequential`, `Auto`, or `Explicit` - what the runtime does, not what was written. */
  kind: string;
  size: number;
  alignment: number;
  paddingBytes: number;
  /** 0 when no `Pack` was given. */
  pack: number;
  fields: LayoutField[];
  trailingPadding: number;
  /** Absent when the layout is already tight, or when the order is not the source's. */
  suggestion?: LayoutSuggestion;
  notes: string[];
}

export interface LayoutResult {
  target: string;
  structs: StructLayout[];
  diagnostics: string[];
  /** What this answer does not guarantee. Populated for the 32-bit targets. */
  caveats: string[];
}

/** The targets, in the order the picker offers them. */
export const LAYOUT_TARGETS: readonly { id: LayoutTarget; label: string; note: string }[] = [
  { id: 'X64', label: 'x64', note: '64-bit. Pinned against the real runtime.' },
  { id: 'Arm64', label: 'ARM64', note: '64-bit. Identical to x64 under these rules.' },
  { id: 'X86', label: 'x86', note: '32-bit. Best effort.' },
  { id: 'Wasm32', label: 'wasm32', note: '32-bit. What this page is running on.' },
];

/**
 * Lays out C# structs using the rules the .NET runtime actually applies, for a chosen
 * target architecture.
 *
 * The target is a choice rather than a measurement, and that is the point. This code is
 * executing on `browser-wasm`, where a pointer is four bytes, so measuring the live
 * runtime would give a real answer about a machine nobody ships to. Instead the rules are
 * modelled with the pointer size as a parameter, and `LayoutRuntimeParityTests` pins the
 * model against `Unsafe.SizeOf`/`Unsafe.ByteOffset` on a 64-bit host - which is the
 * default target.
 *
 * Like {@link JwtVerifyService} there is deliberately **no JavaScript fallback**. An
 * approximate offset table is not a degraded answer, it is a wrong one, and the entire
 * value of the tool is that its numbers are the runtime's.
 */
@Injectable({ providedIn: 'root' })
export class StructLayoutService {
  private readonly runtime = inject(DotnetRuntimeService);

  readonly runtimeStatus = this.runtime.status;
  readonly runtimeFailure = this.runtime.failure;

  /** What the runtime says about itself, so the page cannot claim a version it is not running. */
  readonly frameworkDescription = this.runtime.frameworkDescription;

  /**
   * No error handling for unreadable source: .NET reports those in `diagnostics`. A throw
   * from here means the runtime itself broke.
   */
  calculate(source: string, target: LayoutTarget): Promise<LayoutResult> {
    return invokeWasm<LayoutResult>(this.runtime, wasm =>
      wasm.LayoutInterop.Calculate(JSON.stringify({ source, target }))
    );
  }
}
