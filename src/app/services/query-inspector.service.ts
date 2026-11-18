import { Injectable } from '@angular/core';

export interface QueryParam {
  key: string;
  value: string;
  /** Exactly as it appeared in the input, so untouched params round-trip byte for byte. */
  raw: string;
  json: unknown;
  /** Set when the value looks like JSON (starts with { or [) but does not parse. */
  jsonError: string | null;
}

export interface UrlParts {
  scheme: string;
  username: string;
  password: string;
  host: string;
  port: string;
  path: string;
  fragment: string;
}

export interface ParsedQuery {
  /** Everything before the query string; for a relative input this is the path. */
  prefix: string;
  /** '?' when the input had one, '' for a bare query string. */
  separator: string;
  hash: string;
  url: UrlParts | null;
  params: QueryParam[];
}

export type SegmentKind =
  | 'plain'
  | 'separator'
  | 'scheme'
  | 'auth'
  | 'host'
  | 'port'
  | 'path'
  | 'key'
  | 'value'
  | 'fragment';

export interface Segment {
  text: string;
  kind: SegmentKind;
}

const AUTHORITY = /^([a-z][a-z\d+.-]*)(:\/\/|:)(?:([^@/]*)(@))?(\[[^\]]*\]|[^/:]*)(?:(:)(\d*))?([\s\S]*)$/i;

@Injectable({ providedIn: 'root' })
export class QueryInspectorService {
  parse(input: string): ParsedQuery {
    const text = input.trim();
    const { prefix, query, hash, isBareQuery } = this.split(text);
    return {
      prefix,
      separator: isBareQuery ? '' : '?',
      hash,
      url: this.urlParts(text),
      params: query.split('&').filter(Boolean).map(raw => this.toParam(raw)),
    };
  }

  /** Tokenizes the raw input for highlighting; the segments concatenate back to exactly `input`. */
  segments(input: string): Segment[] {
    const text = input.trim();
    const lead = input.slice(0, input.indexOf(text));
    const out: Segment[] = [];
    const add = (part: string | undefined, kind: SegmentKind) => {
      if (part) out.push({ text: part, kind });
    };

    add(lead, 'plain');
    const { prefix, query, hash, isBareQuery, hasQuestionMark } = this.split(text);
    const authority = this.isAbsolute(prefix) ? AUTHORITY.exec(prefix) : null;
    if (authority) {
      const [, scheme, schemeSep, auth, at, host, portSep, port, path] = authority;
      add(scheme, 'scheme');
      add(schemeSep, 'separator');
      add(auth, 'auth');
      add(at, 'separator');
      add(host, 'host');
      add(portSep, 'separator');
      add(port, 'port');
      add(path, 'path');
    } else {
      add(prefix, 'path');
    }
    if (hasQuestionMark) add('?', 'separator');
    if (hasQuestionMark || isBareQuery) {
      query.split('&').forEach((part, i) => {
        if (i > 0) add('&', 'separator');
        const eq = part.indexOf('=');
        add(eq < 0 ? part : part.slice(0, eq), 'key');
        if (eq >= 0) {
          add('=', 'separator');
          add(part.slice(eq + 1), 'value');
        }
      });
    }
    if (hash) {
      add('#', 'separator');
      add(hash.slice(1), 'fragment');
    }
    add(input.slice(lead.length + text.length), 'plain');
    return out;
  }

  private split(text: string) {
    const hashIndex = text.indexOf('#');
    const beforeHash = hashIndex < 0 ? text : text.slice(0, hashIndex);
    const hash = hashIndex < 0 ? '' : text.slice(hashIndex);
    const queryIndex = beforeHash.indexOf('?');
    const hasQuestionMark = queryIndex >= 0;
    const isBareQuery = !hasQuestionMark && !this.isAbsolute(text) && beforeHash.includes('=');
    return {
      prefix: hasQuestionMark ? beforeHash.slice(0, queryIndex) : isBareQuery ? '' : beforeHash,
      query: hasQuestionMark ? beforeHash.slice(queryIndex + 1) : isBareQuery ? beforeHash : '',
      hash,
      isBareQuery,
      hasQuestionMark,
    };
  }

  build(parsed: ParsedQuery): string {
    const query = parsed.params.map(p => p.raw).join('&');
    return parsed.prefix + (query ? parsed.separator + query : '') + parsed.hash;
  }

  /** JSON edited in pretty form is minified first, so the indentation doesn't end up percent-encoded in the URL. */
  withValue(param: QueryParam, value: string): QueryParam {
    const rawKey = param.raw.split('=')[0];
    const { json } = this.parseJson(value);
    const compact = json === undefined ? value : JSON.stringify(json);
    return this.toParam(`${rawKey}=${encodeURIComponent(compact)}`);
  }

  private toParam(raw: string): QueryParam {
    const eq = raw.indexOf('=');
    const key = this.decode(eq < 0 ? raw : raw.slice(0, eq));
    const value = eq < 0 ? '' : this.decode(raw.slice(eq + 1));
    return { key, value, raw, ...this.parseJson(value) };
  }

  private decode(text: string): string {
    return this.decodeComponent(text.replace(/\+/g, ' '));
  }

  private decodeComponent(text: string): string {
    try {
      return decodeURIComponent(text);
    } catch {
      return text;
    }
  }

  // Only objects and arrays: every bare number or `true` is technically JSON too, and flagging those is noise.
  private parseJson(value: string): { json: unknown; jsonError: string | null } {
    const trimmed = value.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return { json: undefined, jsonError: null };
    try {
      return { json: JSON.parse(trimmed), jsonError: null };
    } catch (error) {
      return { json: undefined, jsonError: error instanceof Error ? error.message : String(error) };
    }
  }

  private isAbsolute(text: string): boolean {
    return /^[a-z][a-z\d+.-]*:/i.test(text);
  }

  private urlParts(text: string): UrlParts | null {
    if (!this.isAbsolute(text) || !URL.canParse(text)) return null;
    const url = new URL(text);
    return {
      scheme: url.protocol.replace(/:$/, ''),
      username: this.decodeComponent(url.username),
      password: this.decodeComponent(url.password),
      host: url.hostname,
      port: url.port,
      path: this.decodeComponent(url.pathname),
      fragment: this.decodeComponent(url.hash.replace(/^#/, '')),
    };
  }
}
