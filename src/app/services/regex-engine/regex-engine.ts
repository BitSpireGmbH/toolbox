/**
 * The contract every regex backend implements.
 *
 * Two exist: the real .NET engine running in WebAssembly, and a JavaScript
 * approximation kept only for when the runtime cannot be loaded. Keeping them
 * behind one interface is also what lets the tests run in jsdom, where there is no
 * .NET runtime to talk to.
 */

export interface RegexOptionsModel {
  ignoreCase: boolean;
  multiline: boolean;
  singleline: boolean;
  ignorePatternWhitespace: boolean;
  explicitCapture: boolean;
  cultureInvariant: boolean;
  rightToLeft: boolean;
  /** The linear-time engine. No JavaScript equivalent whatsoever. */
  nonBacktracking: boolean;
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
  /**
   * Only ever set by the JavaScript fallback, to admit which options it silently
   * ignored. The .NET engine honours all of them, so it leaves this empty.
   */
  engineWarning?: string;
  /** True when the match cap was hit and results are incomplete. */
  truncated?: boolean;
}

export interface RegexReplaceResult {
  result: string;
  error?: string;
}

export type RegexEngineKind = 'dotnet' | 'javascript';

export interface RegexEngine {
  readonly kind: RegexEngineKind;
  evaluate(
    pattern: string,
    testInput: string,
    options: RegexOptionsModel
  ): Promise<RegexEvaluation>;
  replacePreview(
    pattern: string,
    testInput: string,
    replacement: string,
    options: RegexOptionsModel
  ): Promise<RegexReplaceResult>;
}

/** Safety cap so a pattern that matches at (almost) every position doesn't stall the UI. */
export const MAX_MATCHES = 1000;

export const NO_REGEX_OPTIONS: RegexOptionsModel = {
  ignoreCase: false,
  multiline: false,
  singleline: false,
  ignorePatternWhitespace: false,
  explicitCapture: false,
  cultureInvariant: false,
  rightToLeft: false,
  nonBacktracking: false,
};

export const EMPTY_EVALUATION: RegexEvaluation = { matches: [] };
