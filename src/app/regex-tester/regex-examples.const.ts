import { RegexPaletteItem } from '../services/regex-explain.service';
import { RegexOptionsModel } from '../services/regex-tester.service';

export interface RegexExample {
  title: string;
  pattern: string;
  /** Each example brings its own text, so the result is visible immediately. */
  testInput: string;
}

/** The seven ready-made patterns behind the Examples toggle. */
export const REGEX_EXAMPLES: readonly RegexExample[] = [
  {
    title: 'ISO date',
    pattern: String.raw`(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})`,
    testInput:
      'Order #1024 shipped on 2024-03-15.\nFollow-up scheduled for 2024-04-02.\nInvoice INV-2024-05-30 is still open.',
  },
  {
    title: 'Email address',
    pattern: String.raw`(?<user>[\w.+-]+)@(?<host>[\w-]+(?:\.[\w-]+)+)`,
    testInput:
      'Write to ada.lovelace@example.com or support+billing@contoso.co.uk.\nNot an address: user@@example.',
  },
  {
    title: 'URL',
    pattern: String.raw`(?<scheme>https?)://(?<host>[^\s/?#]+)(?<path>/[^\s?#]*)?`,
    testInput:
      'Docs at https://learn.microsoft.com/dotnet/standard/base-types/regular-expressions\nMirror: http://localhost:5000/api/health',
  },
  {
    title: 'GUID',
    pattern: String.raw`[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}`,
    testInput:
      'TenantId: 3f2504e0-4f89-11d3-9a0c-0305e82c3301\nCorrelationId: 7c9e6679-7425-40de-944b-e07fc1f90ae7\nNot a GUID: 1234-5678',
  },
  {
    title: 'IPv4 address',
    pattern: String.raw`\b(?:\d{1,3}\.){3}\d{1,3}\b`,
    testInput:
      'Gateway 192.168.0.1 forwards to 10.0.0.42.\nPublic address is 203.0.113.7, loopback is 127.0.0.1.',
  },
  {
    title: 'Swiss phone number',
    pattern: String.raw`\+41\s?(?<area>\d{2})\s?\d{3}\s?\d{2}\s?\d{2}`,
    testInput:
      'Reception: +41 44 668 18 00\nDirect line: +41791234567\nUK office: +44 20 7123 4567',
  },
  {
    title: 'Hex colour',
    pattern: String.raw`#(?<hex>[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b`,
    testInput:
      '--brand-primary: #1976D2;\n--brand-secondary: #9C27B0;\n--muted: #ccc;\nNot a colour: #12345',
  },
];

/** The pieces the "+ Add part" palette can splice into the pattern. */
export const REGEX_PALETTE: readonly RegexPaletteItem[] = [
  { label: 'digit', snippet: String.raw`\d` },
  { label: 'letter', snippet: '[A-Za-z]' },
  { label: 'word char', snippet: String.raw`\w` },
  { label: 'space', snippet: String.raw`\s` },
  { label: 'any char', snippet: '.' },
  { label: 'literal dash', snippet: '-' },
  { label: 'escaped dot', snippet: String.raw`\.` },
  { label: 'capture group', snippet: String.raw`(?<group>\w+)` },
  { label: 'alternation', snippet: '(?:a|b)' },
  // An appended `^` would never match, so this one goes to the front instead.
  { label: 'start of line', snippet: '^', prepend: true },
  { label: 'end of line', snippet: '$' },
];

export interface RegexOptionMeta {
  key: keyof RegexOptionsModel;
  label: string;
  hint: string;
}

export const REGEX_OPTION_META: readonly RegexOptionMeta[] = [
  {
    key: 'ignoreCase',
    label: 'IgnoreCase',
    hint: 'Matches letters regardless of upper or lower case.',
  },
  {
    key: 'multiline',
    label: 'Multiline',
    hint: '^ and $ match at every line break, not only at the ends of the input.',
  },
  {
    key: 'singleline',
    label: 'Singleline',
    hint: 'Lets . match line breaks as well.',
  },
  {
    key: 'ignorePatternWhitespace',
    label: 'IgnorePatternWhitespace',
    hint: 'Strips unescaped whitespace and # comments from the pattern itself.',
  },
  {
    key: 'explicitCapture',
    label: 'ExplicitCapture',
    hint: 'Only named groups capture; plain ( ) become non-capturing.',
  },
  {
    key: 'cultureInvariant',
    label: 'CultureInvariant',
    hint: 'Ignores culture-specific casing rules when comparing.',
  },
  {
    key: 'rightToLeft',
    label: 'RightToLeft',
    hint: 'Searches from right to left, starting at the end of the input.',
  },
  {
    key: 'nonBacktracking',
    label: 'NonBacktracking',
    hint: 'Linear-time matching that cannot blow up, but rejects lookaround and backreferences.',
  },
];

/** The quantifier choices on a selected part's control bar. */
export const QUANTIFIER_CHOICES: readonly { label: string; value: string }[] = [
  { label: 'once', value: '' },
  { label: '?', value: '?' },
  { label: '+', value: '+' },
  { label: '*', value: '*' },
  { label: '{2}', value: '{2}' },
];
