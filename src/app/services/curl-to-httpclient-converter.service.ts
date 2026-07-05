import { Injectable } from '@angular/core';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
export type ClientStyle = 'inline' | 'factory' | 'typed';
export type CurlSerializer = 'System.Text.Json' | 'Newtonsoft.Json';
export type CurlBodyKind = 'json' | 'urlencoded' | 'multipart' | 'text' | 'none';

export interface CurlToHttpClientOptions {
  clientStyle: ClientStyle;
  serializer: CurlSerializer;
  generateBodyRecord: boolean;
  wrapInAsyncMethod: boolean;
  typedClientName?: string;
  methodName?: string;
}

export interface CurlHeader {
  name: string;
  value: string;
}

export interface CurlFormField {
  name: string;
  value: string;
  isFile: boolean;
  filename?: string;
}

export interface CurlBody {
  kind: CurlBodyKind;
  raw?: string;
  formFields?: CurlFormField[];
}

export interface CurlParseResult {
  method: HttpMethod;
  url: string;
  baseAddress: string;
  path: string;
  headers: CurlHeader[];
  body?: CurlBody;
  basicAuth?: { user: string; pass: string };
}

@Injectable({
  providedIn: 'root',
})
export class CurlToHttpClientConverterService {
  convert(curl: string, options: CurlToHttpClientOptions): string {
    const parsed = this.parseCurl(curl);
    return this.generate(parsed, options);
  }

  parseCurl(curl: string): CurlParseResult {
    if (!curl || !curl.trim()) {
      throw new Error('Empty cURL command');
    }

    const tokens = this.tokenize(curl);
    if (tokens.length === 0) {
      throw new Error('No tokens parsed from cURL command');
    }

    let i = 0;
    if (tokens[0] === 'curl') {
      i = 1;
    }

    let method: HttpMethod | null = null;
    let url: string | null = null;
    const headers: CurlHeader[] = [];
    let body: CurlBody | undefined;
    let basicAuth: { user: string; pass: string } | undefined;
    const formFields: CurlFormField[] = [];
    const dataChunks: string[] = [];
    let dataKind: 'json' | 'urlencoded' | 'text' = 'urlencoded';

    while (i < tokens.length) {
      const token = tokens[i];

      if (token === '-X' || token === '--request') {
        const value = this.requireNext(tokens, i, token);
        method = this.normalizeMethod(value);
        i += 2;
        continue;
      }

      if (token === '-H' || token === '--header') {
        const value = this.requireNext(tokens, i, token);
        const header = this.parseHeader(value);
        if (header) headers.push(header);
        i += 2;
        continue;
      }

      if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary') {
        const value = this.requireNext(tokens, i, token);
        dataChunks.push(value);
        dataKind = this.looksLikeJson(value) ? 'json' : 'urlencoded';
        i += 2;
        continue;
      }

      if (token === '-F' || token === '--form') {
        const value = this.requireNext(tokens, i, token);
        formFields.push(this.parseFormField(value));
        i += 2;
        continue;
      }

      if (token === '-u' || token === '--user') {
        const value = this.requireNext(tokens, i, token);
        const idx = value.indexOf(':');
        if (idx === -1) {
          basicAuth = { user: value, pass: '' };
        } else {
          basicAuth = { user: value.slice(0, idx), pass: value.slice(idx + 1) };
        }
        i += 2;
        continue;
      }

      if (token === '--url') {
        const value = this.requireNext(tokens, i, token);
        url = value;
        i += 2;
        continue;
      }

      if (token === '-L' || token === '--location' || token === '-k' || token === '--insecure' || token === '--compressed' || token === '-s' || token === '--silent' || token === '-v' || token === '--verbose' || token === '-i' || token === '--include') {
        i += 1;
        continue;
      }

      if (token.startsWith('--') && token.includes('=')) {
        i += 1;
        continue;
      }

      if (token.startsWith('-') && token.length > 1) {
        i += 2;
        continue;
      }

      if (!url) {
        url = token;
      }
      i += 1;
    }

    if (!url) {
      throw new Error('No URL found in cURL command');
    }

    if (formFields.length > 0) {
      body = { kind: 'multipart', formFields };
    } else if (dataChunks.length > 0) {
      const raw = dataChunks.join('&');
      body = {
        kind: dataKind === 'json' ? 'json' : dataKind === 'urlencoded' ? 'urlencoded' : 'text',
        raw,
      };
    }

    if (method === null) {
      method = body ? 'POST' : 'GET';
    }

    const { baseAddress, path } = this.splitUrl(url);

    return { method, url, baseAddress, path, headers, body, basicAuth };
  }

  generate(parsed: CurlParseResult, options: CurlToHttpClientOptions): string {
    switch (options.clientStyle) {
      case 'inline':
        return this.generateInline(parsed, options);
      case 'factory':
        return this.generateFactory(parsed, options);
      case 'typed':
        return this.generateTyped(parsed, options);
    }
  }

  private generateInline(parsed: CurlParseResult, options: CurlToHttpClientOptions): string {
    const lines: string[] = [];
    lines.push(...this.usingDirectives(parsed, options));
    lines.push('');

    const bodyLines = this.buildBodyLines(parsed, options, '    ');
    const methodName = options.methodName || this.suggestMethodName(parsed);

    if (options.wrapInAsyncMethod) {
      lines.push(`public static async Task<string> ${methodName}Async(CancellationToken cancellationToken = default)`);
      lines.push('{');
      lines.push(`    using var client = new HttpClient { BaseAddress = new Uri("${parsed.baseAddress}") };`);
      lines.push('');
      lines.push(...this.requestBlock(parsed, options, '    ', bodyLines));
      lines.push('');
      lines.push(`    using var response = await client.SendAsync(request, cancellationToken);`);
      lines.push(`    response.EnsureSuccessStatusCode();`);
      lines.push(`    return await response.Content.ReadAsStringAsync(cancellationToken);`);
      lines.push('}');
    } else {
      lines.push(`using var client = new HttpClient { BaseAddress = new Uri("${parsed.baseAddress}") };`);
      lines.push('');
      lines.push(...this.requestBlock(parsed, options, '', this.buildBodyLines(parsed, options, '')));
      lines.push('');
      lines.push(`using var response = await client.SendAsync(request);`);
      lines.push(`response.EnsureSuccessStatusCode();`);
      lines.push(`var body = await response.Content.ReadAsStringAsync();`);
    }

    const bodyRecord = options.generateBodyRecord ? this.maybeBodyRecord(parsed, options) : '';
    return [bodyRecord, lines.join('\n')].filter(Boolean).join('\n\n');
  }

  private generateFactory(parsed: CurlParseResult, options: CurlToHttpClientOptions): string {
    const lines: string[] = [];
    lines.push(...this.usingDirectives(parsed, options));
    lines.push('');
    lines.push('// Add to Program.cs (DI registration):');
    lines.push('// builder.Services.AddHttpClient("api", c =>');
    lines.push('// {');
    lines.push(`//     c.BaseAddress = new Uri("${parsed.baseAddress}");`);
    lines.push('// });');
    lines.push('');

    const methodName = options.methodName || this.suggestMethodName(parsed);

    lines.push(`public static async Task<string> ${methodName}Async(IHttpClientFactory httpClientFactory, CancellationToken cancellationToken = default)`);
    lines.push('{');
    lines.push(`    var client = httpClientFactory.CreateClient("api");`);
    lines.push('');
    lines.push(...this.requestBlock(parsed, options, '    ', this.buildBodyLines(parsed, options, '    ')));
    lines.push('');
    lines.push(`    using var response = await client.SendAsync(request, cancellationToken);`);
    lines.push(`    response.EnsureSuccessStatusCode();`);
    lines.push(`    return await response.Content.ReadAsStringAsync(cancellationToken);`);
    lines.push('}');

    const bodyRecord = options.generateBodyRecord ? this.maybeBodyRecord(parsed, options) : '';
    return [bodyRecord, lines.join('\n')].filter(Boolean).join('\n\n');
  }

  private generateTyped(parsed: CurlParseResult, options: CurlToHttpClientOptions): string {
    const className = options.typedClientName || this.suggestClientName(parsed);
    const methodName = options.methodName || this.suggestMethodName(parsed);

    const lines: string[] = [];
    lines.push(...this.usingDirectives(parsed, options));
    lines.push('');
    lines.push('// Add to Program.cs (DI registration):');
    lines.push(`// builder.Services.AddHttpClient<${className}>(c =>`);
    lines.push('// {');
    lines.push(`//     c.BaseAddress = new Uri("${parsed.baseAddress}");`);
    lines.push('// });');
    lines.push('');
    lines.push(`public sealed class ${className}(HttpClient client)`);
    lines.push('{');
    lines.push(`    public async Task<string> ${methodName}Async(CancellationToken cancellationToken = default)`);
    lines.push('    {');
    lines.push(...this.requestBlock(parsed, options, '        ', this.buildBodyLines(parsed, options, '        ')));
    lines.push('');
    lines.push(`        using var response = await client.SendAsync(request, cancellationToken);`);
    lines.push(`        response.EnsureSuccessStatusCode();`);
    lines.push(`        return await response.Content.ReadAsStringAsync(cancellationToken);`);
    lines.push('    }');
    lines.push('}');

    const bodyRecord = options.generateBodyRecord ? this.maybeBodyRecord(parsed, options) : '';
    return [bodyRecord, lines.join('\n')].filter(Boolean).join('\n\n');
  }

  private usingDirectives(parsed: CurlParseResult, options: CurlToHttpClientOptions): string[] {
    const usings = new Set<string>();
    usings.add('using System;');
    usings.add('using System.Net.Http;');
    usings.add('using System.Net.Http.Headers;');
    usings.add('using System.Threading;');
    usings.add('using System.Threading.Tasks;');

    if (parsed.body?.kind === 'json') {
      if (options.serializer === 'System.Text.Json') {
        if (options.generateBodyRecord) {
          usings.add('using System.Net.Http.Json;');
        } else {
          usings.add('using System.Text;');
        }
      } else {
        usings.add('using Newtonsoft.Json;');
        usings.add('using System.Text;');
      }
    }
    if (parsed.body?.kind === 'urlencoded') {
      usings.add('using System.Collections.Generic;');
    }
    if (parsed.body?.kind === 'multipart') {
      usings.add('using System.IO;');
    }
    if (parsed.body?.kind === 'text') {
      usings.add('using System.Text;');
    }

    return Array.from(usings).sort();
  }

  private requestBlock(
    parsed: CurlParseResult,
    _options: CurlToHttpClientOptions,
    indent: string,
    bodyLines: string[],
  ): string[] {
    const lines: string[] = [];
    const methodCtor = this.httpMethodCtor(parsed.method);
    lines.push(`${indent}using var request = new HttpRequestMessage(${methodCtor}, "${parsed.path}");`);

    for (const header of parsed.headers) {
      lines.push(...this.headerLine(header, indent));
    }

    if (parsed.basicAuth) {
      const token = this.encodeBase64(`${parsed.basicAuth.user}:${parsed.basicAuth.pass}`);
      lines.push(`${indent}request.Headers.Authorization = new AuthenticationHeaderValue("Basic", "${token}");`);
    }

    if (bodyLines.length > 0) {
      lines.push('');
      lines.push(...bodyLines);
    }

    return lines;
  }

  private buildBodyLines(parsed: CurlParseResult, options: CurlToHttpClientOptions, indent: string): string[] {
    const body = parsed.body;
    if (!body) return [];

    const lines: string[] = [];

    if (body.kind === 'json') {
      const payload = body.raw ?? '';
      if (options.serializer === 'System.Text.Json') {
        if (options.generateBodyRecord) {
          const recordName = this.bodyRecordName(parsed);
          lines.push(`${indent}var payload = /* populate ${recordName} */ new ${recordName}();`);
          lines.push(`${indent}request.Content = JsonContent.Create(payload);`);
        } else {
          const literal = this.toCsharpJsonLiteral(payload);
          lines.push(`${indent}var json = ${literal};`);
          lines.push(`${indent}request.Content = new StringContent(json, Encoding.UTF8, "application/json");`);
          // adjust usings if needed by simple replacement done in caller
        }
      } else {
        if (options.generateBodyRecord) {
          const recordName = this.bodyRecordName(parsed);
          lines.push(`${indent}var payload = /* populate ${recordName} */ new ${recordName}();`);
          lines.push(`${indent}var json = JsonConvert.SerializeObject(payload);`);
        } else {
          const literal = this.toCsharpJsonLiteral(payload);
          lines.push(`${indent}var json = ${literal};`);
        }
        lines.push(`${indent}request.Content = new StringContent(json, Encoding.UTF8, "application/json");`);
      }
      return lines;
    }

    if (body.kind === 'urlencoded') {
      const pairs = this.parseUrlEncoded(body.raw ?? '');
      lines.push(`${indent}var form = new Dictionary<string, string>`);
      lines.push(`${indent}{`);
      for (const [k, v] of pairs) {
        lines.push(`${indent}    ["${this.escapeString(k)}"] = "${this.escapeString(v)}",`);
      }
      lines.push(`${indent}};`);
      lines.push(`${indent}request.Content = new FormUrlEncodedContent(form);`);
      return lines;
    }

    if (body.kind === 'multipart') {
      lines.push(`${indent}var multipart = new MultipartFormDataContent();`);
      const fileFields = (body.formFields ?? []).filter(f => f.isFile);
      const textFields = (body.formFields ?? []).filter(f => !f.isFile);
      for (const f of textFields) {
        lines.push(`${indent}multipart.Add(new StringContent("${this.escapeString(f.value)}"), "${this.escapeString(f.name)}");`);
      }
      for (const f of fileFields) {
        const filename = f.filename ? this.escapeString(f.filename) : 'upload.bin';
        const streamVar = `stream_${this.toIdentifier(f.name)}`;
        lines.push(`${indent}var ${streamVar} = File.OpenRead("${filename}");`);
        lines.push(`${indent}multipart.Add(new StreamContent(${streamVar}), "${this.escapeString(f.name)}", "${filename}");`);
      }
      lines.push(`${indent}request.Content = multipart;`);
      return lines;
    }

    if (body.kind === 'text') {
      const raw = body.raw ?? '';
      lines.push(`${indent}request.Content = new StringContent("${this.escapeString(raw)}", Encoding.UTF8);`);
      return lines;
    }

    return lines;
  }

  private headerLine(header: CurlHeader, indent: string): string[] {
    const name = header.name.trim();
    const value = header.value;
    const lower = name.toLowerCase();

    if (lower === 'authorization') {
      const space = value.indexOf(' ');
      if (space > 0) {
        const scheme = value.slice(0, space);
        const param = value.slice(space + 1);
        return [`${indent}request.Headers.Authorization = new AuthenticationHeaderValue("${this.escapeString(scheme)}", "${this.escapeString(param)}");`];
      }
      return [`${indent}request.Headers.TryAddWithoutValidation("Authorization", "${this.escapeString(value)}");`];
    }

    if (lower === 'content-type' || lower === 'content-length') {
      // Set on Content, not on Headers — added when content is created
      return [`${indent}// ${name} is set on the request content (see Content below)`];
    }

    if (lower === 'accept') {
      const parts = value.split(',').map(p => p.trim()).filter(Boolean);
      return parts.map(p => `${indent}request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("${this.escapeString(p)}"));`);
    }

    if (lower === 'user-agent') {
      return [`${indent}request.Headers.UserAgent.ParseAdd("${this.escapeString(value)}");`];
    }

    return [`${indent}request.Headers.TryAddWithoutValidation("${this.escapeString(name)}", "${this.escapeString(value)}");`];
  }

  private maybeBodyRecord(parsed: CurlParseResult, _options: CurlToHttpClientOptions): string {
    if (parsed.body?.kind !== 'json' || !parsed.body.raw) return '';

    let obj: unknown;
    try {
      obj = JSON.parse(parsed.body.raw);
    } catch {
      return '// (Could not parse JSON body to generate a record.)';
    }

    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      return '';
    }

    const recordName = this.bodyRecordName(parsed);
    const params: string[] = [];
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const pascal = this.toPascalCase(key);
      const csType = this.inferSimpleCsType(value);
      params.push(`${csType} ${pascal}`);
    }

    return `public sealed record ${recordName}(${params.join(', ')});`;
  }

  // ============================================================
  // Tokenization & parsing helpers
  // ============================================================

  private tokenize(input: string): string[] {
    // Join multi-line cURL commands (backslash continuation)
    const unwrapped = input.replace(/\\\r?\n\s*/g, ' ').trim();

    const tokens: string[] = [];
    let i = 0;
    while (i < unwrapped.length) {
      const ch = unwrapped[i];
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
        i++;
        continue;
      }
      if (ch === "'" || ch === '"') {
        const quote = ch;
        i++;
        let buf = '';
        while (i < unwrapped.length && unwrapped[i] !== quote) {
          if (unwrapped[i] === '\\' && i + 1 < unwrapped.length) {
            const next = unwrapped[i + 1];
            if (next === quote || next === '\\') {
              buf += next;
              i += 2;
              continue;
            }
            buf += unwrapped[i];
            i++;
            continue;
          }
          buf += unwrapped[i];
          i++;
        }
        if (i < unwrapped.length) i++; // consume closing quote
        tokens.push(buf);
        continue;
      }
      let buf = '';
      while (i < unwrapped.length && !/\s/.test(unwrapped[i])) {
        if (unwrapped[i] === '\\' && i + 1 < unwrapped.length) {
          buf += unwrapped[i + 1];
          i += 2;
          continue;
        }
        buf += unwrapped[i];
        i++;
      }
      if (buf.length > 0) tokens.push(buf);
    }

    return tokens;
  }

  private requireNext(tokens: string[], i: number, flag: string): string {
    if (i + 1 >= tokens.length) {
      throw new Error(`Missing value for ${flag}`);
    }
    return tokens[i + 1];
  }

  private normalizeMethod(method: string): HttpMethod {
    const upper = method.toUpperCase();
    const allowed: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    if (allowed.includes(upper as HttpMethod)) {
      return upper as HttpMethod;
    }
    throw new Error(`Unsupported HTTP method: ${method}`);
  }

  private httpMethodCtor(method: HttpMethod): string {
    switch (method) {
      case 'GET': return 'HttpMethod.Get';
      case 'POST': return 'HttpMethod.Post';
      case 'PUT': return 'HttpMethod.Put';
      case 'DELETE': return 'HttpMethod.Delete';
      case 'PATCH': return 'HttpMethod.Patch';
      case 'HEAD': return 'HttpMethod.Head';
      case 'OPTIONS': return 'HttpMethod.Options';
    }
  }

  private parseHeader(input: string): CurlHeader | null {
    const idx = input.indexOf(':');
    if (idx === -1) return null;
    return {
      name: input.slice(0, idx).trim(),
      value: input.slice(idx + 1).trim(),
    };
  }

  private parseFormField(input: string): CurlFormField {
    const idx = input.indexOf('=');
    if (idx === -1) {
      return { name: input, value: '', isFile: false };
    }
    const name = input.slice(0, idx);
    const rest = input.slice(idx + 1);
    if (rest.startsWith('@')) {
      const filename = rest.slice(1);
      return { name, value: '', isFile: true, filename };
    }
    return { name, value: rest, isFile: false };
  }

  private parseUrlEncoded(raw: string): [string, string][] {
    const pairs: [string, string][] = [];
    for (const part of raw.split('&')) {
      if (!part) continue;
      const idx = part.indexOf('=');
      if (idx === -1) {
        pairs.push([part, '']);
      } else {
        pairs.push([part.slice(0, idx), part.slice(idx + 1)]);
      }
    }
    return pairs;
  }

  private looksLikeJson(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return false;
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  }

  private splitUrl(url: string): { baseAddress: string; path: string } {
    const match = url.match(/^(https?:\/\/[^/?#]+)(.*)$/i);
    if (match) {
      const path = match[2] || '/';
      return { baseAddress: match[1], path: path.startsWith('/') ? path : `/${path}` };
    }
    return { baseAddress: '', path: url };
  }

  private suggestMethodName(parsed: CurlParseResult): string {
    const segments = parsed.path.split(/[/?#]/).filter(Boolean);
    const lastSegment = segments.length > 0 ? segments[segments.length - 1] : 'Request';
    const cleaned = lastSegment.replace(/[^A-Za-z0-9]/g, '');
    const verb = this.methodToVerb(parsed.method);
    return `${verb}${this.toPascalCase(cleaned || 'Request')}`;
  }

  private suggestClientName(parsed: CurlParseResult): string {
    const segments = parsed.path.split(/[/?#]/).filter(Boolean);
    const candidate = segments.length > 0 ? segments[0] : 'Api';
    const cleaned = candidate.replace(/[^A-Za-z0-9]/g, '');
    return `${this.toPascalCase(cleaned || 'Api')}Client`;
  }

  private methodToVerb(method: HttpMethod): string {
    switch (method) {
      case 'GET': return 'Get';
      case 'POST': return 'Post';
      case 'PUT': return 'Put';
      case 'DELETE': return 'Delete';
      case 'PATCH': return 'Patch';
      case 'HEAD': return 'Head';
      case 'OPTIONS': return 'Options';
    }
  }

  private bodyRecordName(parsed: CurlParseResult): string {
    const base = this.suggestMethodName(parsed);
    return `${base}Request`;
  }

  private inferSimpleCsType(value: unknown): string {
    if (value === null || value === undefined) return 'string?';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'boolean') return 'bool';
    if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'double';
    if (Array.isArray(value)) return 'List<object>';
    return 'object';
  }

  private toPascalCase(str: string): string {
    if (!str) return '';
    return str
      .split(/[-_\s]|(?=[A-Z])/)
      .filter(word => word.length > 0)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  private toIdentifier(str: string): string {
    const cleaned = str.replace(/[^A-Za-z0-9_]/g, '_');
    return /^[0-9]/.test(cleaned) ? `_${cleaned}` : cleaned;
  }

  private escapeString(input: string): string {
    return input
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  private toCsharpJsonLiteral(payload: string): string {
    return `"""\n${payload}\n"""`;
  }

  private encodeBase64(input: string): string {
    if (typeof btoa === 'function') {
      return btoa(unescape(encodeURIComponent(input)));
    }
    // Node fallback (used by Vitest under jsdom this is rarely hit, but kept safe)
    const g = globalThis as unknown as { Buffer?: { from(input: string, enc: string): { toString(enc: string): string } } };
    if (g.Buffer) {
      return g.Buffer.from(input, 'utf-8').toString('base64');
    }
    return input;
  }
}
