import { Injectable, inject } from '@angular/core';
import { DotnetRuntimeService } from './dotnet-runtime.service';

/**
 * Mirrors the C# contracts in `dotnet/Toolbox.Wasm.Core/Linq/LinqContracts.cs`. The
 * shapes are produced by source-generated camelCase serialization on that side, and
 * pinned there by `LinqJsonFacadeTests`, so these interfaces describe the wire format
 * rather than re-deriving it.
 */
export interface LinqSourceSpec {
  kind: string;
  count: number;
}

export interface LinqOperatorSpec {
  id: string;
  number?: number;
  text?: string;
}

export interface LinqPipelineSpec {
  source: LinqSourceSpec;
  operators: LinqOperatorSpec[];
  terminal: string;
  enumerateTwice: boolean;
}

export type LinqStageKind = 'source' | 'streaming' | 'buffering';

export interface LinqStage {
  index: number;
  label: string;
  kind: LinqStageKind;
}

export type LinqEventKind = 'pulled' | 'yielded' | 'exhausted';

export interface LinqTraceEvent {
  step: number;
  stage: number;
  kind: LinqEventKind;
  /** Absent on `pulled` and `exhausted`, which carry no element. */
  value?: string;
  /** 0, or 1 for the second pass of a double enumeration. */
  pass: number;
}

export interface LinqStats {
  sourcePulls: number;
  sourceYields: number;
  totalEvents: number;
  shortCircuited: boolean;
}

export interface LinqRunResult {
  stages: LinqStage[];
  events: LinqTraceEvent[];
  methodSyntax: string;
  /** Absent when the chain has no faithful single-expression query form. */
  querySyntax?: string;
  resultText: string;
  stats: LinqStats;
  error?: string;
  truncated: boolean;
}

export interface LinqOperatorInfo {
  id: string;
  label: string;
  kind: 'streaming' | 'buffering';
  argKind?: 'number' | 'text';
  defaultNumber?: number;
  defaultText?: string;
  sources: string[];
  hint: string;
  /** Palette heading, e.g. 'Filtering'. Supplied by the catalog, not chosen here. */
  group: string;
}

export interface LinqTerminalInfo {
  id: string;
  label: string;
  sources: string[];
  hint: string;
  /** Grouped by whether the operator can stop early - the thing the tool teaches. */
  group: string;
}

export interface LinqSourceInfo {
  kind: string;
  label: string;
  elementType: string;
}

export interface LinqCatalog {
  sources: LinqSourceInfo[];
  operators: LinqOperatorInfo[];
  terminals: LinqTerminalInfo[];
}

export const NUMBERS_SOURCE = 'numbers';
export const PEOPLE_SOURCE = 'people';

/**
 * Runs LINQ pipelines through the real `System.Linq` in WebAssembly.
 *
 * Unlike {@link RegexTesterService} there is deliberately **no JavaScript fallback**.
 * The Regex Tester has one because `RegExp` is a defensible degraded mode; here the
 * entire subject is .NET enumeration semantics, so an approximation would be teaching
 * something false. The tool gates on the runtime and says so instead.
 */
@Injectable({ providedIn: 'root' })
export class LinqVisualizerService {
  private readonly runtime = inject(DotnetRuntimeService);

  readonly runtimeStatus = this.runtime.status;
  readonly runtimeFailure = this.runtime.failure;
  readonly frameworkDescription = this.runtime.frameworkDescription;

  /**
   * Fetched once and shared. The palette is served by the runtime rather than kept as
   * a TypeScript copy, so the labels, the generated C# and the lambdas that actually
   * run cannot drift apart.
   */
  private catalogRequest: Promise<LinqCatalog> | null = null;

  loadCatalog(): Promise<LinqCatalog> {
    this.catalogRequest ??= this.runtime
      .load()
      .then(exports => JSON.parse(exports.Toolbox.Wasm.LinqInterop.GetCatalog()) as LinqCatalog)
      .catch((error: unknown) => {
        // Discarded so a transient failure can be retried rather than poisoning the
        // session, matching how DotnetRuntimeService treats its own load.
        this.catalogRequest = null;
        throw error;
      });

    return this.catalogRequest;
  }

  /**
   * No error handling for bad pipelines: .NET catches those and returns them in the
   * payload's `error` field. A throw from here means the runtime itself broke.
   */
  async run(spec: LinqPipelineSpec): Promise<LinqRunResult> {
    const exports = await this.runtime.load();
    return JSON.parse(exports.Toolbox.Wasm.LinqInterop.Run(JSON.stringify(spec))) as LinqRunResult;
  }
}
