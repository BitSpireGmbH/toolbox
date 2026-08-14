import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CodeBlockComponent } from '../shared/code-block/code-block.component';
import { RegexExplainService, RegexPart, RegexRange } from '../services/regex-explain.service';
import {
  RegexCodeStyle,
  RegexOptionsModel,
  RegexTesterService,
} from '../services/regex-tester.service';
import { MatchDetailsPanelComponent } from './match-details-panel';
import { PatternChainComponent } from './pattern-chain';
import {
  REGEX_EXAMPLES,
  REGEX_OPTION_META,
  RegexExample,
} from './regex-examples.const';
import { TestTextPanelComponent } from './test-text-panel';

const NO_OPTIONS: RegexOptionsModel = {
  ignoreCase: false,
  multiline: false,
  singleline: false,
  ignorePatternWhitespace: false,
  explicitCapture: false,
  cultureInvariant: false,
  rightToLeft: false,
};

/**
 * A fixed-height application frame rather than a scrolling page: the generated
 * C# is the reason to open this tool, so it lives in a rail that never scrolls
 * out of view. Below 1100px none of that applies and the tool falls back to
 * normal document flow - the shell puts a bar over the top of mobile content,
 * which a full-height frame would fight.
 */
@Component({
  selector: 'app-regex-tester',
  imports: [
    CodeBlockComponent,
    MatchDetailsPanelComponent,
    PatternChainComponent,
    TestTextPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-[1100px]:h-full',
    '(document:keydown.escape)': 'selectedStart.set(null)',
  },
  template: `
    <div class="flex flex-col gap-4 p-4 min-[1100px]:h-full min-[1100px]:overflow-hidden md:p-6">
      <!-- Header -->
      <div class="flex shrink-0 flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 class="mb-1 text-2xl font-bold text-gray-900">Regex Tester</h1>
          <p class="text-sm text-gray-600">
            Test .NET regular expressions with live matches and ready-to-use C# code
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            (click)="toggleStrip('examples')"
            [class]="strip() === 'examples' ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'"
            class="flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition-all">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <line x1="9" y1="4" x2="9" y2="20" />
            </svg>
            Examples
          </button>

          <button
            type="button"
            (click)="toggleStrip('options')"
            [class]="strip() === 'options' ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'"
            class="flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition-all">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
            </svg>
            RegexOptions
            @if (optionCount() > 0) {
              <span
                [class]="strip() === 'options' ? 'bg-white/25 text-white' : 'bg-brand-primary text-white'"
                class="rounded-full px-1.5 text-xs font-semibold">{{ optionCount() }}</span>
            }
          </button>
        </div>
      </div>

      <!-- Strip: full width so neither panel squeezes the work column -->
      @if (strip() === 'examples') {
        <div class="shrink-0 rounded-xl border border-gray-200 bg-linear-to-br from-white to-gray-50 p-4 shadow-sm">
          <p class="mb-3 text-xs font-semibold tracking-wide text-gray-400 uppercase">
            Ready-made patterns — each loads its own sample text
          </p>
          <div class="grid grid-cols-2 gap-2 lg:grid-cols-4 xl:grid-cols-7">
            @for (example of examples; track example.title) {
              <button
                type="button"
                (click)="loadExample(example)"
                class="cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2 text-left transition-all hover:border-brand-primary hover:shadow-sm">
                <span class="block text-sm font-medium text-gray-900">{{ example.title }}</span>
                <span class="block truncate font-mono text-[11px] text-gray-500">{{ example.pattern }}</span>
              </button>
            }
          </div>
        </div>
      }

      @if (strip() === 'options') {
        <div class="shrink-0 rounded-xl border border-gray-200 bg-linear-to-br from-white to-gray-50 p-4 shadow-sm">
          <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            @for (option of optionMeta; track option.key) {
              <label class="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-100">
                <input
                  type="checkbox"
                  [checked]="options()[option.key]"
                  (change)="setOption(option.key, $any($event.target).checked)"
                  class="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-2 focus:ring-brand-primary" />
                <span>
                  <span class="block text-xs font-semibold text-gray-800">
                    {{ option.label }}
                    @if (option.codegenOnly) {
                      <span class="font-normal text-gray-400">(codegen only)</span>
                    }
                  </span>
                  <span class="block text-[11px] leading-snug text-gray-500">{{ option.hint }}</span>
                </span>
              </label>
            }
          </div>
        </div>
      }

      <!-- Work column + output zone -->
      <div class="flex min-h-0 flex-1 flex-col gap-4 min-[1100px]:flex-row min-[1100px]:overflow-hidden">
        <div class="flex min-w-0 flex-1 flex-col gap-4 min-[1100px]:min-h-0 min-[1100px]:overflow-y-auto">
          <!-- Pattern + chain + tips -->
          <div class="shrink-0 rounded-xl border border-gray-200 bg-white p-4 shadow-md">
            <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <h3 class="text-xs font-semibold tracking-wide text-gray-500 uppercase">Pattern</h3>
                <span
                  class="rounded-md px-1.5 py-0.5 text-xs font-medium"
                  [class]="evaluation().error ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'">
                  {{ evaluation().error ? 'invalid' : 'valid' }}
                </span>
              </div>
              <span class="text-xs text-gray-500">
                Hover a part to see what it matched · click it to change it
              </span>
            </div>

            <div class="relative">
              <div class="pattern-layer pointer-events-none absolute inset-0" aria-hidden="true" [innerHTML]="patternHighlight()"></div>
              <input
                [value]="pattern()"
                (input)="pattern.set($any($event.target).value)"
                (scroll)="syncPatternScroll($event)"
                type="text"
                spellcheck="false"
                aria-label="Regular expression pattern"
                placeholder="e.g. (?&lt;year&gt;\\d{4})-(?&lt;month&gt;\\d{2})-(?&lt;day&gt;\\d{2})"
                class="pattern-input relative w-full rounded-lg border border-gray-300 bg-transparent text-gray-900 focus:ring-2 focus:ring-brand-primary focus:outline-none" />
            </div>

            @if (parts().length > 0) {
              <div class="mt-3">
                <app-pattern-chain
                  [pattern]="pattern()"
                  [parts]="parts()"
                  [selected]="selectedPart()"
                  (patternChange)="pattern.set($event)"
                  (hoveredPart)="hoveredPart.set($event)"
                  (selectedChange)="selectedStart.set($event?.start ?? null)" />
              </div>
            }

            @if (parseResult().truncated) {
              <p class="mt-2 text-xs text-gray-400">
                Pattern is very long — only the first part of the chain is shown.
              </p>
            }

            @if (tips().length > 0) {
              <div class="mt-3 flex flex-col gap-1.5">
                @for (tip of visibleTips(); track tip.text) {
                  <div
                    class="flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"
                    [class]="tipStyle(tip.kind)">
                    <span aria-hidden="true">{{ tip.kind === 'error' ? '✕' : tip.kind === 'warning' ? '!' : 'i' }}</span>
                    <span>{{ tip.text }}</span>
                  </div>
                }
                @if (tips().length > 2) {
                  <button
                    type="button"
                    (click)="tipsExpanded.set(!tipsExpanded())"
                    class="cursor-pointer self-start text-xs font-semibold text-brand-primary hover:underline">
                    {{ tipsExpanded() ? 'Show fewer' : '+' + (tips().length - 2) + ' more' }}
                  </button>
                }
              </div>
            }
          </div>

          <!-- Replacement, opt-in -->
          @if (showReplacement()) {
            <div class="shrink-0 rounded-xl border border-gray-200 bg-white p-4 shadow-md">
              <div class="mb-2 flex items-center justify-between gap-2">
                <h3 class="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                  Replacement <span class="font-normal normal-case">(JS syntax: $1, $&lt;name&gt;)</span>
                </h3>
                <button
                  type="button"
                  (click)="hideReplacement()"
                  class="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-700">
                  Remove
                </button>
              </div>
              <input
                [value]="replacement()"
                (input)="replacement.set($any($event.target).value)"
                type="text"
                spellcheck="false"
                aria-label="Replacement pattern"
                placeholder="e.g. $&lt;year&gt;/$&lt;month&gt;/$&lt;day&gt;"
                class="w-full rounded-lg border border-gray-300 bg-gray-50/50 px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none" />
            </div>
          } @else {
            <button
              type="button"
              (click)="showReplacement.set(true)"
              class="flex shrink-0 cursor-pointer items-center gap-1 self-start text-xs font-semibold text-brand-primary hover:text-brand-secondary">
              <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add replacement
            </button>
          }

          <app-test-text-panel
            class="h-80 min-[1100px]:h-auto min-[1100px]:min-h-64 min-[1100px]:flex-1"
            [text]="testInput()"
            [matches]="matchRanges()"
            [partRanges]="hoveredPartRanges()"
            [activeRange]="hoveredMatch()"
            (textChange)="testInput.set($event)" />

          <p class="flex shrink-0 flex-wrap justify-between gap-2 text-xs text-gray-400">
            <span>Preview runs on the browser engine · generated code targets .NET 7+</span>
            @if (selectedPart()) {
              <span>Esc clears the selected part</span>
            }
          </p>
        </div>

        <!-- Output zone: right rail on desktop, dock below 1100px -->
        <aside class="flex shrink-0 flex-col gap-4 min-[1100px]:min-h-0 min-[1100px]:w-[428px]">
          <div class="flex h-96 flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-md min-[1100px]:h-auto min-[1100px]:min-h-0 min-[1100px]:flex-3">
            <div class="flex shrink-0 items-center justify-between gap-2 border-b border-gray-700 bg-linear-to-r from-gray-800 to-gray-900 px-4 py-2.5">
              <div class="flex items-center gap-2">
                <h3 class="text-xs font-semibold tracking-wide text-gray-200 uppercase">C# output</h3>
                <span class="flex items-center gap-1 text-[11px] text-gray-500">
                  <span class="h-1.5 w-1.5 rounded-full bg-green-500"></span> live
                </span>
              </div>
              <button
                type="button"
                (click)="copyToClipboard()"
                class="flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold text-green-400 transition-all hover:bg-green-400/10">
                <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                {{ copied() ? 'Copied' : 'Copy' }}
              </button>
            </div>

            <div class="shrink-0 border-b border-gray-800 px-4 py-2">
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  (click)="codeStyle.set('source-generated')"
                  [class]="codeStyle() === 'source-generated' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'"
                  class="cursor-pointer rounded-md px-2 py-1 font-mono text-xs transition-colors">
                  [GeneratedRegex]
                </button>
                <button
                  type="button"
                  (click)="codeStyle.set('classic')"
                  [class]="codeStyle() === 'classic' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'"
                  class="cursor-pointer rounded-md px-2 py-1 font-mono text-xs transition-colors">
                  new Regex()
                </button>
              </div>

              @if (codeStyle() === 'source-generated') {
                <div class="mt-2 grid grid-cols-2 gap-2">
                  <label class="block">
                    <span class="mb-1 block text-[10px] font-semibold tracking-wide text-gray-500 uppercase">Class</span>
                    <input
                      [value]="className()"
                      (input)="className.set($any($event.target).value)"
                      placeholder="RegexPatterns"
                      class="w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 font-mono text-xs text-gray-100 focus:ring-2 focus:ring-brand-primary focus:outline-none" />
                  </label>
                  <label class="block">
                    <span class="mb-1 block text-[10px] font-semibold tracking-wide text-gray-500 uppercase">Method</span>
                    <input
                      [value]="methodName()"
                      (input)="methodName.set($any($event.target).value)"
                      placeholder="MyRegex"
                      class="w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 font-mono text-xs text-gray-100 focus:ring-2 focus:ring-brand-primary focus:outline-none" />
                  </label>
                </div>
              }
            </div>

            <app-code-block class="min-h-0 flex-1" [code]="outputCode()" heightClass="h-full" />
          </div>

          <app-match-details-panel
            class="h-80 min-[1100px]:h-auto min-[1100px]:min-h-0 min-[1100px]:flex-2"
            [matches]="evaluation().matches"
            (hoveredMatch)="hoveredMatch.set($event)" />

          @if (replacement()) {
            <div class="shrink-0 rounded-xl border border-gray-200 bg-white shadow-md">
              <div class="border-b border-gray-200 bg-linear-to-r from-gray-50 to-gray-100 px-4 py-2">
                <h3 class="text-xs font-semibold tracking-wide text-gray-500 uppercase">Replaced preview</h3>
              </div>
              <div class="max-h-40 overflow-auto p-3 font-mono text-xs break-words whitespace-pre-wrap text-gray-800">{{ replacedPreview().result }}</div>
            </div>
          }
        </aside>
      </div>
    </div>
  `,
  styles: [
    `
      /*
       * Same overlay pairing as the test-text panel: the tint layer sits behind
       * the field, so both must lay the pattern out identically or the tinted
       * slice slides off the characters it belongs to.
       */
      .pattern-layer,
      .pattern-input {
        padding: 0.625rem 0.75rem;
        border: 1px solid transparent;
        font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
        font-size: 0.9375rem;
        line-height: 1.5;
        white-space: pre;
      }

      .pattern-layer {
        overflow: hidden;
        color: transparent;
      }
    `,
  ],
})
export class RegexTesterComponent {
  private readonly regexService = inject(RegexTesterService);
  private readonly explain = inject(RegexExplainService);

  protected readonly examples = REGEX_EXAMPLES;
  protected readonly optionMeta = REGEX_OPTION_META;

  protected readonly pattern = signal<string>(REGEX_EXAMPLES[0].pattern);
  protected readonly testInput = signal<string>(REGEX_EXAMPLES[0].testInput);
  protected readonly replacement = signal<string>('');
  protected readonly showReplacement = signal<boolean>(false);

  protected readonly options = signal<RegexOptionsModel>(NO_OPTIONS);
  /** Which of the two strip panels is open, if either. */
  protected readonly strip = signal<'examples' | 'options' | null>(null);

  protected readonly codeStyle = signal<RegexCodeStyle>('source-generated');
  protected readonly className = signal<string>('RegexPatterns');
  protected readonly methodName = signal<string>('MyRegex');
  protected readonly copied = signal<boolean>(false);

  /** Selection survives a rewrite by offset, since the parts are rebuilt. */
  protected readonly selectedStart = signal<number | null>(null);
  protected readonly hoveredPart = signal<RegexPart | null>(null);
  protected readonly hoveredMatch = signal<RegexRange | null>(null);
  protected readonly tipsExpanded = signal<boolean>(false);

  protected readonly parseResult = computed(() => this.explain.parse(this.pattern()));
  protected readonly parts = computed(() => this.parseResult().parts);

  protected readonly evaluation = computed(() =>
    this.regexService.evaluate(this.pattern(), this.testInput(), this.options())
  );

  protected readonly replacedPreview = computed(() =>
    this.regexService.replacePreview(
      this.pattern(),
      this.testInput(),
      this.replacement(),
      this.options()
    )
  );

  protected readonly outputCode = computed(() =>
    this.regexService.generateCode(
      this.pattern(),
      this.options(),
      this.codeStyle(),
      this.className(),
      this.methodName()
    )
  );

  protected readonly tips = computed(() =>
    this.explain.buildTips(
      this.pattern(),
      this.parts(),
      this.evaluation(),
      this.testInput().length > 0
    )
  );

  protected readonly visibleTips = computed(() =>
    this.tipsExpanded() ? this.tips() : this.tips().slice(0, 2)
  );

  protected readonly optionCount = computed(
    () => Object.values(this.options()).filter(Boolean).length
  );

  protected readonly selectedPart = computed(() =>
    this.explain.findByStart(this.parts(), this.selectedStart())
  );

  protected readonly matchRanges = computed<RegexRange[]>(() =>
    this.evaluation().matches.map(match => ({ index: match.index, length: match.length }))
  );

  /** What the hovered part matched - or, with nothing hovered, the selected one. */
  protected readonly hoveredPartRanges = computed<RegexRange[]>(() => {
    const part = this.hoveredPart() ?? this.selectedPart();
    if (!part) return [];
    return this.explain.mapPart(this.pattern(), part, this.testInput(), this.options());
  });

  protected readonly patternHighlight = computed(() => {
    const pattern = this.pattern();
    if (!pattern) return '';

    const part = this.hoveredPart() ?? this.selectedPart();
    if (!part) return this.escapeHtml(pattern);

    return (
      this.escapeHtml(pattern.slice(0, part.start)) +
      `<span class="rounded-sm bg-blue-200">${this.escapeHtml(pattern.slice(part.start, part.end))}</span>` +
      this.escapeHtml(pattern.slice(part.end))
    );
  });

  protected toggleStrip(panel: 'examples' | 'options'): void {
    this.strip.update(current => (current === panel ? null : panel));
  }

  protected setOption(key: keyof RegexOptionsModel, value: boolean): void {
    this.options.update(current => ({ ...current, [key]: value }));
  }

  protected loadExample(example: RegexExample): void {
    this.pattern.set(example.pattern);
    this.testInput.set(example.testInput);
    this.selectedStart.set(null);
    this.hoveredPart.set(null);
  }

  protected hideReplacement(): void {
    this.replacement.set('');
    this.showReplacement.set(false);
  }

  protected tipStyle(kind: 'error' | 'warning' | 'info'): string {
    switch (kind) {
      case 'error':
        return 'bg-red-50 border-red-200 text-red-700';
      case 'warning':
        return 'bg-amber-50 border-amber-200 text-amber-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  }

  /** The tint layer only shows the right slice while it tracks the field. */
  protected syncPatternScroll(event: Event): void {
    const input = event.target as HTMLInputElement;
    const layer = input.previousElementSibling as HTMLElement | null;
    if (layer) {
      layer.scrollLeft = input.scrollLeft;
    }
  }

  protected async copyToClipboard(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.outputCode());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
