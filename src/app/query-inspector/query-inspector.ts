import { Component, signal, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { QueryInspectorService, type SegmentKind } from '../services/query-inspector.service';

const SAMPLE_URL =
  'https://api.example.com:8443/v1/orders?page=2&sort=created%20desc&filter=%7B%22status%22%3A%5B%22open%22%2C%22paid%22%5D%2C%22total%22%3A%7B%22gt%22%3A100%7D%7D&tag=a+b#results';

/**
 * One style per URL part, shared by the input overlay, the legend, the parts panel, and the parameter rows.
 * Hue alone fails for colorblind readers, so parts also differ by tint vs. none, lightness, and underline:
 * keys are the only bright chip and values are the only untinted text. Text on every chip stays above 7:1 contrast.
 * No padding or font weight here - the overlay must keep each character exactly where the textarea puts it.
 */
const COLORS: Record<SegmentKind, string> = {
  plain: '',
  separator: 'text-gray-600',
  scheme: 'bg-purple-300 text-purple-950 rounded-sm',
  auth: 'bg-pink-300 text-pink-950 rounded-sm',
  host: 'bg-sky-300 text-sky-950 rounded-sm underline decoration-2 underline-offset-2',
  port: 'bg-teal-300 text-teal-950 rounded-sm',
  path: 'bg-gray-300 text-gray-950 rounded-sm',
  key: 'bg-amber-400 text-amber-950 rounded-sm',
  value: 'text-gray-950',
  fragment: 'bg-fuchsia-300 text-fuchsia-950 rounded-sm underline decoration-dotted decoration-2 underline-offset-2',
};

const LEGEND: { label: string; kind: SegmentKind }[] = [
  { label: 'scheme', kind: 'scheme' },
  { label: 'user', kind: 'auth' },
  { label: 'host', kind: 'host' },
  { label: 'port', kind: 'port' },
  { label: 'path', kind: 'path' },
  { label: 'key', kind: 'key' },
  { label: 'value', kind: 'value' },
  { label: 'fragment', kind: 'fragment' },
];

interface Draft {
  index: number;
  text: string;
  json: boolean;
}

@Component({
  selector: 'app-query-inspector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-7xl mx-auto p-6">
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 mb-1">Query String Inspector</h1>
        <p class="text-sm text-gray-600">
          Paste a full URL or just a query string. See every part decoded, edit or remove parameters, and copy the
          re-encoded result. JSON values are pretty-printed for editing and minified back into the URL.
        </p>
      </div>

      <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden mb-6">
        <div class="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between gap-2">
          <label for="query-input" class="font-semibold text-sm text-gray-700">URL or query string</label>
          <div class="flex items-center gap-1">
            <button (click)="setInput(sample)" class="px-3 py-1 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-200 cursor-pointer">Sample</button>
            <button (click)="setInput('')" class="px-3 py-1 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-200 cursor-pointer">Clear</button>
            <button (click)="copy(builtUrl(), 'url')" class="px-3 py-1 rounded-md text-xs font-semibold text-brand-primary hover:bg-brand-primary/10 cursor-pointer">
              {{ copied() === 'url' ? 'Copied!' : 'Copy URL' }}
            </button>
          </div>
        </div>
        <div class="grid bg-gray-50/50">
          <pre aria-hidden="true" class="overlay pointer-events-none m-0 text-gray-900">@for (s of segments(); track $index) {<span [class]="s.color">{{ s.text }}</span>}<br></pre>
          <textarea
            id="query-input"
            [value]="input()"
            (input)="setInput($any($event.target).value)"
            spellcheck="false"
            rows="3"
            [class]="input() ? 'text-transparent' : 'text-gray-900'"
            class="overlay resize-none overflow-hidden bg-transparent caret-gray-900 placeholder:text-gray-500 focus:outline-none"
            placeholder="https://example.com/path?a=1&b=2  or  a=1&b=2"
          ></textarea>
        </div>
        <ul class="flex flex-wrap gap-x-3 gap-y-1 px-4 py-2 border-t border-gray-200 text-xs font-mono" aria-label="Color legend">
          @for (item of legend; track item.kind) {
            <li class="px-1" [class]="colors[item.kind]">{{ item.label }}</li>
          }
        </ul>
      </div>

      @if (parsed().url; as url) {
        <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden mb-6">
          <h2 class="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2.5 border-b border-gray-200 font-semibold text-sm text-gray-700">URL parts</h2>
          <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 p-4 text-sm">
            <dt class="text-gray-500">Scheme</dt><dd class="font-mono break-all w-fit px-1" [class]="colors.scheme">{{ url.scheme }}</dd>
            @if (url.username) {
              <dt class="text-gray-500">User</dt><dd class="font-mono break-all w-fit px-1" [class]="colors.auth">{{ url.username }}{{ url.password ? ':' + url.password : '' }}</dd>
            }
            <dt class="text-gray-500">Host</dt><dd class="font-mono break-all w-fit px-1" [class]="colors.host">{{ url.host }}</dd>
            @if (url.port) {
              <dt class="text-gray-500">Port</dt><dd class="font-mono w-fit px-1" [class]="colors.port">{{ url.port }}</dd>
            }
            <dt class="text-gray-500">Path</dt><dd class="font-mono break-all w-fit px-1" [class]="colors.path">{{ url.path }}</dd>
            @if (url.fragment) {
              <dt class="text-gray-500">Fragment</dt><dd class="font-mono break-all w-fit px-1" [class]="colors.fragment">{{ url.fragment }}</dd>
            }
          </dl>
        </div>
      } @else if (parsed().prefix) {
        <div class="bg-white rounded-xl shadow-md border border-gray-200 p-4 mb-6 text-sm">
          <span class="text-gray-500 mr-4">Path</span><span class="font-mono break-all px-1" [class]="colors.path">{{ parsed().prefix }}</span>
        </div>
      }

      <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <h2 class="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2.5 border-b border-gray-200 font-semibold text-sm text-gray-700">
          Query parameters ({{ rows().length }})
        </h2>
        @for (row of rows(); track $index; let i = $index) {
          <div class="p-4 border-b border-gray-100 last:border-b-0">
            <div class="flex flex-wrap items-center gap-2 mb-2">
              <span class="font-mono font-semibold break-all px-1" [class]="colors.key">{{ row.key }}</span>
              @if (row.isJson) {
                @if (row.jsonError) {
                  <span class="px-2 py-0.5 rounded-full text-xs font-semibold border border-red-700 bg-red-50 text-red-800">&#10007; Invalid JSON</span>
                } @else {
                  <span class="px-2 py-0.5 rounded-full text-xs font-semibold border border-green-700 bg-green-50 text-green-800">&#10003; Valid JSON</span>
                }
              }
              <span class="ml-auto flex items-center gap-1">
                <button (click)="copy(row.value, 'v' + i)" class="px-2 py-1 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer">
                  {{ copied() === 'v' + i ? 'Copied!' : 'Copy decoded' }}
                </button>
                <button (click)="copy(row.encoded, 'e' + i)" class="px-2 py-1 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer">
                  {{ copied() === 'e' + i ? 'Copied!' : 'Copy encoded' }}
                </button>
                <button (click)="remove(i)" [attr.aria-label]="'Remove parameter ' + row.key" class="px-2 py-1 rounded-md text-xs font-semibold text-red-700 hover:bg-red-50 cursor-pointer">
                  Remove
                </button>
              </span>
            </div>
            @if (row.isJson) {
              <textarea
                [value]="row.text"
                (input)="edit(i, $any($event.target).value, true)"
                (blur)="draft.set(null)"
                [rows]="row.lines"
                spellcheck="false"
                [attr.aria-label]="'JSON value of ' + row.key"
                class="w-full p-2 font-mono text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary resize-y"
                [class]="colors.value"
              ></textarea>
              @if (row.jsonError) {
                <p class="mt-1 text-xs text-red-800" role="status">{{ row.jsonError }}</p>
              }
            } @else {
              <input
                type="text"
                [value]="row.text"
                (input)="edit(i, $any($event.target).value, false)"
                (blur)="draft.set(null)"
                spellcheck="false"
                [attr.aria-label]="'Value of ' + row.key"
                class="w-full px-2 py-1.5 font-mono text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                [class]="colors.value">
            }
            <p class="mt-1 font-mono text-xs text-gray-500 break-all">{{ row.encoded }}</p>
          </div>
        } @empty {
          <p class="p-4 text-sm text-gray-500">No query parameters found.</p>
        }
      </div>
    </div>
  `,
  styles: [
    `
      /* Overlay and textarea share one grid cell and must lay text out identically, or the caret drifts off its character. */
      .overlay {
        grid-area: 1 / 1;
        padding: 1rem;
        font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
        font-size: 0.875rem;
        line-height: 1.625;
        white-space: pre-wrap;
        word-break: break-all;
      }
    `,
  ],
})
export class QueryInspectorComponent {
  private readonly service = inject(QueryInspectorService);

  protected readonly colors = COLORS;
  protected readonly legend = LEGEND;
  protected readonly sample = SAMPLE_URL;
  protected readonly input = signal(SAMPLE_URL);
  protected readonly copied = signal('');
  /**
   * The text of the control being typed into. Without it, every keystroke would re-render that control from the
   * re-parsed URL: valid JSON gets re-pretty-printed under the caret, and half-typed JSON flips the textarea into
   * a plain input.
   */
  protected readonly draft = signal<Draft | null>(null);

  protected readonly parsed = computed(() => this.service.parse(this.input()));
  protected readonly builtUrl = computed(() => this.service.build(this.parsed()));
  protected readonly segments = computed(() =>
    this.service.segments(this.input()).map(s => ({ text: s.text, color: COLORS[s.kind] }))
  );
  protected readonly rows = computed(() => {
    const draft = this.draft();
    return this.parsed().params.map((p, i) => {
      const editing = draft?.index === i ? draft : null;
      const isJson = editing ? editing.json : p.json !== undefined || p.jsonError !== null;
      const text = editing ? editing.text : p.json !== undefined ? JSON.stringify(p.json, null, 2) : p.value;
      const eq = p.raw.indexOf('=');
      return {
        ...p,
        isJson,
        text,
        lines: Math.min(text.split('\n').length, 16),
        encoded: eq < 0 ? '' : p.raw.slice(eq + 1),
      };
    });
  });

  protected setInput(value: string): void {
    this.draft.set(null);
    this.input.set(value);
  }

  protected remove(index: number): void {
    const parsed = this.parsed();
    this.setInput(this.service.build({ ...parsed, params: parsed.params.filter((_, i) => i !== index) }));
  }

  protected edit(index: number, value: string, json: boolean): void {
    const parsed = this.parsed();
    const params = parsed.params.map((p, i) => (i === index ? this.service.withValue(p, value) : p));
    this.input.set(this.service.build({ ...parsed, params }));
    this.draft.set({ index, text: value, json });
  }

  protected async copy(text: string, key: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(key);
      setTimeout(() => this.copied.set(''), 1500);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }
}
