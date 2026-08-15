import { Injectable, inject } from '@angular/core';
import { DotnetRuntimeService, invokeWasm } from '../dotnet-runtime.service';
import {
  RegexEngine,
  RegexEvaluation,
  RegexOptionsModel,
  RegexReplaceResult,
} from './regex-engine';

/**
 * The real `System.Text.RegularExpressions`, running in WebAssembly.
 *
 * Everything crosses the boundary as JSON because JSImport/JSExport cannot marshal
 * complex objects; the C# side already shapes that JSON to match the interfaces in
 * `regex-engine.ts`, so there is no translation to do here.
 *
 * Note there is no error handling for bad patterns: .NET catches those and returns
 * them in the payload's `error` field. A throw from here means the runtime itself
 * broke, which is the caller's cue to fall back.
 */
@Injectable({ providedIn: 'root' })
export class RegexWasmEngine implements RegexEngine {
  readonly kind = 'dotnet' as const;

  private readonly runtime = inject(DotnetRuntimeService);

  evaluate(
    pattern: string,
    testInput: string,
    options: RegexOptionsModel
  ): Promise<RegexEvaluation> {
    return invokeWasm<RegexEvaluation>(this.runtime, wasm =>
      wasm.RegexInterop.Evaluate(pattern, testInput, JSON.stringify(options))
    );
  }

  replacePreview(
    pattern: string,
    testInput: string,
    replacement: string,
    options: RegexOptionsModel
  ): Promise<RegexReplaceResult> {
    return invokeWasm<RegexReplaceResult>(this.runtime, wasm =>
      wasm.RegexInterop.Replace(pattern, testInput, replacement, JSON.stringify(options))
    );
  }
}
