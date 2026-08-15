import { Injectable, inject, signal } from '@angular/core';
import { DotnetRuntimeService } from './dotnet-runtime.service';
import { RegexEngine, RegexEngineKind } from './regex-engine/regex-engine';
import { RegexJsEngine } from './regex-engine/regex-js-engine';
import { RegexWasmEngine } from './regex-engine/regex-wasm-engine';

export type {
  RegexEngineKind,
  RegexEvaluation,
  RegexGroupResult,
  RegexMatchResult,
  RegexOptionsModel,
  RegexReplaceResult,
} from './regex-engine/regex-engine';
export { NO_REGEX_OPTIONS, EMPTY_EVALUATION } from './regex-engine/regex-engine';

import type {
  RegexEvaluation,
  RegexOptionsModel,
  RegexReplaceResult,
} from './regex-engine/regex-engine';

export type RegexCodeStyle = 'source-generated' | 'classic';

/**
 * Runs patterns through the real .NET engine and generates the matching C#.
 *
 * Matching is asynchronous because the engine lives in WebAssembly. The runtime is
 * fetched once, on first use; if that fails the service degrades to the browser's
 * own `RegExp` and says so via {@link engineKind}, rather than leaving the tool dead.
 */
@Injectable({
  providedIn: 'root',
})
export class RegexTesterService {
  private readonly runtime = inject(DotnetRuntimeService);
  private readonly wasmEngine = inject(RegexWasmEngine);
  private readonly jsEngine = inject(RegexJsEngine);

  /** Null until the first evaluation has decided which engine it could get. */
  private readonly currentEngineKind = signal<RegexEngineKind | null>(null);
  readonly engineKind = this.currentEngineKind.asReadonly();

  readonly runtimeStatus = this.runtime.status;
  readonly frameworkDescription = this.runtime.frameworkDescription;

  /**
   * Resolved once and reused. The fallback decision is sticky for the session on
   * purpose: retrying a multi-megabyte download on every keystroke would be worse
   * than living with the approximation for one visit.
   */
  private engineSelection: Promise<RegexEngine> | null = null;

  async evaluate(
    pattern: string,
    testInput: string,
    options: RegexOptionsModel
  ): Promise<RegexEvaluation> {
    const engine = await this.selectEngine();
    return engine.evaluate(pattern, testInput, options);
  }

  async replacePreview(
    pattern: string,
    testInput: string,
    replacement: string,
    options: RegexOptionsModel
  ): Promise<RegexReplaceResult> {
    const engine = await this.selectEngine();
    return engine.replacePreview(pattern, testInput, replacement, options);
  }

  private selectEngine(): Promise<RegexEngine> {
    this.engineSelection ??= this.runtime
      .load()
      .then(() => this.wasmEngine as RegexEngine)
      .catch(() => this.jsEngine as RegexEngine)
      .then(engine => {
        this.currentEngineKind.set(engine.kind);
        return engine;
      });

    return this.engineSelection;
  }

  generateCode(
    pattern: string,
    options: RegexOptionsModel,
    style: RegexCodeStyle,
    className: string,
    methodName: string
  ): string {
    const literal = this.toVerbatimLiteral(pattern);
    const optionsArg = this.buildOptionsArgument(options);
    const args = optionsArg ? `${literal}, ${optionsArg}` : literal;

    if (style === 'source-generated') {
      const safeClassName = this.sanitizeIdentifier(className, 'RegexPatterns');
      let safeMethodName = this.sanitizeIdentifier(methodName, 'MyRegex');
      if (safeMethodName === safeClassName) {
        safeMethodName += 'Regex';
      }

      return `using System.Text.RegularExpressions;

public partial class ${safeClassName}
{
    [GeneratedRegex(${args})]
    public static partial Regex ${safeMethodName}();
}

// Usage:
// foreach (Match match in ${safeClassName}.${safeMethodName}().Matches(input))
//     Console.WriteLine(match.Value);`;
    }

    return `using System.Text.RegularExpressions;

var regex = new Regex(${args});

foreach (Match match in regex.Matches(input))
    Console.WriteLine(match.Value);`;
  }

  private toVerbatimLiteral(pattern: string): string {
    return `@"${pattern.replace(/"/g, '""')}"`;
  }

  private buildOptionsArgument(options: RegexOptionsModel): string {
    const flags: string[] = [];
    if (options.ignoreCase) flags.push('RegexOptions.IgnoreCase');
    if (options.multiline) flags.push('RegexOptions.Multiline');
    if (options.singleline) flags.push('RegexOptions.Singleline');
    if (options.ignorePatternWhitespace) flags.push('RegexOptions.IgnorePatternWhitespace');
    if (options.explicitCapture) flags.push('RegexOptions.ExplicitCapture');
    if (options.cultureInvariant) flags.push('RegexOptions.CultureInvariant');
    if (options.rightToLeft) flags.push('RegexOptions.RightToLeft');
    if (options.nonBacktracking) flags.push('RegexOptions.NonBacktracking');
    return flags.join(' | ');
  }

  private sanitizeIdentifier(name: string, fallback: string): string {
    const trimmed = (name || '').trim();
    if (!trimmed) return fallback;

    let cleaned = trimmed.replace(/[^A-Za-z0-9_]/g, '');
    if (!cleaned) return fallback;
    if (/^[0-9]/.test(cleaned)) cleaned = `_${cleaned}`;
    return cleaned;
  }
}
