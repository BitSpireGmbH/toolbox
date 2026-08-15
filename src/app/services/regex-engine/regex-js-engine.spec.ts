import { describe, it, expect, beforeEach } from 'vitest';
import { NO_REGEX_OPTIONS } from './regex-engine';
import { RegexJsEngine } from './regex-js-engine';

/**
 * The fallback engine, exercised directly. These assertions describe what the
 * browser's own `RegExp` does - which is deliberately *not* the same as .NET. The
 * .NET behaviour is pinned by the xUnit suite under `dotnet/Toolbox.Wasm.Tests`,
 * because it needs a runtime that jsdom cannot provide.
 */
describe('RegexJsEngine', () => {
  let engine: RegexJsEngine;

  beforeEach(() => {
    engine = new RegexJsEngine();
  });

  describe('evaluate', () => {
    it('returns no matches for an empty pattern', async () => {
      const result = await engine.evaluate('', 'anything', NO_REGEX_OPTIONS);
      expect(result.matches).toEqual([]);
      expect(result.error).toBeUndefined();
    });

    it('finds matches and named groups for a date pattern', async () => {
      const result = await engine.evaluate(
        String.raw`(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})`,
        'Shipped on 2024-03-15 and again on 2024-04-02.',
        NO_REGEX_OPTIONS
      );

      expect(result.error).toBeUndefined();
      expect(result.matches).toHaveLength(2);

      const [first] = result.matches;
      expect(first.value).toBe('2024-03-15');
      expect(first.index).toBe(11);
      expect(first.length).toBe(10);

      const year = first.groups.find(g => g.name === 'year');
      const month = first.groups.find(g => g.name === 'month');
      const day = first.groups.find(g => g.name === 'day');
      expect(year?.value).toBe('2024');
      expect(month?.value).toBe('03');
      expect(day?.value).toBe('15');
    });

    it('returns numbered groups when the pattern has no named groups', async () => {
      const result = await engine.evaluate(String.raw`(\d+)-(\d+)`, '42-7', NO_REGEX_OPTIONS);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].groups.map(g => g.name)).toEqual(['1', '2']);
      expect(result.matches[0].groups.map(g => g.value)).toEqual(['42', '7']);
    });

    it('reports an error for an invalid pattern instead of throwing', async () => {
      const result = await engine.evaluate('(unclosed', 'text', NO_REGEX_OPTIONS);
      expect(result.matches).toEqual([]);
      expect(result.error).toBeTruthy();
    });

    it('is case sensitive by default and matches when IgnoreCase is enabled', async () => {
      const withoutIgnoreCase = await engine.evaluate('abc', 'ABC', NO_REGEX_OPTIONS);
      expect(withoutIgnoreCase.matches).toHaveLength(0);

      const withIgnoreCase = await engine.evaluate('abc', 'ABC', {
        ...NO_REGEX_OPTIONS,
        ignoreCase: true,
      });
      expect(withIgnoreCase.matches).toHaveLength(1);
    });

    it('always admits that it is an approximation', async () => {
      const result = await engine.evaluate('abc', 'abc', NO_REGEX_OPTIONS);
      expect(result.engineWarning).toContain('approximation');
    });

    it('names the specific options it cannot honour', async () => {
      const result = await engine.evaluate('abc', 'abc', {
        ...NO_REGEX_OPTIONS,
        rightToLeft: true,
      });
      expect(result.engineWarning).toContain('RightToLeft');
    });
  });

  describe('replacePreview', () => {
    it('replaces matches using the given replacement', async () => {
      const result = await engine.replacePreview(
        String.raw`\d+`,
        'room 12 and 34',
        'N',
        NO_REGEX_OPTIONS
      );
      expect(result.result).toBe('room N and N');
      expect(result.error).toBeUndefined();
    });

    it('returns the original text unchanged for an invalid pattern', async () => {
      const result = await engine.replacePreview(
        '(unclosed',
        'text',
        'X',
        NO_REGEX_OPTIONS
      );
      expect(result.result).toBe('text');
      expect(result.error).toBeTruthy();
    });
  });
});
