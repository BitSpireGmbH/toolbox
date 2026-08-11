import { Injectable } from '@angular/core';

/** Every shell / container flavour the exporter can render. */
export type EnvFormat =
  | 'bash'
  | 'powershell'
  | 'cmd-set'
  | 'cmd-setx'
  | 'dotenv'
  | 'docker-run'
  | 'docker-compose';

/**
 * .NET accepts both, but only `__` survives every platform: POSIX shells cannot
 * declare an identifier containing a colon at all.
 */
export type KeySeparator = '__' | ':';

export type KeyCasing = 'preserve' | 'upper';

export interface FlattenOptions {
  separator: KeySeparator;
  casing: KeyCasing;
  /** Matches the argument of `AddEnvironmentVariables("MyApp_")`. */
  prefix: string;
}

export interface UnflattenOptions {
  prefix: string;
  inferTypes: boolean;
  mapAzureConnectionStrings: boolean;
}

export interface FlatEntry {
  key: string;
  value: string;
}

export interface ConversionResult {
  output: string;
  warnings: string[];
  errors: string[];
}

export interface EntriesResult {
  entries: FlatEntry[];
  warnings: string[];
  errors: string[];
}

export interface EnvFormatDescriptor {
  id: EnvFormat;
  /** Tab label. */
  label: string;
  /** Which platform this targets - drives the grouping in the UI. */
  group: 'Linux / macOS' | 'Windows' | 'Docker';
  /** Always-true behaviour of the target, shown next to the output. */
  note: string;
}

export const ENV_FORMATS: readonly EnvFormatDescriptor[] = [
  {
    id: 'bash',
    label: 'Bash / zsh',
    group: 'Linux / macOS',
    note: 'export only affects the current shell. Add the lines to ~/.bashrc, ~/.zshrc, or a file you source to make them stick.',
  },
  {
    id: 'powershell',
    label: 'PowerShell',
    group: 'Windows',
    note: 'The $env: drive only affects the current PowerShell session. Use [Environment]::SetEnvironmentVariable(name, value, "User") to persist.',
  },
  {
    id: 'cmd-set',
    label: 'cmd (set)',
    group: 'Windows',
    note: 'set only affects the current console window. Values are taken verbatim to the end of the line, so quotes and trailing spaces become part of the value.',
  },
  {
    id: 'cmd-setx',
    label: 'cmd (setx)',
    group: 'Windows',
    note: 'setx writes to the user profile permanently, but silently truncates values at 1024 characters and does NOT change the console you run it in.',
  },
  {
    id: 'dotenv',
    label: '.env file',
    group: 'Docker',
    note: 'A .env file is read by Docker Compose, not by a shell - there is no export, and values are never expanded or word-split.',
  },
  {
    id: 'docker-run',
    label: 'docker run',
    group: 'Docker',
    note: 'Each -e flag is passed straight into the container. Prefer --env-file for long lists so secrets stay out of your shell history.',
  },
  {
    id: 'docker-compose',
    label: 'compose YAML',
    group: 'Docker',
    note: 'Every value is quoted so YAML cannot coerce it - an unquoted true, no, or 1.10 would change meaning before .NET ever sees them.',
  },
];

/** Targets whose platform cannot express a ':' inside a variable name. */
const COLON_HOSTILE: Readonly<Partial<Record<EnvFormat, string>>> = {
  bash: 'POSIX shells cannot declare a variable whose name contains a colon - export Foo:Bar=x is a syntax error. Switch the separator to __.',
  powershell:
    'PowerShell parses $env:Foo:Bar as a provider path, not a variable name. Switch the separator to __.',
  dotenv: 'Docker rejects environment variable names containing a colon. Switch the separator to __.',
  'docker-run':
    'Docker rejects environment variable names containing a colon. Switch the separator to __.',
  'docker-compose':
    'Docker rejects environment variable names containing a colon. Switch the separator to __.',
};

/** setx writes to the registry and cuts anything past this without telling you. */
const SETX_VALUE_LIMIT = 1024;

/**
 * Prefixes Azure App Service puts in front of connection strings. The value is
 * surfaced to .NET as `ConnectionStrings:<name>`.
 */
const AZURE_CONNECTION_PREFIXES = [
  'CUSTOMCONNSTR_',
  'SQLCONNSTR_',
  'SQLAZURECONNSTR_',
  'MYSQLCONNSTR_',
  'POSTGRESQLCONNSTR_',
];

/** Azure App Service prefix for plain application settings. */
const AZURE_APPSETTING_PREFIX = 'APPSETTING_';

interface TreeNode {
  children: Map<string, TreeNode>;
  leaf?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AppsettingsEnvConverterService {
  // ---------------------------------------------------------------------
  // appsettings.json -> environment variables
  // ---------------------------------------------------------------------

  toEnvironmentVariables(
    json: string,
    format: EnvFormat,
    options: FlattenOptions
  ): ConversionResult {
    const flattened = this.flatten(json, options);
    if (flattened.errors.length > 0) {
      return { output: '', warnings: flattened.warnings, errors: flattened.errors };
    }

    const rendered = this.render(flattened.entries, format, options);
    return {
      output: rendered.output,
      warnings: [...flattened.warnings, ...rendered.warnings],
      errors: rendered.errors,
    };
  }

  /**
   * Turns a config object into `Parent:Child` paths first (the shape .NET itself
   * uses), then applies prefix, separator, and casing in one place.
   */
  flatten(json: string, options: FlattenOptions): EntriesResult {
    const warnings: string[] = [];
    const errors: string[] = [];

    if (!json.trim()) {
      return { entries: [], warnings, errors };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Invalid JSON');
      return { entries: [], warnings, errors };
    }

    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      errors.push('The root of an appsettings.json file must be a JSON object.');
      return { entries: [], warnings, errors };
    }

    const paths: FlatEntry[] = [];
    this.walk(parsed, '', paths, warnings);

    const entries = paths.map(entry => ({
      key: this.toEnvKey(entry.key, options),
      value: entry.value,
    }));

    this.reportCollisions(entries, warnings);
    return { entries, warnings, errors };
  }

  render(entries: FlatEntry[], format: EnvFormat, options: FlattenOptions): ConversionResult {
    const warnings: string[] = [];
    const errors: string[] = [];

    if (options.separator === ':') {
      const reason = COLON_HOSTILE[format];
      if (reason) {
        return { output: '', warnings, errors: [reason] };
      }
      warnings.push(
        'A colon separator only works on Windows. Use __ if the same configuration ever has to run on Linux or in a container.'
      );
    }

    if (entries.length === 0) {
      return { output: '', warnings, errors };
    }

    this.collectValueWarnings(entries, format, warnings);
    return { output: this.renderLines(entries, format), warnings, errors };
  }

  private renderLines(entries: FlatEntry[], format: EnvFormat): string {
    switch (format) {
      case 'bash':
        return entries.map(e => `export ${e.key}=${this.quotePosix(e.value)}`).join('\n');
      case 'powershell':
        return entries.map(e => `$env:${e.key} = '${e.value.replaceAll("'", "''")}'`).join('\n');
      case 'cmd-set':
        return entries.map(e => `set ${e.key}=${this.escapeCmd(e.value)}`).join('\n');
      case 'cmd-setx':
        return entries.map(e => `setx ${e.key} "${e.value.replaceAll('"', '\\"')}"`).join('\n');
      case 'dotenv':
        return entries.map(e => `${e.key}=${this.quoteDotenv(e.value)}`).join('\n');
      case 'docker-run':
        return [
          'docker run \\',
          ...entries.map(e => `  -e ${e.key}=${this.quotePosix(e.value)} \\`),
          '  your-image:tag',
        ].join('\n');
      default:
        return [
          'services:',
          '  app:',
          '    environment:',
          ...entries.map(e => `      ${e.key}: "${this.escapeDoubleQuoted(e.value)}"`),
        ].join('\n');
    }
  }

  // ---------------------------------------------------------------------
  // environment variables -> appsettings.json
  // ---------------------------------------------------------------------

  toAppSettings(envText: string, options: UnflattenOptions): ConversionResult {
    const parsed = this.parseEnvBlock(envText);
    if (parsed.entries.length === 0) {
      return { output: '', warnings: parsed.warnings, errors: parsed.errors };
    }

    const unflattened = this.unflatten(parsed.entries, options);
    return {
      output: unflattened.output,
      warnings: [...parsed.warnings, ...unflattened.warnings],
      errors: [...parsed.errors, ...unflattened.errors],
    };
  }

  /**
   * Deliberately tolerant: whatever this tool emits - and whatever a colleague
   * pasted out of a terminal, a compose file, or an Azure blade - should parse.
   */
  parseEnvBlock(text: string): EntriesResult {
    const warnings: string[] = [];
    const errors: string[] = [];
    const entries: FlatEntry[] = [];
    const seen = new Map<string, number>();

    for (const rawLine of text.split(/\r?\n/)) {
      const parsed = this.parseEnvLine(rawLine);
      if (parsed === 'skip') {
        continue;
      }
      if (parsed === null) {
        warnings.push(`Could not read this line, so it was ignored: ${rawLine.trim()}`);
        continue;
      }

      const existing = seen.get(parsed.key);
      if (existing !== undefined) {
        warnings.push(`"${parsed.key}" appears more than once - the last value wins.`);
        entries[existing] = parsed;
        continue;
      }
      seen.set(parsed.key, entries.length);
      entries.push(parsed);
    }

    return { entries, warnings, errors };
  }

  unflatten(entries: FlatEntry[], options: UnflattenOptions): ConversionResult {
    const warnings: string[] = [];
    const errors: string[] = [];
    const root: TreeNode = { children: new Map() };

    for (const entry of entries) {
      const configPath = this.toConfigPath(entry.key, options, warnings);
      const segments = configPath.split(':').filter(segment => segment.length > 0);
      if (segments.length === 0) {
        warnings.push(`"${entry.key}" has no usable key left after the prefix was removed.`);
        continue;
      }

      let node = root;
      let conflict = false;
      for (const segment of segments.slice(0, -1)) {
        let child = node.children.get(segment);
        if (!child) {
          child = { children: new Map() };
          node.children.set(segment, child);
        }
        if (child.leaf !== undefined) {
          errors.push(
            `"${entry.key}" cannot be nested: "${segment}" is already a value on its own - JSON cannot represent both.`
          );
          conflict = true;
          break;
        }
        node = child;
      }
      if (conflict) {
        continue;
      }

      const last = segments[segments.length - 1];
      const target = node.children.get(last);
      if (target && target.children.size > 0) {
        errors.push(
          `"${entry.key}" is both a value and a parent of other variables - JSON cannot represent both.`
        );
        continue;
      }
      node.children.set(last, { children: new Map(), leaf: entry.value });
    }

    if (errors.length > 0) {
      return { output: '', warnings, errors };
    }

    const materialized = this.materialize(root, options.inferTypes);
    return { output: JSON.stringify(materialized, null, 2), warnings, errors };
  }

  // ---------------------------------------------------------------------
  // flattening helpers
  // ---------------------------------------------------------------------

  private walk(node: unknown, path: string, out: FlatEntry[], warnings: string[]): void {
    if (Array.isArray(node)) {
      if (node.length === 0) {
        warnings.push(
          `"${path}" is an empty array. Environment variables cannot express that, so it was skipped.`
        );
        return;
      }
      node.forEach((item, index) => this.walk(item, this.join(path, String(index)), out, warnings));
      return;
    }

    if (node !== null && typeof node === 'object') {
      const record = node as Record<string, unknown>;
      const keys = Object.keys(record);
      if (keys.length === 0) {
        warnings.push(
          path
            ? `"${path}" is an empty object. Environment variables cannot express that, so it was skipped.`
            : 'The JSON object is empty - there is nothing to export.'
        );
        return;
      }
      for (const key of keys) {
        this.walk(record[key], this.join(path, key), out, warnings);
      }
      return;
    }

    if (node === null) {
      warnings.push(
        `"${path}" is null. Environment variables have no null, so it is exported as an empty string.`
      );
      out.push({ key: path, value: '' });
      return;
    }

    out.push({ key: path, value: String(node) });
  }

  private join(path: string, segment: string): string {
    return path ? `${path}:${segment}` : segment;
  }

  private toEnvKey(configPath: string, options: FlattenOptions): string {
    const prefixed = options.prefix ? `${options.prefix}${configPath}` : configPath;
    const separated = prefixed.replaceAll(':', options.separator);
    return options.casing === 'upper' ? separated.toUpperCase() : separated;
  }

  private reportCollisions(entries: FlatEntry[], warnings: string[]): void {
    const seen = new Set<string>();
    for (const entry of entries) {
      if (seen.has(entry.key)) {
        warnings.push(
          `"${entry.key}" is produced by more than one configuration key - only the last one survives.`
        );
      }
      seen.add(entry.key);
    }
  }

  private collectValueWarnings(
    entries: FlatEntry[],
    format: EnvFormat,
    warnings: string[]
  ): void {
    if (format === 'cmd-setx') {
      for (const entry of entries) {
        if (entry.value.length > SETX_VALUE_LIMIT) {
          warnings.push(
            `"${entry.key}" is ${entry.value.length} characters. setx truncates at ${SETX_VALUE_LIMIT} without any error - set it through System Properties instead.`
          );
        }
      }
    }

    if (format === 'cmd-set' || format === 'cmd-setx') {
      if (entries.some(entry => entry.value.includes('%'))) {
        warnings.push(
          'Some values contain %. Inside a .bat or .cmd file you have to double it (%%) or the shell will try to expand it.'
        );
      }
      if (entries.some(entry => entry.value.includes('\n'))) {
        warnings.push('cmd.exe cannot hold a multi-line value - those variables will be cut at the first line break.');
      }
      if (format === 'cmd-set' && entries.some(entry => entry.value !== entry.value.trim())) {
        warnings.push(
          'Some values have leading or trailing whitespace. set keeps it verbatim, which is rarely what you want.'
        );
      }
    }

    if (format === 'dotenv' && entries.some(entry => entry.value.includes('\n'))) {
      warnings.push(
        'Multi-line values are escaped as \\n. Docker Compose reads that literally, so the newline will not survive.'
      );
    }
  }

  /** POSIX single quoting: everything is literal, and `'` is closed, escaped, reopened. */
  private quotePosix(value: string): string {
    return `'${value.replaceAll("'", "'\\''")}'`;
  }

  private escapeCmd(value: string): string {
    return value.replace(/[\^&|<>()]/g, match => `^${match}`);
  }

  private quoteDotenv(value: string): string {
    if (value === '') {
      return '';
    }
    if (!/[\s#"'\\]/.test(value)) {
      return value;
    }
    return `"${this.escapeDoubleQuoted(value)}"`;
  }

  private escapeDoubleQuoted(value: string): string {
    return value
      .replaceAll('\\', '\\\\')
      .replaceAll('"', '\\"')
      .replaceAll('\r', '\\r')
      .replaceAll('\n', '\\n');
  }

  // ---------------------------------------------------------------------
  // parsing helpers
  // ---------------------------------------------------------------------

  /** Returns the entry, `'skip'` for blank/comment lines, or null when unreadable. */
  private parseEnvLine(rawLine: string): FlatEntry | 'skip' | null {
    let line = rawLine.trim();
    if (!line) {
      return 'skip';
    }
    if (line.startsWith('#') || line.startsWith('//') || /^rem(\s|$)/i.test(line)) {
      return 'skip';
    }

    if (line.endsWith('\\')) {
      line = line.slice(0, -1).trim();
    }

    // `services:`, `app:`, `environment:` scaffolding from a pasted compose file.
    if (/^[A-Za-z0-9_-]+:$/.test(line)) {
      return 'skip';
    }

    const setEnvVariable = line.match(
      /^\[Environment\]::SetEnvironmentVariable\(\s*(.+?)\s*,\s*(.+?)\s*(?:,\s*.+?\s*)?\)\s*;?$/i
    );
    if (setEnvVariable) {
      return {
        key: this.unquote(setEnvVariable[1]),
        value: this.unquote(setEnvVariable[2]),
      };
    }

    line = line.replace(/^docker\s+run\s*/i, '');
    if (!line) {
      return 'skip';
    }

    const wasSetx = /^setx\s+/i.test(line);
    line = line
      .replace(/^export\s+/i, '')
      .replace(/^setx\s+/i, '')
      .replace(/^set\s+/i, '')
      .replace(/^(?:-e|--env)\s+/i, '')
      .replace(/^\$env:/i, '')
      .trim();

    if (!line || line.startsWith('-')) {
      return 'skip';
    }

    // setx separates name and value with a space, so it has to be checked before
    // the `=` split - otherwise an `=` inside the value would be mistaken for it.
    if (wasSetx) {
      const spaced = line.match(/^([A-Za-z_][A-Za-z0-9_.:]*)\s+(.*)$/);
      if (spaced) {
        return { key: spaced[1], value: this.unquote(spaced[2]) };
      }
    }

    // A YAML mapping needs whitespace after the colon, which a `Foo:Bar=x` key
    // never has - so this only fires for genuine compose lines.
    const yaml = line.match(/^([A-Za-z_][A-Za-z0-9_.]*)\s*:\s(.*)$/);
    const equals = line.indexOf('=');

    // Whichever separator comes first is the real one: the value on the other
    // side is free to contain the other character.
    if (yaml && (equals < 0 || yaml[1].length < equals)) {
      return { key: yaml[1], value: this.unquote(yaml[2]) };
    }

    if (equals > 0) {
      return {
        key: line.slice(0, equals).trim(),
        value: this.unquote(line.slice(equals + 1)),
      };
    }

    return null;
  }

  private unquote(raw: string): string {
    const value = raw.trim();
    if (value.length < 2) {
      return value;
    }

    const first = value[0];
    const last = value[value.length - 1];

    if (first === "'" && last === "'") {
      // Reverses both POSIX ('\'') and PowerShell ('') single-quote escaping.
      return value.slice(1, -1).replaceAll("'\\''", "'").replaceAll("''", "'");
    }

    if (first === '"' && last === '"') {
      return value
        .slice(1, -1)
        .replace(/\\([\\"nrt])/g, (_, escaped: string) => {
          switch (escaped) {
            case 'n':
              return '\n';
            case 'r':
              return '\r';
            case 't':
              return '\t';
            default:
              return escaped;
          }
        })
        .replaceAll('""', '"');
    }

    return value;
  }

  private toConfigPath(rawKey: string, options: UnflattenOptions, warnings: string[]): string {
    let key = rawKey.trim();

    if (options.mapAzureConnectionStrings) {
      const azure = this.stripAzurePrefix(key);
      if (azure !== null) {
        return azure;
      }
    }

    if (options.prefix && key.toLowerCase().startsWith(options.prefix.toLowerCase())) {
      key = key.slice(options.prefix.length);
    } else if (options.prefix) {
      warnings.push(`"${rawKey}" does not start with the prefix "${options.prefix}" and was left as is.`);
    }

    return key.replaceAll('__', ':');
  }

  private stripAzurePrefix(key: string): string | null {
    const upper = key.toUpperCase();

    for (const prefix of AZURE_CONNECTION_PREFIXES) {
      if (upper.startsWith(prefix)) {
        return `ConnectionStrings:${key.slice(prefix.length).replaceAll('__', ':')}`;
      }
    }

    if (upper.startsWith(AZURE_APPSETTING_PREFIX)) {
      return key.slice(AZURE_APPSETTING_PREFIX.length).replaceAll('__', ':');
    }

    return null;
  }

  // ---------------------------------------------------------------------
  // tree materialisation
  // ---------------------------------------------------------------------

  private materialize(node: TreeNode, inferTypes: boolean): unknown {
    if (node.leaf !== undefined) {
      return inferTypes ? this.coerce(node.leaf) : node.leaf;
    }

    const keys = [...node.children.keys()];
    if (this.isArrayShape(keys)) {
      return keys
        .map(key => Number(key))
        .sort((a, b) => a - b)
        .map(index => this.materialize(node.children.get(String(index)) as TreeNode, inferTypes));
    }

    const result: Record<string, unknown> = {};
    for (const [key, child] of node.children) {
      result[key] = this.materialize(child, inferTypes);
    }
    return result;
  }

  /** `Foo__0`, `Foo__1`, ... rebuilds a JSON array; anything with a gap stays an object. */
  private isArrayShape(keys: string[]): boolean {
    if (keys.length === 0 || !keys.every(key => /^\d+$/.test(key))) {
      return false;
    }
    const indices = keys.map(Number).sort((a, b) => a - b);
    return indices.every((value, position) => value === position);
  }

  /**
   * Only converts values that survive a round trip, so version strings like
   * "1.0", zero-padded ids like "007", and oversized integers stay strings.
   */
  private coerce(value: string): unknown {
    if (/^(true|false)$/i.test(value)) {
      return value.toLowerCase() === 'true';
    }
    if (value === 'null') {
      return null;
    }
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && String(parsed) === value) {
        return parsed;
      }
    }
    return value;
  }
}
