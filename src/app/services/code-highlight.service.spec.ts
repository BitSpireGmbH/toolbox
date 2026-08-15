import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { CodeHighlightService, HighlightLanguage } from './code-highlight.service';
import { RESPONSE_CATALOG } from '../response-guide/response-catalog.const';

/**
 * The failure mode these guard against is silent: if the sanitizer bypass or
 * a Prism grammar registration breaks, snippets still render - just as
 * unstyled plain text - so nothing throws and no other test notices.
 */
describe('CodeHighlightService', () => {
  let service: CodeHighlightService;
  let sanitizer: DomSanitizer;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CodeHighlightService);
    sanitizer = TestBed.inject(DomSanitizer);
  });

  const html = (code: string, language?: HighlightLanguage): string =>
    sanitizer.sanitize(1 /* SecurityContext.HTML */, service.highlight(code, language)) ?? '';

  it('emits Prism token markup rather than plain text', () => {
    const result = html('public async Task<IActionResult> Get() => Ok();');

    expect(result).toContain('class="token');
    expect(result).toContain('keyword');
  });

  it('tokenises the C# constructs the tools actually emit', () => {
    const result = html(`[HttpGet("{id:int}")]
public async Task<ActionResult<ProductDto>> GetById(int id)
{
    // a comment
    return Ok(product.ToDto());
}`);

    expect(result).toContain('token comment');
    expect(result).toContain('token keyword');
    expect(result).toContain('token string');
  });

  it('highlights TypeScript too, for the bidirectional converter', () => {
    const result = html('export interface Product { id: number; name: string; }', 'typescript');

    expect(result).toContain('class="token');
    expect(result).toContain('keyword');
  });

  /*
   * The markup grammar rides along in Prism's core, so nothing imports it -
   * which makes it exactly the kind of thing a dependency bump could drop
   * without any import failing.
   */
  it('tokenises the csproj markup the Package Centralizer emits', () => {
    const result = html(
      '<PackageVersion Include="Serilog" Version="3.1.1" />',
      'markup'
    );

    expect(result).toContain('token tag');
    expect(result).toContain('token attr-name');
    expect(result).toContain('token attr-value');
  });

  it('distinguishes JSON keys from their values', () => {
    const result = html('{ "name": "John", "age": 30 }', 'json');

    expect(result).toContain('token property');
    expect(result).toContain('token string');
    expect(result).toContain('token number');
  });

  it('escapes angle brackets so generics cannot inject markup', () => {
    const result = html('Results<Ok<ProductDto>, NotFound>');

    expect(result).toContain('&lt;');
    expect(result).not.toContain('<Ok>');
  });

  it('returns a cached instance for a repeated snippet', () => {
    const code = 'return TypedResults.NoContent();';

    expect(service.highlight(code)).toBe(service.highlight(code));
  });

  it('does not confuse the same source in two languages', () => {
    const code = 'const x = 1;';

    expect(service.highlight(code, 'csharp')).not.toBe(service.highlight(code, 'typescript'));
  });

  it('highlights every snippet in the response catalog without throwing', () => {
    for (const entry of RESPONSE_CATALOG) {
      if (entry.kind !== 'scenario') {
        continue;
      }

      expect(html(entry.snippets.controller), entry.id).toContain('class="token');
      expect(html(entry.snippets.minimalApi), entry.id).toContain('class="token');

      if (entry.snippets.avoidNote) {
        expect(html(entry.snippets.avoidNote), entry.id).toContain('class="token');
      }
    }
  });
});
