import { describe, it, expect, beforeEach } from 'vitest';
import { RegexTesterService, RegexOptionsModel } from './regex-tester.service';

describe('RegexTesterService', () => {
  let service: RegexTesterService;

  const noOptions: RegexOptionsModel = {
    ignoreCase: false,
    multiline: false,
    singleline: false,
    ignorePatternWhitespace: false,
    explicitCapture: false,
    cultureInvariant: false,
    rightToLeft: false,
  };

  beforeEach(() => {
    service = new RegexTesterService();
  });

  describe('evaluate', () => {
    it('returns no matches for an empty pattern', () => {
      const result = service.evaluate('', 'anything', noOptions);
      expect(result.matches).toEqual([]);
      expect(result.error).toBeUndefined();
    });

    it('finds matches and named groups for a date pattern', () => {
      const result = service.evaluate(
        String.raw`(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})`,
        'Shipped on 2024-03-15 and again on 2024-04-02.',
        noOptions
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

    it('returns numbered groups when the pattern has no named groups', () => {
      const result = service.evaluate(String.raw`(\d+)-(\d+)`, '42-7', noOptions);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].groups.map(g => g.name)).toEqual(['1', '2']);
      expect(result.matches[0].groups.map(g => g.value)).toEqual(['42', '7']);
    });

    it('reports an error for an invalid pattern instead of throwing', () => {
      const result = service.evaluate('(unclosed', 'text', noOptions);
      expect(result.matches).toEqual([]);
      expect(result.error).toBeTruthy();
    });

    it('is case sensitive by default and matches when IgnoreCase is enabled', () => {
      const withoutIgnoreCase = service.evaluate('abc', 'ABC', noOptions);
      expect(withoutIgnoreCase.matches).toHaveLength(0);

      const withIgnoreCase = service.evaluate('abc', 'ABC', { ...noOptions, ignoreCase: true });
      expect(withIgnoreCase.matches).toHaveLength(1);
    });

    it('sets an engine warning when a .NET-only option is enabled', () => {
      const result = service.evaluate('abc', 'abc', { ...noOptions, rightToLeft: true });
      expect(result.engineWarning).toContain('RightToLeft');
    });

    it('does not set an engine warning when only JS-representable options are enabled', () => {
      const result = service.evaluate('abc', 'abc', { ...noOptions, ignoreCase: true, multiline: true });
      expect(result.engineWarning).toBeUndefined();
    });
  });

  describe('replacePreview', () => {
    it('replaces matches using the given replacement', () => {
      const result = service.replacePreview(String.raw`\d+`, 'room 12 and 34', 'N', noOptions);
      expect(result.result).toBe('room N and N');
      expect(result.error).toBeUndefined();
    });

    it('returns the original text unchanged for an invalid pattern', () => {
      const result = service.replacePreview('(unclosed', 'text', 'X', noOptions);
      expect(result.result).toBe('text');
      expect(result.error).toBeTruthy();
    });
  });

  describe('generateCode', () => {
    it('generates a source-generated partial class and partial method by default', () => {
      const code = service.generateCode(String.raw`\d+`, noOptions, 'source-generated', 'RegexPatterns', 'MyRegex');
      expect(code).toContain('public partial class RegexPatterns');
      expect(code).toContain('[GeneratedRegex(@"\\d+")]');
      expect(code).toContain('public static partial Regex MyRegex();');
      expect(code).not.toContain('new Regex(');
    });

    it('generates classic new Regex code when requested', () => {
      const code = service.generateCode(String.raw`\d+`, noOptions, 'classic', 'RegexPatterns', 'MyRegex');
      expect(code).toContain('new Regex(@"\\d+")');
      expect(code).not.toContain('partial');
    });

    it('omits the options argument when no options are enabled', () => {
      const code = service.generateCode('abc', noOptions, 'classic', 'C', 'M');
      expect(code).toContain('new Regex(@"abc")');
      expect(code).not.toContain('RegexOptions');
    });

    it('combines multiple enabled options with the bitwise-or operator', () => {
      const code = service.generateCode('abc', { ...noOptions, ignoreCase: true, multiline: true }, 'classic', 'C', 'M');
      expect(code).toContain('RegexOptions.IgnoreCase | RegexOptions.Multiline');
    });

    it('escapes double quotes in the pattern for the verbatim string literal', () => {
      const code = service.generateCode('say "hi"', noOptions, 'classic', 'C', 'M');
      expect(code).toContain('@"say ""hi"""');
    });

    it('falls back to a default method name when it collides with the class name', () => {
      const code = service.generateCode('abc', noOptions, 'source-generated', 'Foo', 'Foo');
      expect(code).toContain('public partial class Foo');
      expect(code).toContain('public static partial Regex FooRegex();');
    });

    it('sanitizes invalid C# identifiers for class and method names', () => {
      const code = service.generateCode('abc', noOptions, 'source-generated', '123 My Class!', '9method name');
      expect(code).toContain('public partial class _123MyClass');
      expect(code).toContain('public static partial Regex _9methodname();');
    });
  });
});
