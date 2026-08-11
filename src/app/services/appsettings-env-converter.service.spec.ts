import { describe, it, expect, beforeEach } from 'vitest';
import {
  AppsettingsEnvConverterService,
  FlattenOptions,
  UnflattenOptions,
} from './appsettings-env-converter.service';

describe('AppsettingsEnvConverterService', () => {
  let service: AppsettingsEnvConverterService;

  const flattenDefaults: FlattenOptions = {
    separator: '__',
    casing: 'preserve',
    prefix: '',
  };

  const unflattenDefaults: UnflattenOptions = {
    prefix: '',
    inferTypes: true,
    mapAzureConnectionStrings: false,
  };

  const sampleAppSettings = {
    Logging: { LogLevel: { Default: 'Information', 'Microsoft.AspNetCore': 'Warning' } },
    ConnectionStrings: { Default: 'Server=.;Database=App;Trusted_Connection=True' },
    AllowedHosts: '*',
    Serilog: { Using: ['Serilog.Sinks.Console', 'Serilog.Sinks.File'] },
    Feature: { Enabled: true, Retries: 3, Timeout: 2.5 },
  };

  beforeEach(() => {
    service = new AppsettingsEnvConverterService();
  });

  describe('flatten', () => {
    it('joins nested objects with the configured separator', () => {
      const { entries } = service.flatten(
        '{"Logging":{"LogLevel":{"Default":"Information"}}}',
        flattenDefaults
      );

      expect(entries).toEqual([{ key: 'Logging__LogLevel__Default', value: 'Information' }]);
    });

    it('keeps colons when the separator is a colon', () => {
      const { entries } = service.flatten('{"A":{"B":"c"}}', {
        ...flattenDefaults,
        separator: ':',
      });

      expect(entries[0].key).toBe('A:B');
    });

    it('expands arrays into zero-based index segments', () => {
      const { entries } = service.flatten('{"Serilog":{"Using":["Console","File"]}}', flattenDefaults);

      expect(entries).toEqual([
        { key: 'Serilog__Using__0', value: 'Console' },
        { key: 'Serilog__Using__1', value: 'File' },
      ]);
    });

    it('applies the prefix and uppercase casing', () => {
      const { entries } = service.flatten('{"A":{"B":"c"}}', {
        separator: '__',
        casing: 'upper',
        prefix: 'MyApp_',
      });

      expect(entries[0].key).toBe('MYAPP_A__B');
    });

    it('warns that uppercasing can collapse two distinct keys', () => {
      const { warnings } = service.flatten('{"Foo":"1","FOO":"2"}', {
        ...flattenDefaults,
        casing: 'upper',
      });

      expect(warnings.some(w => w.includes('FOO'))).toBe(true);
    });

    it('exports null as an empty string and says so', () => {
      const { entries, warnings } = service.flatten('{"A":null}', flattenDefaults);

      expect(entries).toEqual([{ key: 'A', value: '' }]);
      expect(warnings.some(w => w.includes('null'))).toBe(true);
    });

    it('skips empty objects and arrays with a warning naming the key', () => {
      const { entries, warnings } = service.flatten('{"A":{},"B":[],"C":"keep"}', flattenDefaults);

      expect(entries).toEqual([{ key: 'C', value: 'keep' }]);
      expect(warnings.some(w => w.includes('"A"'))).toBe(true);
      expect(warnings.some(w => w.includes('"B"'))).toBe(true);
    });

    it('reports invalid JSON as an error instead of throwing', () => {
      const { errors } = service.flatten('{ not json', flattenDefaults);

      expect(errors).toHaveLength(1);
    });

    it('rejects a non-object root', () => {
      const { errors } = service.flatten('[1,2]', flattenDefaults);

      expect(errors[0]).toContain('must be a JSON object');
    });
  });

  describe('render', () => {
    const entries = [{ key: 'A__B', value: "it's here" }];

    it('escapes single quotes for bash by closing and reopening the quote', () => {
      const { output } = service.render(entries, 'bash', flattenDefaults);

      expect(output).toBe(`export A__B='it'\\''s here'`);
    });

    it('doubles single quotes for PowerShell', () => {
      const { output } = service.render(entries, 'powershell', flattenDefaults);

      expect(output).toBe(`$env:A__B = 'it''s here'`);
    });

    it('escapes cmd metacharacters with a caret and never quotes the value', () => {
      const { output } = service.render([{ key: 'A', value: 'x & y | z' }], 'cmd-set', flattenDefaults);

      expect(output).toBe('set A=x ^& y ^| z');
    });

    it('escapes a caret before the characters it protects', () => {
      const { output } = service.render([{ key: 'A', value: 'a^&b' }], 'cmd-set', flattenDefaults);

      expect(output).toBe('set A=a^^^&b');
    });

    it('warns when a value exceeds the setx truncation limit', () => {
      const { warnings } = service.render(
        [{ key: 'A', value: 'x'.repeat(1025) }],
        'cmd-setx',
        flattenDefaults
      );

      expect(warnings.some(w => w.includes('1024'))).toBe(true);
    });

    it('does not warn about setx truncation at exactly the limit', () => {
      const { warnings } = service.render(
        [{ key: 'A', value: 'x'.repeat(1024) }],
        'cmd-setx',
        flattenDefaults
      );

      expect(warnings.some(w => w.includes('1024'))).toBe(false);
    });

    it('warns about percent signs for the Windows formats', () => {
      const { warnings } = service.render(
        [{ key: 'A', value: '50%' }],
        'cmd-set',
        flattenDefaults
      );

      expect(warnings.some(w => w.includes('%%'))).toBe(true);
    });

    it('leaves simple .env values unquoted and quotes the ones that need it', () => {
      const { output } = service.render(
        [
          { key: 'A', value: 'plain' },
          { key: 'B', value: 'has space' },
        ],
        'dotenv',
        flattenDefaults
      );

      expect(output).toBe('A=plain\nB="has space"');
    });

    it('always quotes compose values so YAML cannot coerce them', () => {
      const { output } = service.render(
        [{ key: 'A', value: 'true' }],
        'docker-compose',
        flattenDefaults
      );

      expect(output).toContain('      A: "true"');
      expect(output).toContain('    environment:');
    });

    it('renders docker run with continuations and an image placeholder', () => {
      const { output } = service.render([{ key: 'A', value: 'b' }], 'docker-run', flattenDefaults);

      expect(output).toBe("docker run \\\n  -e A='b' \\\n  your-image:tag");
    });

    it('refuses a colon separator for bash', () => {
      const { errors, output } = service.render(
        [{ key: 'A:B', value: 'c' }],
        'bash',
        { ...flattenDefaults, separator: ':' }
      );

      expect(output).toBe('');
      expect(errors[0]).toContain('POSIX');
    });

    it('refuses a colon separator for PowerShell', () => {
      const { errors } = service.render([{ key: 'A:B', value: 'c' }], 'powershell', {
        ...flattenDefaults,
        separator: ':',
      });

      expect(errors).toHaveLength(1);
    });

    it('allows a colon separator for cmd but warns it is Windows-only', () => {
      const { output, errors, warnings } = service.render([{ key: 'A:B', value: 'c' }], 'cmd-set', {
        ...flattenDefaults,
        separator: ':',
      });

      expect(errors).toHaveLength(0);
      expect(output).toBe('set A:B=c');
      expect(warnings.some(w => w.includes('Windows'))).toBe(true);
    });
  });

  describe('parseEnvBlock', () => {
    it('reads a bash export line', () => {
      const { entries } = service.parseEnvBlock("export A__B='hello world'");

      expect(entries).toEqual([{ key: 'A__B', value: 'hello world' }]);
    });

    it('reverses bash single-quote escaping', () => {
      const { entries } = service.parseEnvBlock(`export A='it'\\''s here'`);

      expect(entries[0].value).toBe("it's here");
    });

    it('reads a PowerShell assignment', () => {
      const { entries } = service.parseEnvBlock(`$env:A__B = 'it''s here'`);

      expect(entries).toEqual([{ key: 'A__B', value: "it's here" }]);
    });

    it('reads a SetEnvironmentVariable call', () => {
      const { entries } = service.parseEnvBlock(
        '[Environment]::SetEnvironmentVariable("A__B", "c", "User")'
      );

      expect(entries).toEqual([{ key: 'A__B', value: 'c' }]);
    });

    it('reads a cmd set line', () => {
      const { entries } = service.parseEnvBlock('set A__B=c');

      expect(entries).toEqual([{ key: 'A__B', value: 'c' }]);
    });

    it('reads a setx line whose value contains an equals sign', () => {
      const { entries } = service.parseEnvBlock('setx A__B "Server=.;Database=App"');

      expect(entries).toEqual([{ key: 'A__B', value: 'Server=.;Database=App' }]);
    });

    it('reads a plain .env line', () => {
      const { entries } = service.parseEnvBlock('A__B=c');

      expect(entries).toEqual([{ key: 'A__B', value: 'c' }]);
    });

    it('reads docker run flags and drops the command scaffolding', () => {
      const { entries } = service.parseEnvBlock("docker run \\\n  -e A__B='c' \\\n  -e A__C='d' \\");

      expect(entries).toEqual([
        { key: 'A__B', value: 'c' },
        { key: 'A__C', value: 'd' },
      ]);
    });

    it('reads a compose environment block and skips its scaffolding keys', () => {
      const { entries } = service.parseEnvBlock(
        'services:\n  app:\n    environment:\n      A__B: "c"'
      );

      expect(entries).toEqual([{ key: 'A__B', value: 'c' }]);
    });

    it('ignores blank lines and comments', () => {
      const { entries, warnings } = service.parseEnvBlock('# a comment\nrem another\n\nA=b');

      expect(entries).toEqual([{ key: 'A', value: 'b' }]);
      expect(warnings).toHaveLength(0);
    });

    it('warns about an unreadable line instead of failing the whole block', () => {
      const { entries, warnings } = service.parseEnvBlock('A=b\nthis is not a variable');

      expect(entries).toEqual([{ key: 'A', value: 'b' }]);
      expect(warnings).toHaveLength(1);
    });

    it('keeps the last value when a key repeats', () => {
      const { entries, warnings } = service.parseEnvBlock('A=first\nA=second');

      expect(entries).toEqual([{ key: 'A', value: 'second' }]);
      expect(warnings.some(w => w.includes('more than once'))).toBe(true);
    });
  });

  describe('unflatten', () => {
    it('rebuilds nested objects from double underscores', () => {
      const { output } = service.unflatten(
        [{ key: 'Logging__LogLevel__Default', value: 'Information' }],
        unflattenDefaults
      );

      expect(JSON.parse(output)).toEqual({ Logging: { LogLevel: { Default: 'Information' } } });
    });

    it('accepts colon-separated keys too', () => {
      const { output } = service.unflatten([{ key: 'A:B', value: 'c' }], unflattenDefaults);

      expect(JSON.parse(output)).toEqual({ A: { B: 'c' } });
    });

    it('rebuilds a JSON array from consecutive numeric segments', () => {
      const { output } = service.unflatten(
        [
          { key: 'Serilog__Using__1', value: 'File' },
          { key: 'Serilog__Using__0', value: 'Console' },
        ],
        unflattenDefaults
      );

      expect(JSON.parse(output)).toEqual({ Serilog: { Using: ['Console', 'File'] } });
    });

    it('keeps an object when the numeric segments have a gap', () => {
      const { output } = service.unflatten(
        [
          { key: 'A__0', value: 'x' },
          { key: 'A__2', value: 'y' },
        ],
        unflattenDefaults
      );

      expect(JSON.parse(output)).toEqual({ A: { '0': 'x', '2': 'y' } });
    });

    it('strips the configured prefix', () => {
      const { output } = service.unflatten([{ key: 'MyApp_A__B', value: 'c' }], {
        ...unflattenDefaults,
        prefix: 'MyApp_',
      });

      expect(JSON.parse(output)).toEqual({ A: { B: 'c' } });
    });

    it('warns when a key does not carry the configured prefix', () => {
      const { warnings } = service.unflatten([{ key: 'Other__B', value: 'c' }], {
        ...unflattenDefaults,
        prefix: 'MyApp_',
      });

      expect(warnings.some(w => w.includes('MyApp_'))).toBe(true);
    });

    it('maps Azure connection-string prefixes onto ConnectionStrings', () => {
      const { output } = service.unflatten(
        [
          { key: 'SQLAZURECONNSTR_Default', value: 'Server=azure' },
          { key: 'CUSTOMCONNSTR_Redis', value: 'localhost:6379' },
          { key: 'APPSETTING_Feature__Enabled', value: 'true' },
        ],
        { ...unflattenDefaults, mapAzureConnectionStrings: true }
      );

      expect(JSON.parse(output)).toEqual({
        ConnectionStrings: { Default: 'Server=azure', Redis: 'localhost:6379' },
        Feature: { Enabled: true },
      });
    });

    it('leaves Azure prefixes alone when the mapping is off', () => {
      const { output } = service.unflatten(
        [{ key: 'SQLCONNSTR_Default', value: 'Server=azure' }],
        unflattenDefaults
      );

      expect(JSON.parse(output)).toEqual({ SQLCONNSTR_Default: 'Server=azure' });
    });

    it('infers booleans, numbers, and null when asked', () => {
      const { output } = service.unflatten(
        [
          { key: 'A', value: 'true' },
          { key: 'B', value: 'False' },
          { key: 'C', value: '42' },
          { key: 'D', value: '2.5' },
          { key: 'E', value: '-7' },
          { key: 'F', value: 'null' },
        ],
        unflattenDefaults
      );

      expect(JSON.parse(output)).toEqual({ A: true, B: false, C: 42, D: 2.5, E: -7, F: null });
    });

    it('leaves values that would not survive a round trip as strings', () => {
      const { output } = service.unflatten(
        [
          { key: 'Version', value: '1.0' },
          { key: 'Id', value: '007' },
          { key: 'Big', value: '12345678901234567890' },
        ],
        unflattenDefaults
      );

      expect(JSON.parse(output)).toEqual({
        Version: '1.0',
        Id: '007',
        Big: '12345678901234567890',
      });
    });

    it('keeps every value a string when inference is off', () => {
      const { output } = service.unflatten(
        [
          { key: 'A', value: 'true' },
          { key: 'B', value: '42' },
        ],
        { ...unflattenDefaults, inferTypes: false }
      );

      expect(JSON.parse(output)).toEqual({ A: 'true', B: '42' });
    });

    it('reports a key that is both a value and a parent', () => {
      const { errors } = service.unflatten(
        [
          { key: 'A', value: '1' },
          { key: 'A__B', value: '2' },
        ],
        unflattenDefaults
      );

      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('A__B');
    });

    it('reports the conflict in the other order too', () => {
      const { errors } = service.unflatten(
        [
          { key: 'A__B', value: '2' },
          { key: 'A', value: '1' },
        ],
        unflattenDefaults
      );

      expect(errors).toHaveLength(1);
    });
  });

  describe('round trip', () => {
    const json = JSON.stringify(sampleAppSettings, null, 2);

    it('survives appsettings -> bash -> appsettings unchanged', () => {
      const exported = service.toEnvironmentVariables(json, 'bash', flattenDefaults);
      expect(exported.errors).toHaveLength(0);

      const reimported = service.toAppSettings(exported.output, unflattenDefaults);
      expect(reimported.errors).toHaveLength(0);
      expect(JSON.parse(reimported.output)).toEqual(sampleAppSettings);
    });

    it.each(['powershell', 'cmd-setx', 'dotenv', 'docker-compose'] as const)(
      'survives appsettings -> %s -> appsettings unchanged',
      format => {
        const exported = service.toEnvironmentVariables(json, format, flattenDefaults);
        const reimported = service.toAppSettings(exported.output, unflattenDefaults);

        expect(JSON.parse(reimported.output)).toEqual(sampleAppSettings);
      }
    );

    it('round trips through an uppercase prefixed export', () => {
      const exported = service.toEnvironmentVariables(json, 'bash', {
        separator: '__',
        casing: 'upper',
        prefix: 'MYAPP_',
      });

      const reimported = service.toAppSettings(exported.output, {
        ...unflattenDefaults,
        prefix: 'MYAPP_',
      });

      // Casing is lost by design - only the shape and the values come back.
      expect(JSON.parse(reimported.output)).toEqual({
        LOGGING: { LOGLEVEL: { DEFAULT: 'Information', 'MICROSOFT.ASPNETCORE': 'Warning' } },
        CONNECTIONSTRINGS: { DEFAULT: 'Server=.;Database=App;Trusted_Connection=True' },
        ALLOWEDHOSTS: '*',
        SERILOG: { USING: ['Serilog.Sinks.Console', 'Serilog.Sinks.File'] },
        FEATURE: { ENABLED: true, RETRIES: 3, TIMEOUT: 2.5 },
      });
    });
  });
});
