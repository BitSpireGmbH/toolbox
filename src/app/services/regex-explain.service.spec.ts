import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { RegexExplainService, RegexPart } from './regex-explain.service';
import { DotnetRuntimeService } from './dotnet-runtime.service';
import { NO_REGEX_OPTIONS, RegexEvaluation } from './regex-tester.service';

const noOptions = NO_REGEX_OPTIONS;

const ISO_DATE = String.raw`(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})`;
const SAMPLE = 'Order #1024 shipped on 2024-03-15.\nFollow-up scheduled for 2024-04-02.';

const emptyEvaluation: RegexEvaluation = { matches: [] };

describe('RegexExplainService', () => {
  let service: RegexExplainService;

  beforeEach(() => {
    // inject() in the field initialiser needs a real injector, so no `new`.
    // The rejecting stub keeps mapPart on the JavaScript engine: jsdom has no
    // WebAssembly runtime, and these assertions describe browser-engine behaviour.
    TestBed.configureTestingModule({
      providers: [
        {
          provide: DotnetRuntimeService,
          useValue: {
            status: () => 'failed',
            frameworkDescription: () => null,
            load: () => Promise.reject(new Error('no runtime in jsdom')),
          },
        },
      ],
    });
    service = TestBed.inject(RegexExplainService);
  });

  /** Every part must slice back out of the pattern it came from. */
  const expectOffsetsRoundTrip = (pattern: string, parts: RegexPart[]): void => {
    for (const part of service.flatten(parts)) {
      expect(pattern.slice(part.start, part.end)).toBe(part.source);
      expect(part.atomEnd + part.quantifier.length).toBe(part.end);
    }
  };

  describe('parse', () => {
    it('reads \\d{4} as "4 × digits 0-9"', () => {
      const { parts } = service.parse(String.raw`\d{4}`);

      expect(parts).toHaveLength(1);
      expect(parts[0].kind).toBe('escape');
      expect(parts[0].quantifier).toBe('{4}');
      expect(parts[0].label).toBe('4 × digits 0-9');
    });

    it('labels an unquantified atom with its standalone phrase', () => {
      const { parts } = service.parse(String.raw`\d`);

      expect(parts[0].label).toBe('digits 0-9');
    });

    it('coalesces consecutive literal characters into one part', () => {
      const { parts } = service.parse('abc');

      expect(parts).toHaveLength(1);
      expect(parts[0].kind).toBe('literal');
      expect(parts[0].source).toBe('abc');
      expect(parts[0].label).toBe('the text "abc"');
    });

    it('splits a quantified literal off the run so the quantifier binds correctly', () => {
      const { parts } = service.parse('abc+');

      expect(parts.map(p => p.source)).toEqual(['ab', 'c+']);
      expect(parts[1].label).toBe('1 or more "c"');
    });

    it('parses the ISO date pattern into groups and separators', () => {
      const { parts } = service.parse(ISO_DATE);

      expect(parts.map(p => p.kind)).toEqual(['group', 'literal', 'group', 'literal', 'group']);
      expect(parts[0].group?.heading).toBe('CAPTURE - NAMED "YEAR"');
      expect(parts[0].group?.number).toBe(1);
      expect(parts[1].label).toBe('the text "-"');
      expect(parts[4].group?.name).toBe('day');
      expect(parts[4].group?.number).toBe(3);
      expectOffsetsRoundTrip(ISO_DATE, parts);
    });

    it('nests a group\'s contents as children', () => {
      const { parts } = service.parse(ISO_DATE);

      expect(parts[0].children).toHaveLength(1);
      expect(parts[0].children?.[0].source).toBe(String.raw`\d{4}`);
    });

    it('numbers unnamed capture groups in source order', () => {
      const { parts } = service.parse('(a)(b)');

      expect(parts[0].group?.heading).toBe('CAPTURE - GROUP 1');
      expect(parts[1].group?.heading).toBe('CAPTURE - GROUP 2');
    });

    it('counts named groups towards the numbering, as the engine does', () => {
      const { parts } = service.parse('(?<first>a)(b)');

      expect(parts[0].group?.number).toBe(1);
      expect(parts[1].group?.number).toBe(2);
    });

    it('recognises the non-capturing and lookaround forms', () => {
      const { parts } = service.parse('(?:a)(?=b)(?!c)(?<=d)(?<!e)');

      expect(parts.map(p => p.group?.heading)).toEqual([
        'GROUP',
        'FOLLOWED BY',
        'NOT FOLLOWED BY',
        'PRECEDED BY',
        'NOT PRECEDED BY',
      ]);
      expect(parts.filter(p => p.group?.lookaround)).toHaveLength(4);
    });

    it('marks everything nested in a lookaround', () => {
      const { parts } = service.parse(String.raw`(?=\d)`);

      expect(parts[0].children?.[0].insideLookaround).toBe(true);
    });

    it('describes character classes, including negation and ranges', () => {
      expect(service.parse('[a-z0-9_]').parts[0].label).toBe('any of a-z, 0-9, "_"');
      expect(service.parse('[^abc]').parts[0].label).toBe('anything except "abc"');
      expect(service.parse(String.raw`[\d.]`).parts[0].label).toBe('any of digits 0-9, "."');
    });

    it('reads anchors, the dot and word boundaries', () => {
      const { parts } = service.parse(String.raw`^.\b$`);

      expect(parts.map(p => p.label)).toEqual([
        'start of line',
        'any char',
        'word boundary',
        'end of line',
      ]);
    });

    it('reads every quantifier shape', () => {
      expect(service.parse(String.raw`\d?`).parts[0].label).toBe('optional digits 0-9');
      expect(service.parse(String.raw`\d*`).parts[0].label).toBe('any number of digits 0-9');
      expect(service.parse(String.raw`\d+`).parts[0].label).toBe('1 or more digits 0-9');
      expect(service.parse(String.raw`\d{2,}`).parts[0].label).toBe('2 or more digits 0-9');
      expect(service.parse(String.raw`\d{2,5}`).parts[0].label).toBe('2 to 5 × digits 0-9');
    });

    it('marks lazy quantifiers', () => {
      const { parts } = service.parse('.+?');

      expect(parts[0].quantifier).toBe('+?');
      expect(parts[0].label).toBe('1 or more any char (lazy)');
    });

    it('treats an escaped metacharacter as a literal character', () => {
      const { parts } = service.parse(String.raw`\.`);

      expect(parts[0].kind).toBe('escape');
      expect(parts[0].label).toBe('the character "."');
    });

    it('keeps multi-character escapes whole so a quantifier cannot split them', () => {
      const { parts } = service.parse('\\u0041+');

      expect(parts).toHaveLength(1);
      expect(parts[0].atomEnd - parts[0].start).toBe(6);
      expect(parts[0].quantifier).toBe('+');
    });

    it('reads backreferences', () => {
      expect(service.parse(String.raw`(a)\1`).parts[1].label).toBe('same text as group 1');
      expect(service.parse(String.raw`(?<a>x)\k<a>`).parts[1].label).toBe('same text as group "a"');
    });

    it('renders alternation as a separator', () => {
      const { parts } = service.parse('a|b');

      expect(parts.map(p => p.kind)).toEqual(['literal', 'alternation', 'literal']);
      expect(parts[1].label).toBe('or');
    });

    it('stays usable on a half-typed group', () => {
      const pattern = String.raw`(?<year>\d{`;
      const { parts } = service.parse(pattern);

      expect(parts.length).toBeGreaterThan(0);
      expectOffsetsRoundTrip(pattern, parts);
    });

    it('stays usable on an unclosed character class', () => {
      const { parts } = service.parse('[a-');

      expect(parts[0].kind).toBe('unknown');
      expect(parts[0].source).toBe('[a-');
    });

    it('stays usable on a trailing backslash', () => {
      const { parts } = service.parse('a\\');

      expect(parts[1].kind).toBe('unknown');
    });

    it('keeps a stray closing paren visible', () => {
      const { parts } = service.parse('a)');

      expect(parts[1].kind).toBe('unknown');
      expect(parts[1].source).toBe(')');
    });

    it('treats a brace that is not a quantifier as literal text', () => {
      const { parts } = service.parse('{a}');

      expect(parts).toHaveLength(1);
      expect(parts[0].kind).toBe('literal');
    });

    it('returns nothing for an empty pattern', () => {
      expect(service.parse('').parts).toEqual([]);
    });
  });

  describe('mapPart', () => {
    it('maps a part to the exact characters it matched', async () => {
      const { parts } = service.parse(ISO_DATE);
      const year = parts[0].children?.[0] as RegexPart;

      const ranges = await service.mapPart(ISO_DATE, year, SAMPLE, noOptions);

      expect(ranges).toHaveLength(2);
      expect(SAMPLE.substr(ranges[0].index, ranges[0].length)).toBe('2024');
      expect(SAMPLE.substr(ranges[1].index, ranges[1].length)).toBe('2024');
    });

    it('maps a literal separator to each of its occurrences', async () => {
      const { parts } = service.parse(ISO_DATE);

      const ranges = await service.mapPart(ISO_DATE, parts[1], SAMPLE, noOptions);

      expect(ranges).toHaveLength(2);
      expect(SAMPLE.substr(ranges[0].index, ranges[0].length)).toBe('-');
    });

    it('maps a whole group', async () => {
      const { parts } = service.parse(ISO_DATE);

      const ranges = await service.mapPart(ISO_DATE, parts[0], SAMPLE, noOptions);

      expect(SAMPLE.substr(ranges[0].index, ranges[0].length)).toBe('2024');
    });

    it('bails out when the pattern has a numeric backreference', async () => {
      const pattern = String.raw`(\w)\1`;
      const { parts } = service.parse(pattern);

      expect(await service.mapPart(pattern, parts[0], 'aabb', noOptions)).toEqual([]);
    });

    it('bails out for a part inside a lookaround', async () => {
      const pattern = String.raw`(?=\d)\d`;
      const { parts } = service.parse(pattern);
      const inside = parts[0].children?.[0] as RegexPart;

      expect(await service.mapPart(pattern, inside, '42', noOptions)).toEqual([]);
    });

    it('bails out for anchors, which consume nothing', async () => {
      const { parts } = service.parse('^a');

      expect(await service.mapPart('^a', parts[0], 'abc', noOptions)).toEqual([]);
    });

    it('bails out when the pattern already uses the probe name', async () => {
      const pattern = '(?<tbxProbe>a)';
      const { parts } = service.parse(pattern);

      expect(await service.mapPart(pattern, parts[0], 'aaa', noOptions)).toEqual([]);
    });

    it('returns nothing rather than throwing when there is no test text', async () => {
      const { parts } = service.parse(ISO_DATE);

      expect(await service.mapPart(ISO_DATE, parts[0], '', noOptions)).toEqual([]);
    });

    it('honours the options the browser engine can apply', async () => {
      const { parts } = service.parse('A');

      expect(await service.mapPart('A', parts[0], 'a', noOptions)).toEqual([]);
      expect(await service.mapPart('A', parts[0], 'a', { ...noOptions, ignoreCase: true })).toHaveLength(1);
    });
  });

  describe('setQuantifier', () => {
    it('adds a quantifier to a bare atom', () => {
      const { parts } = service.parse(String.raw`\d`);

      expect(service.setQuantifier(String.raw`\d`, parts[0], '+')).toBe(String.raw`\d+`);
    });

    it('replaces an existing quantifier instead of appending one', () => {
      const { parts } = service.parse(String.raw`\d{4}`);

      expect(service.setQuantifier(String.raw`\d{4}`, parts[0], '+')).toBe(String.raw`\d+`);
    });

    it('clears the quantifier when asked for "once"', () => {
      const { parts } = service.parse(String.raw`\d{4}`);

      expect(service.setQuantifier(String.raw`\d{4}`, parts[0], '')).toBe(String.raw`\d`);
    });

    it('brackets a multi-character literal so the quantifier covers all of it', () => {
      const { parts } = service.parse('abc');

      expect(service.setQuantifier('abc', parts[0], '+')).toBe('(?:abc)+');
    });

    it('leaves the rest of the pattern untouched', () => {
      const { parts } = service.parse(ISO_DATE);
      const month = parts[2].children?.[0] as RegexPart;

      expect(service.setQuantifier(ISO_DATE, month, '+')).toBe(
        String.raw`(?<year>\d{4})-(?<month>\d+)-(?<day>\d{2})`
      );
    });
  });

  describe('wrapInGroup', () => {
    it('wraps the part, quantifier included', () => {
      const { parts } = service.parse(String.raw`\d{4}`);

      expect(service.wrapInGroup(String.raw`\d{4}`, parts[0], 'year')).toBe(
        String.raw`(?<year>\d{4})`
      );
    });

    it('sanitises the name into a valid identifier', () => {
      const { parts } = service.parse(String.raw`\d`);

      expect(service.wrapInGroup(String.raw`\d`, parts[0], 'my group!')).toBe(
        String.raw`(?<mygroup>\d)`
      );
    });

    it('falls back when the name is empty or starts with a digit', () => {
      const { parts } = service.parse(String.raw`\d`);

      expect(service.wrapInGroup(String.raw`\d`, parts[0], '')).toBe(String.raw`(?<group>\d)`);
      expect(service.wrapInGroup(String.raw`\d`, parts[0], '1st')).toBe(String.raw`(?<group1st>\d)`);
    });

    it('uniquifies a name that is already taken', () => {
      const pattern = String.raw`(?<year>\d{4})-\d{2}`;
      const { parts } = service.parse(pattern);

      expect(service.wrapInGroup(pattern, parts[2], 'year')).toBe(
        String.raw`(?<year>\d{4})-(?<year2>\d{2})`
      );
    });
  });

  describe('removePart', () => {
    it('cuts the part out of the pattern', () => {
      const { parts } = service.parse(ISO_DATE);

      expect(service.removePart(ISO_DATE, parts[1])).toBe(
        String.raw`(?<year>\d{4})(?<month>\d{2})-(?<day>\d{2})`
      );
    });

    it('takes a group\'s contents with it', () => {
      const { parts } = service.parse(ISO_DATE);

      expect(service.removePart(ISO_DATE, parts[0])).toBe(
        String.raw`-(?<month>\d{2})-(?<day>\d{2})`
      );
    });
  });

  describe('appendPart', () => {
    it('appends the snippet', () => {
      expect(service.appendPart(String.raw`\d`, { label: 'space', snippet: String.raw`\s` })).toBe(
        String.raw`\d\s`
      );
    });

    it('prepends the start anchor, where it is the only thing that makes sense', () => {
      expect(
        service.appendPart(String.raw`\d`, { label: 'start', snippet: '^', prepend: true })
      ).toBe(String.raw`^\d`);
    });
  });

  describe('findByStart', () => {
    it('re-anchors a selection after the offsets shifted', () => {
      const { parts } = service.parse(ISO_DATE);

      expect(service.findByStart(parts, parts[2].start)?.source).toBe(parts[2].source);
      expect(service.findByStart(parts, 999)).toBeNull();
      expect(service.findByStart(parts, null)).toBeNull();
    });

    it('reaches parts nested inside groups', () => {
      const { parts } = service.parse(ISO_DATE);
      const nested = parts[0].children?.[0] as RegexPart;

      expect(service.findByStart(parts, nested.start)?.source).toBe(String.raw`\d{4}`);
    });
  });

  describe('buildTips', () => {
    const tipsFor = (
      pattern: string,
      evaluation: RegexEvaluation = emptyEvaluation,
      hasTestInput = true
    ): string[] =>
      service
        .buildTips(pattern, service.parse(pattern).parts, evaluation, hasTestInput)
        .map(tip => tip.text);

    it('says nothing about an empty pattern', () => {
      expect(service.buildTips('', [], emptyEvaluation, true)).toEqual([]);
    });

    it('leads with the pattern error', () => {
      const tips = service.buildTips('(', service.parse('(').parts, {
        matches: [],
        error: 'Unterminated group',
      }, true);

      expect(tips[0]).toEqual({ kind: 'error', text: 'Pattern error: Unterminated group' });
    });

    it('passes the engine warning through verbatim, right after any error', () => {
      const tips = service.buildTips(String.raw`\d`, service.parse(String.raw`\d`).parts, {
        matches: [],
        engineWarning: 'no equivalent for: RightToLeft',
      }, true);

      expect(tips[0]).toEqual({ kind: 'warning', text: 'no equivalent for: RightToLeft' });
    });

    it('flags a bare dot sitting next to literal text', () => {
      expect(tipsFor('a.b')).toContain(
        'A bare . matches any character. Write \\. if you meant a literal dot.'
      );
    });

    it('flags a greedy .* and names the lazy form', () => {
      expect(tipsFor('a.*')).toContain(
        '.* is greedy and runs to the end of the line. Use .*? to stop at the first match.'
      );
    });

    it('does not flag a dot that is already lazy', () => {
      expect(tipsFor('a.*?').some(tip => tip.includes('greedy'))).toBe(false);
    });

    it('mentions zero matches only when there is text to match against', () => {
      expect(tipsFor(String.raw`\d`, { matches: [] }, true)).toContain(
        'No matches in the test text yet.'
      );
      expect(tipsFor(String.raw`\d`, { matches: [] }, false)).not.toContain(
        'No matches in the test text yet.'
      );
    });

    it('mentions missing anchors, and stops once one is present', () => {
      const anchorTip =
        'No ^ or $ anchors, so this matches anywhere inside the text. Add them to require the whole line to match.';

      expect(tipsFor(String.raw`\d`)).toContain(anchorTip);
      expect(tipsFor(String.raw`^\d`)).not.toContain(anchorTip);
    });

    it('suggests naming an unnamed capture group', () => {
      expect(tipsFor(String.raw`(\d)`)).toContain(
        'Group 1 is unnamed. Wrap it as (?<name>…) and the generated C# can read it by name.'
      );
      expect(tipsFor(String.raw`(?<n>\d)`).some(tip => tip.includes('is unnamed'))).toBe(false);
    });

    it('orders tips so the two most useful come first', () => {
      const tips = service.buildTips(
        'a.*',
        service.parse('a.*').parts,
        { matches: [], error: 'boom', engineWarning: 'warned' },
        true
      );

      expect(tips.slice(0, 2).map(tip => tip.kind)).toEqual(['error', 'warning']);
    });
  });
});
