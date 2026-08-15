import { Injectable, inject } from '@angular/core';
import { DotnetRuntimeService } from '../dotnet-runtime.service';
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

  async evaluate(
    pattern: string,
    testInput: string,
    options: RegexOptionsModel
  ): Promise<RegexEvaluation> {
    const exports = await this.runtime.load();
    const json = exports.Toolbox.Wasm.RegexInterop.Evaluate(
      pattern,
      testInput,
      JSON.stringify(options)
    );
    return JSON.parse(json) as RegexEvaluation;
  }

  async replacePreview(
    pattern: string,
    testInput: string,
    replacement: string,
    options: RegexOptionsModel
  ): Promise<RegexReplaceResult> {
    const exports = await this.runtime.load();
    const json = exports.Toolbox.Wasm.RegexInterop.Replace(
      pattern,
      testInput,
      replacement,
      JSON.stringify(options)
    );
    return JSON.parse(json) as RegexReplaceResult;
  }
}
