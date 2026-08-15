import { inject, Injectable } from '@angular/core';
import {
  RegexEvaluation,
  RegexOptionsModel,
  RegexTesterService,
} from './regex-tester.service';

export type RegexPartKind =
  | 'literal'
  | 'escape'
  | 'class'
  | 'dot'
  | 'anchor'
  | 'group'
  | 'alternation'
  | 'backreference'
  | 'unknown';

export interface RegexGroupInfo {
  capturing: boolean;
  name?: string;
  number?: number;
  /** Short caption drawn on the group box, e.g. `CAPTURE - NAMED "YEAR"`. */
  heading: string;
  lookaround: boolean;
}

/**
 * One link in the chain shown beneath the pattern field.
 *
 * `start`/`end` are offsets into the pattern string, which stays the single
 * source of truth - every edit operation is a slice-and-splice on those
 * offsets, so typing into the field and building visually are the same thing.
 */
export interface RegexPart {
  start: number;
  /** Exclusive, and includes the quantifier. */
  end: number;
  /** Where the atom stops and its quantifier begins. */
  atomEnd: number;
  source: string;
  /** '', '?', '+', '*', '{2}', '{2,}', '{2,5}', each optionally lazy. */
  quantifier: string;
  kind: RegexPartKind;
  /** Plain-English reading, e.g. '4 × digits 0-9'. */
  label: string;
  /**
   * Set for anything nested in a lookahead/lookbehind. Those parts cannot be
   * mapped back to the test text - see `mapPart`.
   */
  insideLookaround: boolean;
  children?: RegexPart[];
  group?: RegexGroupInfo;
}

export interface RegexParseResult {
  parts: RegexPart[];
  /** True when the pattern blew past `MAX_PARTS` and the chain was cut short. */
  truncated: boolean;
}

export interface RegexRange {
  index: number;
  length: number;
}

export interface RegexTip {
  kind: 'error' | 'warning' | 'info';
  text: string;
}

/** A piece the "Add part" palette can splice into the pattern. */
export interface RegexPaletteItem {
  label: string;
  snippet: string;
  /** `^` only makes sense at the front, everything else appends. */
  prepend?: boolean;
}

/**
 * Name of the throwaway capture group `mapPart` injects. Deliberately not a
 * plausible user group name, because a collision would make the read-back
 * ambiguous - and that case bails out rather than guessing.
 */
const PROBE_GROUP = 'tbxProbe';

/** Chain length beyond which a pasted monster pattern would stall rendering. */
const MAX_PARTS = 200;

const QUANTIFIER = /^(?:[*+?]|\{\d+(?:,\d*)?\})\??/;

/** Escapes that stand for a set of characters rather than one literal. */
const ESCAPE_LABELS: Record<string, string> = {
  d: 'digits 0-9',
  D: 'anything but a digit',
  w: 'letters, digits or _',
  W: 'anything but a word char',
  s: 'whitespace',
  S: 'anything but whitespace',
  n: 'a line break',
  r: 'a carriage return',
  t: 'a tab',
  f: 'a form feed',
  v: 'a vertical tab',
  '0': 'a null char',
};

interface ScanState {
  pattern: string;
  i: number;
  groupCount: number;
  emitted: number;
}

@Injectable({
  providedIn: 'root',
})
export class RegexExplainService {
  private readonly regexService = inject(RegexTesterService);

  // --------------------------------------------------------------- parsing

  /**
   * Tokenises the pattern into the chain of parts.
   *
   * Never throws and never reports an error: the field has to stay usable
   * mid-typing, so half-written constructs become `unknown` parts and the real
   * syntax error is left to `RegexTesterService.evaluate`, which already
   * produces a proper message.
   */
  parse(pattern: string): RegexParseResult {
    const state: ScanState = { pattern, i: 0, groupCount: 0, emitted: 0 };
    const parts = this.parseSequence(state, false, false);
    return { parts, truncated: state.emitted > MAX_PARTS };
  }

  /** Depth-first walk, groups before their children. */
  flatten(parts: RegexPart[]): RegexPart[] {
    const out: RegexPart[] = [];
    for (const part of parts) {
      out.push(part);
      if (part.children) {
        out.push(...this.flatten(part.children));
      }
    }
    return out;
  }

  /** Re-anchors a selection after an edit shifted every offset. */
  findByStart(parts: RegexPart[], start: number | null): RegexPart | null {
    if (start === null) return null;
    return this.flatten(parts).find(part => part.start === start) ?? null;
  }

  private parseSequence(state: ScanState, insideLookaround: boolean, nested: boolean): RegexPart[] {
    const out: RegexPart[] = [];
    const { pattern } = state;
    let literalStart = -1;

    const flushLiteral = (): void => {
      if (literalStart < 0) return;
      const text = pattern.slice(literalStart, state.i);
      state.emitted += 1;
      out.push({
        start: literalStart,
        end: state.i,
        atomEnd: state.i,
        source: text,
        quantifier: '',
        kind: 'literal',
        label: `the text "${text}"`,
        insideLookaround,
      });
      literalStart = -1;
    };

    while (state.i < pattern.length) {
      if (state.emitted > MAX_PARTS) break;
      const char = pattern[state.i];

      if (char === ')') {
        flushLiteral();
        if (nested) return out;
        // A stray closer: keep it visible rather than swallowing it, so the
        // chain still lines up with what the user typed.
        out.push(this.zeroWidthPart(state, 'unknown', 1, 'unmatched )', insideLookaround));
        continue;
      }

      if (char === '|') {
        flushLiteral();
        out.push(this.zeroWidthPart(state, 'alternation', 1, 'or', insideLookaround));
        continue;
      }

      if (char === '(') {
        flushLiteral();
        out.push(this.parseGroup(state, insideLookaround));
        continue;
      }

      if (char === '[') {
        flushLiteral();
        out.push(this.parseClass(state, insideLookaround));
        continue;
      }

      if (char === '\\') {
        flushLiteral();
        out.push(this.parseEscape(state, insideLookaround));
        continue;
      }

      if (char === '.') {
        flushLiteral();
        const start = state.i;
        state.i += 1;
        out.push(this.finishAtom(state, start, 'dot', 'any char', 'any char', insideLookaround));
        continue;
      }

      if (char === '^' || char === '$') {
        flushLiteral();
        const label = char === '^' ? 'start of line' : 'end of line';
        out.push(this.zeroWidthPart(state, 'anchor', 1, label, insideLookaround));
        continue;
      }

      // Reaching a quantifier here means nothing precedes it - every real atom
      // swallows its own quantifier below. A `{` that does not open a valid
      // quantifier body reads as '' and falls through to the literal branch,
      // which is what JS does with it too.
      const dangling = this.readQuantifier(pattern, state.i);
      if (dangling) {
        flushLiteral();
        out.push(
          this.zeroWidthPart(state, 'unknown', dangling.length, 'stray quantifier', insideLookaround)
        );
        continue;
      }

      // A quantified literal has to stand alone, otherwise the quantifier would
      // silently apply to just the last character of the whole run.
      if (this.readQuantifier(pattern, state.i + 1)) {
        flushLiteral();
        const start = state.i;
        state.i += 1;
        out.push(
          this.finishAtom(state, start, 'literal', `"${char}"`, `the text "${char}"`, insideLookaround)
        );
        continue;
      }

      if (literalStart < 0) literalStart = state.i;
      state.i += 1;
    }

    flushLiteral();
    return out;
  }

  private parseGroup(state: ScanState, insideLookaround: boolean): RegexPart {
    const { pattern } = state;
    const start = state.i;
    state.i += 1;

    let group: RegexGroupInfo;
    if (pattern.startsWith('?:', state.i)) {
      state.i += 2;
      group = { capturing: false, heading: 'GROUP', lookaround: false };
    } else if (pattern.startsWith('?=', state.i)) {
      state.i += 2;
      group = { capturing: false, heading: 'FOLLOWED BY', lookaround: true };
    } else if (pattern.startsWith('?!', state.i)) {
      state.i += 2;
      group = { capturing: false, heading: 'NOT FOLLOWED BY', lookaround: true };
    } else if (pattern.startsWith('?<=', state.i)) {
      state.i += 3;
      group = { capturing: false, heading: 'PRECEDED BY', lookaround: true };
    } else if (pattern.startsWith('?<!', state.i)) {
      state.i += 3;
      group = { capturing: false, heading: 'NOT PRECEDED BY', lookaround: true };
    } else if (pattern.startsWith('?<', state.i)) {
      const close = pattern.indexOf('>', state.i + 2);
      if (close === -1) {
        return this.unknownToEnd(state, start, 'unfinished group name', insideLookaround);
      }
      const name = pattern.slice(state.i + 2, close);
      state.i = close + 1;
      // Named groups are numbered too, so the counter has to advance here as
      // well or every later group number would be off by one.
      state.groupCount += 1;
      group = {
        capturing: true,
        name,
        number: state.groupCount,
        heading: `CAPTURE - NAMED "${name.toUpperCase()}"`,
        lookaround: false,
      };
    } else if (pattern[state.i] === '?') {
      return this.unknownToEnd(state, start, 'unsupported group', insideLookaround);
    } else {
      state.groupCount += 1;
      group = {
        capturing: true,
        number: state.groupCount,
        heading: `CAPTURE - GROUP ${state.groupCount}`,
        lookaround: false,
      };
    }

    const children = this.parseSequence(state, insideLookaround || group.lookaround, true);

    if (pattern[state.i] !== ')') {
      const part = this.unknownToEnd(state, start, 'unclosed group', insideLookaround);
      part.children = children;
      return part;
    }
    state.i += 1;

    const atomEnd = state.i;
    const quantifier = this.readQuantifier(pattern, state.i);
    state.i += quantifier.length;

    state.emitted += 1;
    return {
      start,
      end: state.i,
      atomEnd,
      source: pattern.slice(start, state.i),
      quantifier,
      kind: 'group',
      label: this.quantifierPhrase(quantifier),
      insideLookaround,
      children,
      group,
    };
  }

  private parseClass(state: ScanState, insideLookaround: boolean): RegexPart {
    const { pattern } = state;
    const start = state.i;
    let cursor = start + 1;
    const negated = pattern[cursor] === '^';
    if (negated) cursor += 1;

    const bodyStart = cursor;
    while (cursor < pattern.length && pattern[cursor] !== ']') {
      if (pattern[cursor] === '\\') cursor += 1;
      cursor += 1;
    }
    if (cursor >= pattern.length) {
      return this.unknownToEnd(state, start, 'unclosed character class', insideLookaround);
    }

    const description = this.describeClass(pattern.slice(bodyStart, cursor), negated);
    state.i = cursor + 1;
    return this.finishAtom(state, start, 'class', description, description, insideLookaround);
  }

  private parseEscape(state: ScanState, insideLookaround: boolean): RegexPart {
    const { pattern } = state;
    const start = state.i;

    if (start + 1 >= pattern.length) {
      return this.unknownToEnd(state, start, 'dangling backslash', insideLookaround);
    }

    const char = pattern[start + 1];

    if (char === 'b' || char === 'B') {
      const label = char === 'b' ? 'word boundary' : 'not a word boundary';
      return this.zeroWidthPart(state, 'anchor', 2, label, insideLookaround);
    }

    if (char >= '1' && char <= '9') {
      let cursor = start + 1;
      while (cursor < pattern.length && pattern[cursor] >= '0' && pattern[cursor] <= '9') cursor += 1;
      const number = pattern.slice(start + 1, cursor);
      state.i = cursor;
      const label = `same text as group ${number}`;
      return this.finishAtom(state, start, 'backreference', label, label, insideLookaround);
    }

    if (char === 'k' && pattern[start + 2] === '<') {
      const close = pattern.indexOf('>', start + 3);
      if (close !== -1) {
        const name = pattern.slice(start + 3, close);
        state.i = close + 1;
        const label = `same text as group "${name}"`;
        return this.finishAtom(state, start, 'backreference', label, label, insideLookaround);
      }
    }

    // \uHHHH, \xHH, \cX and \p{...} are single units - splitting them would let
    // a quantifier bind to the last hex digit.
    let width = 2;
    if ((char === 'u' || char === 'p' || char === 'P') && pattern[start + 2] === '{') {
      const close = pattern.indexOf('}', start + 2);
      width = close === -1 ? 2 : close - start + 1;
    } else if (char === 'u') {
      width = 6;
    } else if (char === 'x') {
      width = 4;
    } else if (char === 'c') {
      width = 3;
    }
    width = Math.min(width, pattern.length - start);

    const known = ESCAPE_LABELS[char];
    const body = pattern.slice(start + 1, start + width);
    state.i = start + width;
    return this.finishAtom(
      state,
      start,
      'escape',
      known ?? `"${body}"`,
      known ?? `the character "${body}"`,
      insideLookaround
    );
  }

  /**
   * Closes an atom whose source the caller has already consumed, attaching
   * whatever quantifier follows it.
   */
  private finishAtom(
    state: ScanState,
    start: number,
    kind: RegexPartKind,
    noun: string,
    phrase: string,
    insideLookaround: boolean
  ): RegexPart {
    const atomEnd = state.i;
    const quantifier = this.readQuantifier(state.pattern, state.i);
    state.i += quantifier.length;

    state.emitted += 1;
    return {
      start,
      end: state.i,
      atomEnd,
      source: state.pattern.slice(start, state.i),
      quantifier,
      kind,
      label: this.compose(noun, phrase, quantifier),
      insideLookaround,
    };
  }

  /** An atom that never takes a quantifier: anchors, `|`, stray characters. */
  private zeroWidthPart(
    state: ScanState,
    kind: RegexPartKind,
    width: number,
    label: string,
    insideLookaround: boolean
  ): RegexPart {
    const start = state.i;
    state.i += width;
    state.emitted += 1;
    return {
      start,
      end: state.i,
      atomEnd: state.i,
      source: state.pattern.slice(start, state.i),
      quantifier: '',
      kind,
      label,
      insideLookaround,
    };
  }

  private unknownToEnd(
    state: ScanState,
    start: number,
    label: string,
    insideLookaround: boolean
  ): RegexPart {
    state.i = state.pattern.length;
    state.emitted += 1;
    return {
      start,
      end: state.i,
      atomEnd: state.i,
      source: state.pattern.slice(start),
      quantifier: '',
      kind: 'unknown',
      label,
      insideLookaround,
    };
  }

  private readQuantifier(pattern: string, at: number): string {
    return QUANTIFIER.exec(pattern.slice(at))?.[0] ?? '';
  }

  /**
   * `\d{4}` reads as "4 × digits 0-9": the quantifier becomes a prefix and the
   * atom drops to its short form, because `the text "-"` does not survive being
   * put after "4 ×".
   */
  private compose(noun: string, phrase: string, quantifier: string): string {
    if (!quantifier) return phrase;
    const lazy = quantifier.length > 1 && quantifier.endsWith('?');
    const core = lazy ? quantifier.slice(0, -1) : quantifier;
    return `${this.quantifierPrefix(core)} ${noun}${lazy ? ' (lazy)' : ''}`;
  }

  private quantifierPrefix(core: string): string {
    switch (core) {
      case '?':
        return 'optional';
      case '*':
        return 'any number of';
      case '+':
        return '1 or more';
      default: {
        const range = /^\{(\d+)(?:,(\d*))?\}$/.exec(core);
        if (!range) return core;
        const [, min, max] = range;
        if (max === undefined) return `${min} ×`;
        if (max === '') return `${min} or more`;
        return `${min} to ${max} ×`;
      }
    }
  }

  /** Standalone reading of a quantifier, for group boxes. */
  private quantifierPhrase(quantifier: string): string {
    if (!quantifier) return '';
    const lazy = quantifier.length > 1 && quantifier.endsWith('?');
    const core = lazy ? quantifier.slice(0, -1) : quantifier;
    return `${this.quantifierPrefix(core)}${lazy ? ' (lazy)' : ''}`;
  }

  private describeClass(body: string, negated: boolean): string {
    const items: string[] = [];
    let singles = '';

    const flushSingles = (): void => {
      if (!singles) return;
      items.push(`"${singles}"`);
      singles = '';
    };

    let i = 0;
    while (i < body.length) {
      if (body[i] === '\\') {
        const escaped = body[i + 1] ?? '';
        const known = ESCAPE_LABELS[escaped];
        if (known) {
          flushSingles();
          items.push(known);
        } else {
          singles += escaped;
        }
        i += 2;
        continue;
      }
      if (body[i + 1] === '-' && i + 2 < body.length) {
        flushSingles();
        items.push(`${body[i]}-${body[i + 2]}`);
        i += 3;
        continue;
      }
      singles += body[i];
      i += 1;
    }
    flushSingles();

    if (items.length === 0) return negated ? 'any character' : 'nothing';
    const list = items.length > 4 ? `${items.slice(0, 4).join(', ')}, …` : items.join(', ');
    return negated ? `anything except ${list}` : `any of ${list}`;
  }

  // --------------------------------------------------------------- mapping

  /**
   * Finds the characters in the test text that a single part matched.
   *
   * The pattern is re-run with that part wrapped in a throwaway named group and
   * the group's indices are read back - there is no second matching engine, so
   * what the chain points at is by construction what the preview engine saw.
   *
   * Anything that could make the answer wrong bails out to an empty result:
   * showing nothing beats pointing at the wrong characters.
   */
  async mapPart(
    pattern: string,
    part: RegexPart,
    testInput: string,
    options: RegexOptionsModel
  ): Promise<RegexRange[]> {
    if (!pattern || !testInput) return [];
    if (part.kind === 'anchor' || part.kind === 'alternation' || part.kind === 'unknown') return [];
    // Zero-width assertions consume nothing, so there is nothing to point at.
    if (part.group?.lookaround || part.insideLookaround) return [];
    // Inserting a group renumbers every later one, which silently rewrites a
    // pattern that refers back to them.
    if (/\\[1-9]/.test(pattern)) return [];
    if (pattern.includes(PROBE_GROUP)) return [];

    const probe =
      pattern.slice(0, part.start) + `(?<${PROBE_GROUP}>${part.source})` + pattern.slice(part.end);

    const { matches, error } = await this.regexService.evaluate(probe, testInput, options);
    if (error) return [];

    const ranges: RegexRange[] = [];
    for (const match of matches) {
      const probed = match.groups.find(group => group.name === PROBE_GROUP);
      if (!probed || probed.index < 0 || probed.value === '') continue;
      ranges.push({ index: probed.index, length: probed.value.length });
    }
    return ranges;
  }

  // ----------------------------------------------------------------- edits

  /**
   * Every edit returns a new pattern string rather than mutating a tree: the
   * chain is re-derived from the pattern either way, so building visually and
   * typing into the field are literally the same code path.
   */
  setQuantifier(pattern: string, part: RegexPart, quantifier: string): string {
    const atom = pattern.slice(part.start, part.atomEnd);
    // A multi-character literal run would hand the quantifier to its last
    // character only, so it has to be bracketed first.
    const needsGrouping = quantifier !== '' && part.kind === 'literal' && atom.length > 1;
    const body = needsGrouping ? `(?:${atom})` : atom;
    return pattern.slice(0, part.start) + body + quantifier + pattern.slice(part.end);
  }

  wrapInGroup(pattern: string, part: RegexPart, name: string): string {
    const safe = this.uniqueGroupName(pattern, name);
    return (
      pattern.slice(0, part.start) +
      `(?<${safe}>${pattern.slice(part.start, part.end)})` +
      pattern.slice(part.end)
    );
  }

  removePart(pattern: string, part: RegexPart): string {
    return pattern.slice(0, part.start) + pattern.slice(part.end);
  }

  appendPart(pattern: string, item: RegexPaletteItem): string {
    return item.prepend ? item.snippet + pattern : pattern + item.snippet;
  }

  private uniqueGroupName(pattern: string, name: string): string {
    let cleaned = (name || '').trim().replace(/[^A-Za-z0-9_]/g, '');
    if (!cleaned || /^[0-9]/.test(cleaned)) cleaned = `group${cleaned}`;

    if (!pattern.includes(`(?<${cleaned}>`)) return cleaned;
    let suffix = 2;
    while (pattern.includes(`(?<${cleaned}${suffix}>`)) suffix += 1;
    return `${cleaned}${suffix}`;
  }

  // ------------------------------------------------------------------ tips

  /**
   * Up to seven suggestions in a fixed priority order; the panel shows the
   * first two and folds the rest. The ordering is the whole point - the two on
   * screen have to be the two worth reading.
   */
  buildTips(
    pattern: string,
    parts: RegexPart[],
    evaluation: RegexEvaluation,
    hasTestInput: boolean
  ): RegexTip[] {
    const tips: RegexTip[] = [];
    if (!pattern) return tips;

    if (evaluation.error) {
      tips.push({ kind: 'error', text: `Pattern error: ${evaluation.error}` });
    }

    if (evaluation.engineWarning) {
      // Reused verbatim: it already names exactly which options are set.
      tips.push({ kind: 'warning', text: evaluation.engineWarning });
    }

    if (evaluation.truncated) {
      tips.push({
        kind: 'warning',
        text: `Only the first ${evaluation.matches.length} matches are shown. The pattern matches at too many positions to list them all.`,
      });
    }

    const flat = this.flatten(parts);

    if (flat.some(part => part.kind === 'dot' && !part.quantifier) &&
        flat.some(part => part.kind === 'literal')) {
      tips.push({
        kind: 'info',
        text: 'A bare . matches any character. Write \\. if you meant a literal dot.',
      });
    }

    const greedy = flat.find(
      part => part.kind === 'dot' && (part.quantifier === '*' || part.quantifier === '+')
    );
    if (greedy) {
      tips.push({
        kind: 'info',
        text: `.${greedy.quantifier} is greedy and runs to the end of the line. Use .${greedy.quantifier}? to stop at the first match.`,
      });
    }

    if (!evaluation.error && hasTestInput && evaluation.matches.length === 0) {
      tips.push({ kind: 'info', text: 'No matches in the test text yet.' });
    }

    if (!flat.some(part => part.kind === 'anchor' && (part.source === '^' || part.source === '$'))) {
      tips.push({
        kind: 'info',
        text: 'No ^ or $ anchors, so this matches anywhere inside the text. Add them to require the whole line to match.',
      });
    }

    const unnamed = flat.find(part => part.group?.capturing && !part.group.name);
    if (unnamed?.group) {
      tips.push({
        kind: 'info',
        text: `Group ${unnamed.group.number} is unnamed. Wrap it as (?<name>…) and the generated C# can read it by name.`,
      });
    }

    return tips;
  }
}
