import { describe, expect, it } from 'vitest';
import { QueryInspectorService } from './query-inspector.service';

describe('QueryInspectorService', () => {
  const service = new QueryInspectorService();

  it('splits a full URL into its parts and decoded params', () => {
    const parsed = service.parse('https://user:pw@api.example.com:8443/v1/items?name=John%20Doe&tag=a+b#top');

    expect(parsed.url).toEqual({
      scheme: 'https',
      username: 'user',
      password: 'pw',
      host: 'api.example.com',
      port: '8443',
      path: '/v1/items',
      fragment: 'top',
    });
    expect(parsed.params.map(p => [p.key, p.value])).toEqual([
      ['name', 'John Doe'],
      ['tag', 'a b'],
    ]);
  });

  it('accepts a bare query string with or without a leading question mark', () => {
    for (const input of ['a=1&b=2', '?a=1&b=2']) {
      const parsed = service.parse(input);
      expect(parsed.url).toBeNull();
      expect(parsed.params.map(p => p.key)).toEqual(['a', 'b']);
      expect(service.build(parsed)).toBe(input);
    }
  });

  it('keeps a relative path as the prefix', () => {
    const parsed = service.parse('/api/users?page=2');
    expect(parsed.prefix).toBe('/api/users');
    expect(service.build(parsed)).toBe('/api/users?page=2');
  });

  it('round-trips untouched params byte for byte, including duplicates and flags', () => {
    const input = 'https://x.io/?q=%20a+b&q=2&flag&empty=#frag';
    expect(service.build(service.parse(input))).toBe(input);
  });

  it('drops the question mark once every param is removed', () => {
    const parsed = service.parse('https://x.io/p?a=1#h');
    expect(service.build({ ...parsed, params: [] })).toBe('https://x.io/p#h');
  });

  it('detects JSON objects and arrays but not scalars', () => {
    const parsed = service.parse(
      `?filter=${encodeURIComponent('{"age":{"gt":18}}')}&ids=[1,2]&n=42&bad={oops`
    );
    expect(parsed.params.map(p => p.json)).toEqual([{ age: { gt: 18 } }, [1, 2], undefined, undefined]);
    expect(parsed.params.map(p => p.jsonError === null)).toEqual([true, true, true, false]);
  });

  it('re-encodes an edited value minified, without touching the raw key', () => {
    const parsed = service.parse('?my%20key=1&b=2');
    const edited = service.withValue(parsed.params[0], '{\n  "a": "x&y"\n}');

    expect(edited.key).toBe('my key');
    expect(edited.json).toEqual({ a: 'x&y' });
    expect(service.build({ ...parsed, params: [edited, parsed.params[1]] })).toBe(
      `?my%20key=${encodeURIComponent('{"a":"x&y"}')}&b=2`
    );
  });

  it('segments concatenate back to the exact input, so the highlight overlay lines up', () => {
    for (const input of [
      '  https://u:p@[::1]:8080/a/b?x=1&&flag&y=%7B%7D#frag \n',
      'a=1&b=2',
      '?a=1',
      '/rel?x=',
      'https://x.io/?',
      'not a url',
      '   ',
    ]) {
      expect(service.segments(input).map(s => s.text).join('')).toBe(input);
    }
  });

  it('labels each part of the URL', () => {
    const kinds = service.segments('https://u@h.io:81/p?k=v#f').map(s => `${s.kind}:${s.text}`);
    expect(kinds).toEqual([
      'scheme:https', 'separator:://', 'auth:u', 'separator:@', 'host:h.io', 'separator::', 'port:81',
      'path:/p', 'separator:?', 'key:k', 'separator:=', 'value:v', 'separator:#', 'fragment:f',
    ]);
  });

  it('falls back to the raw text when percent-encoding is malformed', () => {
    expect(service.parse('?x=%E0%A4%A').params[0].value).toBe('%E0%A4%A');
  });
});
