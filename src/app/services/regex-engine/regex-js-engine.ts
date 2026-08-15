import { Injectable } from '@angular/core';
import {
  MAX_MATCHES,
  RegexEngine,
  RegexEvaluation,
  RegexGroupResult,
  RegexMatchResult,
  RegexOptionsModel,
  RegexReplaceResult,
} from './regex-engine';

/** RegexOptions members the browser's engine has no flag for. */
const UNSUPPORTED_OPTIONS: { key: keyof RegexOptionsModel; label: string }[] = [
  { key: 'ignorePatternWhitespace', label: 'IgnorePatternWhitespace' },
  { key: 'explicitCapture', label: 'ExplicitCapture' },
  { key: 'cultureInvariant', label: 'CultureInvariant' },
  { key: 'rightToLeft', label: 'RightToLeft' },
  { key: 'nonBacktracking', label: 'NonBacktracking' },
];

/**
 * The browser's own `RegExp`, used **only** when the .NET runtime fails to load.
 *
 * It is an approximation: it cannot honour the options listed above, and it differs
 * from .NET on `$`, `\b` and `\d` even for patterns it does accept. Every result it
 * returns therefore carries an `engineWarning` so the UI can say so out loud.
 */
@Injectable({ providedIn: 'root' })
export class RegexJsEngine implements RegexEngine {
  readonly kind = 'javascript' as const;

  evaluate(
    pattern: string,
    testInput: string,
    options: RegexOptionsModel
  ): Promise<RegexEvaluation> {
    if (!pattern) {
      return Promise.resolve({ matches: [] });
    }

    let regex: RegExp;
    try {
      regex = new RegExp(pattern, this.buildJsFlags(options));
    } catch (error) {
      return Promise.resolve({
        matches: [],
        error: error instanceof Error ? error.message : 'Invalid regular expression',
      });
    }

    const matches: RegexMatchResult[] = [];
    let truncated = false;
    for (const match of testInput.matchAll(regex)) {
      matches.push(this.toMatchResult(match));
      if (matches.length >= MAX_MATCHES) {
        truncated = true;
        break;
      }
    }

    return Promise.resolve({
      matches,
      truncated,
      engineWarning: this.buildEngineWarning(options),
    });
  }

  replacePreview(
    pattern: string,
    testInput: string,
    replacement: string,
    options: RegexOptionsModel
  ): Promise<RegexReplaceResult> {
    if (!pattern) {
      return Promise.resolve({ result: testInput });
    }

    try {
      const regex = new RegExp(pattern, this.buildJsFlags(options));
      return Promise.resolve({ result: testInput.replace(regex, replacement) });
    } catch (error) {
      return Promise.resolve({
        result: testInput,
        error: error instanceof Error ? error.message : 'Invalid regular expression',
      });
    }
  }

  private buildJsFlags(options: RegexOptionsModel): string {
    let flags = 'gd';
    if (options.ignoreCase) flags += 'i';
    if (options.multiline) flags += 'm';
    if (options.singleline) flags += 's';
    return flags;
  }

  private buildEngineWarning(options: RegexOptionsModel): string {
    const active = UNSUPPORTED_OPTIONS.filter(o => options[o.key]).map(o => o.label);
    const preamble =
      'The .NET engine could not be loaded, so this preview is running in your ' +
      "browser's JavaScript engine and is only an approximation of .NET behaviour.";

    return active.length === 0
      ? preamble
      : `${preamble} It has no equivalent for: ${active.join(', ')} - those options affect the generated C# only.`;
  }

  private toMatchResult(match: RegExpMatchArray): RegexMatchResult {
    const groups: RegexGroupResult[] = [];

    if (match.groups) {
      for (const [name, value] of Object.entries(match.groups)) {
        if (value === undefined) continue;
        const range = match.indices?.groups?.[name];
        groups.push({ name, value, index: range ? range[0] : -1 });
      }
    }

    for (let i = 1; i < match.length; i++) {
      const value = match[i];
      if (value === undefined) continue;
      const range = match.indices?.[i];
      groups.push({ name: String(i), value, index: range ? range[0] : -1 });
    }

    return {
      value: match[0],
      index: match.index ?? -1,
      length: match[0].length,
      groups,
    };
  }
}
