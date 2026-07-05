import { Injectable } from '@angular/core';

export type RegexCodeStyle = 'source-generated' | 'classic';

export interface RegexOptionsModel {
  ignoreCase: boolean;
  multiline: boolean;
  singleline: boolean;
  ignorePatternWhitespace: boolean;
  explicitCapture: boolean;
  cultureInvariant: boolean;
  rightToLeft: boolean;
}

export interface RegexGroupResult {
  name: string;
  value: string;
  index: number;
}

export interface RegexMatchResult {
  value: string;
  index: number;
  length: number;
  groups: RegexGroupResult[];
}

export interface RegexEvaluation {
  matches: RegexMatchResult[];
  error?: string;
  engineWarning?: string;
}

export interface RegexReplaceResult {
  result: string;
  error?: string;
}

/** RegexOptions members with no ECMAScript flag equivalent - previewed only in the generated C#. */
const DOTNET_ONLY_OPTIONS: { key: keyof RegexOptionsModel; label: string }[] = [
  { key: 'ignorePatternWhitespace', label: 'IgnorePatternWhitespace' },
  { key: 'explicitCapture', label: 'ExplicitCapture' },
  { key: 'cultureInvariant', label: 'CultureInvariant' },
  { key: 'rightToLeft', label: 'RightToLeft' },
];

/** Safety cap so a pattern that matches at (almost) every position doesn't stall the UI. */
const MAX_MATCHES = 1000;

@Injectable({
  providedIn: 'root',
})
export class RegexTesterService {
  evaluate(pattern: string, testInput: string, options: RegexOptionsModel): RegexEvaluation {
    if (!pattern) {
      return { matches: [] };
    }

    let regex: RegExp;
    try {
      regex = new RegExp(pattern, this.buildJsFlags(options));
    } catch (error) {
      return {
        matches: [],
        error: error instanceof Error ? error.message : 'Invalid regular expression',
      };
    }

    const matches: RegexMatchResult[] = [];
    for (const match of testInput.matchAll(regex)) {
      matches.push(this.toMatchResult(match));
      if (matches.length >= MAX_MATCHES) {
        break;
      }
    }

    return { matches, engineWarning: this.buildEngineWarning(options) };
  }

  replacePreview(
    pattern: string,
    testInput: string,
    replacement: string,
    options: RegexOptionsModel
  ): RegexReplaceResult {
    if (!pattern) {
      return { result: testInput };
    }

    try {
      const regex = new RegExp(pattern, this.buildJsFlags(options));
      return { result: testInput.replace(regex, replacement) };
    } catch (error) {
      return {
        result: testInput,
        error: error instanceof Error ? error.message : 'Invalid regular expression',
      };
    }
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

  private buildJsFlags(options: RegexOptionsModel): string {
    let flags = 'gd';
    if (options.ignoreCase) flags += 'i';
    if (options.multiline) flags += 'm';
    if (options.singleline) flags += 's';
    return flags;
  }

  private buildEngineWarning(options: RegexOptionsModel): string | undefined {
    const active = DOTNET_ONLY_OPTIONS.filter(o => options[o.key]).map(o => o.label);
    if (active.length === 0) {
      return undefined;
    }
    return `The live preview runs in your browser's JavaScript engine, which has no equivalent for: ${active.join(', ')}. These options have no effect on the preview above, but are still applied to the generated C# code.`;
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
