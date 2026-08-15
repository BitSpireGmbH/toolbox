import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DotnetRuntimeService, ToolboxWasmExports } from './dotnet-runtime.service';
import { NO_REGEX_OPTIONS, RegexTesterService } from './regex-tester.service';

const noOptions = NO_REGEX_OPTIONS;

/**
 * Stands in for the WebAssembly runtime, which jsdom cannot load. Returns the JSON
 * shape the real `[JSExport]` methods produce - the C# side of that contract is
 * pinned separately by `RegexJsonFacadeTests`.
 */
const fakeExports = (
  evaluate: () => unknown,
  replace: () => unknown = () => ({ result: '' })
): ToolboxWasmExports =>
  ({
    Toolbox: {
      Wasm: {
        RegexInterop: {
          Evaluate: () => JSON.stringify(evaluate()),
          Replace: () => JSON.stringify(replace()),
        },
        RuntimeInterop: {
          GetFrameworkDescription: () => '.NET 10.0.0',
        },
      },
    },
  }) as ToolboxWasmExports;

const configure = (runtime: Partial<DotnetRuntimeService>): RegexTesterService => {
  TestBed.configureTestingModule({
    providers: [{ provide: DotnetRuntimeService, useValue: runtime }],
  });
  return TestBed.inject(RegexTesterService);
};

describe('RegexTesterService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  describe('engine selection', () => {
    it('uses the .NET engine when the runtime loads', async () => {
      const service = configure({
        load: () => Promise.resolve(fakeExports(() => ({ matches: [{ value: 'from-dotnet', index: 0, length: 3, groups: [] }] }))),
      });

      const result = await service.evaluate('abc', 'abc', noOptions);

      expect(service.engineKind()).toBe('dotnet');
      expect(result.matches[0].value).toBe('from-dotnet');
    });

    it('falls back to the browser engine when the runtime fails to load', async () => {
      const service = configure({
        load: () => Promise.reject(new Error('offline')),
      });

      const result = await service.evaluate(String.raw`\d+`, 'room 12', noOptions);

      expect(service.engineKind()).toBe('javascript');
      expect(result.matches[0].value).toBe('12');
      // The fallback must never pretend to be authoritative.
      expect(result.engineWarning).toBeTruthy();
    });

    it('does not retry the download once it has fallen back', async () => {
      // Retrying a multi-megabyte fetch on every keystroke would be worse than
      // living with the approximation, so the fallback is sticky for the session.
      const load = vi.fn(() => Promise.reject(new Error('offline')));
      const service = configure({ load });

      await service.evaluate('a', 'a', noOptions);
      await service.evaluate('b', 'b', noOptions);
      await service.replacePreview('c', 'c', 'x', noOptions);

      expect(service.engineKind()).toBe('javascript');
      expect(load).toHaveBeenCalledTimes(1);
    });

    it('reports no engine until the first evaluation resolves', () => {
      const service = configure({ load: () => Promise.resolve(fakeExports(() => ({ matches: [] }))) });
      expect(service.engineKind()).toBeNull();
    });
  });

  describe('generateCode', () => {
    let service: RegexTesterService;

    beforeEach(() => {
      service = configure({ load: () => Promise.reject(new Error('not needed')) });
    });

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

    it('emits NonBacktracking, which the browser engine has no equivalent for', () => {
      const code = service.generateCode('abc', { ...noOptions, nonBacktracking: true }, 'classic', 'C', 'M');
      expect(code).toContain('RegexOptions.NonBacktracking');
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
