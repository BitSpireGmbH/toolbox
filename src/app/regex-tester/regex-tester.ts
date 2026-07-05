import { Component, signal, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  RegexTesterService,
  RegexOptionsModel,
  RegexCodeStyle,
} from '../services/regex-tester.service';

@Component({
  selector: 'app-regex-tester',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-7xl mx-auto p-6">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-1">Regex Tester</h1>
          <p class="text-sm text-gray-600">Test .NET regular expressions with live matches and ready-to-use C# code</p>
        </div>

        <button
          (click)="showOptions.set(!showOptions())"
          [class]="showOptions() ? 'bg-brand-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
          class="px-4 py-2 rounded-lg border border-gray-300 font-medium text-sm transition-all flex items-center gap-2 shadow-sm cursor-pointer">
          <svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
          </svg>
          RegexOptions
        </button>
      </div>

      <!-- RegexOptions Panel -->
      @if (showOptions()) {
        <div class="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg border border-gray-200 p-5 mb-6">
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <label class="flex items-center gap-2 cursor-pointer px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors">
              <input
                type="checkbox"
                [checked]="ignoreCase()"
                (change)="ignoreCase.set($any($event.target).checked)"
                class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-2 focus:ring-brand-primary">
              <span class="text-xs font-medium text-gray-700">IgnoreCase</span>
            </label>

            <label class="flex items-center gap-2 cursor-pointer px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors">
              <input
                type="checkbox"
                [checked]="multiline()"
                (change)="multiline.set($any($event.target).checked)"
                class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-2 focus:ring-brand-primary">
              <span class="text-xs font-medium text-gray-700">Multiline</span>
            </label>

            <label class="flex items-center gap-2 cursor-pointer px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors">
              <input
                type="checkbox"
                [checked]="singleline()"
                (change)="singleline.set($any($event.target).checked)"
                class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-2 focus:ring-brand-primary">
              <span class="text-xs font-medium text-gray-700">Singleline</span>
            </label>

            <label class="flex items-center gap-2 cursor-pointer px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors">
              <input
                type="checkbox"
                [checked]="ignorePatternWhitespace()"
                (change)="ignorePatternWhitespace.set($any($event.target).checked)"
                class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-2 focus:ring-brand-primary">
              <span class="text-xs font-medium text-gray-700">IgnorePatternWhitespace <span class="text-gray-400">(codegen only)</span></span>
            </label>

            <label class="flex items-center gap-2 cursor-pointer px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors">
              <input
                type="checkbox"
                [checked]="explicitCapture()"
                (change)="explicitCapture.set($any($event.target).checked)"
                class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-2 focus:ring-brand-primary">
              <span class="text-xs font-medium text-gray-700">ExplicitCapture <span class="text-gray-400">(codegen only)</span></span>
            </label>

            <label class="flex items-center gap-2 cursor-pointer px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors">
              <input
                type="checkbox"
                [checked]="cultureInvariant()"
                (change)="cultureInvariant.set($any($event.target).checked)"
                class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-2 focus:ring-brand-primary">
              <span class="text-xs font-medium text-gray-700">CultureInvariant <span class="text-gray-400">(codegen only)</span></span>
            </label>

            <label class="flex items-center gap-2 cursor-pointer px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors">
              <input
                type="checkbox"
                [checked]="rightToLeft()"
                (change)="rightToLeft.set($any($event.target).checked)"
                class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-2 focus:ring-brand-primary">
              <span class="text-xs font-medium text-gray-700">RightToLeft <span class="text-gray-400">(codegen only)</span></span>
            </label>
          </div>
        </div>
      }

      <!-- Pattern -->
      <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden mb-3">
        <div class="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2.5 border-b border-gray-200">
          <h3 class="font-semibold text-sm text-gray-700">Pattern</h3>
        </div>
        <div class="p-4">
          <input
            [(ngModel)]="pattern"
            type="text"
            spellcheck="false"
            placeholder="e.g. (?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})"
            class="w-full px-3 py-2 font-mono text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary bg-gray-50/50">
        </div>
      </div>

      <!-- Replacement (opt-in, not the default use case) -->
      @if (showReplacement()) {
        <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden mb-5">
          <div class="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
            <h3 class="font-semibold text-sm text-gray-700">Replacement <span class="text-gray-400 font-normal">(JS syntax: $1, $&lt;name&gt;)</span></h3>
            <button
              (click)="hideReplacement()"
              class="text-xs text-gray-500 hover:text-gray-700 font-medium cursor-pointer">
              Remove
            </button>
          </div>
          <div class="p-4">
            <input
              [(ngModel)]="replacement"
              type="text"
              spellcheck="false"
              placeholder="e.g. $<year>/$<month>/$<day>"
              class="w-full px-3 py-2 font-mono text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary bg-gray-50/50">
          </div>
        </div>
      } @else {
        <button
          (click)="showReplacement.set(true)"
          class="mb-5 px-3 py-1.5 text-xs font-semibold text-brand-primary hover:text-brand-secondary flex items-center gap-1 cursor-pointer">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add replacement pattern
        </button>
      }

      @if (evaluation().error) {
        <div class="mb-5 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <span class="font-semibold">Pattern error:</span> {{ evaluation().error }}
        </div>
      } @else if (evaluation().engineWarning) {
        <div class="mb-5 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          {{ evaluation().engineWarning }}
        </div>
      }

      <!-- Test Input + Live Preview -->
      <div class="grid md:grid-cols-2 gap-5 mb-5">
        <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div class="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
            <h3 class="font-semibold text-sm text-gray-700">Test String</h3>
            <span class="text-xs text-gray-500">{{ testInput().length }} chars</span>
          </div>
          <textarea
            [(ngModel)]="testInput"
            spellcheck="false"
            class="w-full h-64 p-4 font-mono text-sm focus:outline-none resize-none bg-gray-50/50"
            placeholder="Paste text to test the pattern against..."
          ></textarea>
        </div>

        <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div class="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
            <h3 class="font-semibold text-sm text-gray-700">Matches</h3>
            <span class="text-xs text-gray-500">{{ evaluation().matches.length }} found</span>
          </div>
          <div class="h-64 overflow-auto p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words" [innerHTML]="highlightedPreview()"></div>
        </div>
      </div>

      @if (replacement()) {
        <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden mb-5">
          <div class="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2.5 border-b border-gray-200">
            <h3 class="font-semibold text-sm text-gray-700">Replaced Preview</h3>
          </div>
          <div class="p-4 font-mono text-sm whitespace-pre-wrap break-words text-gray-800">{{ replacedPreview().result }}</div>
        </div>
      }

      @if (evaluation().matches.length > 0) {
        <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden mb-5">
          <div class="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2.5 border-b border-gray-200">
            <h3 class="font-semibold text-sm text-gray-700">Match Details</h3>
          </div>
          <div class="max-h-72 overflow-auto divide-y divide-gray-100">
            @for (match of evaluation().matches; let i = $index; track i) {
              <div class="px-4 py-3">
                <div class="flex items-center justify-between mb-1">
                  <span class="font-mono text-sm text-gray-900">{{ match.value }}</span>
                  <span class="text-xs text-gray-500">index {{ match.index }}, length {{ match.length }}</span>
                </div>
                @if (match.groups.length > 0) {
                  <div class="flex flex-wrap gap-2 mt-1">
                    @for (group of match.groups; track group.name) {
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-xs font-mono text-gray-700">
                        <span class="text-brand-primary font-semibold">{{ group.name }}:</span> {{ group.value }}
                      </span>
                    }
                  </div>
                }
              </div>
            }
          </div>
        </div>
      }

      <!-- Code Style Toggle -->
      <div class="flex flex-wrap items-center gap-2 mb-5">
        <button
          (click)="codeStyle.set('source-generated')"
          [class]="codeStyle() === 'source-generated' ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'"
          class="px-4 py-2 rounded-lg border font-medium text-sm transition-all cursor-pointer">
          .NET 7+ Source-Generated
        </button>
        <button
          (click)="codeStyle.set('classic')"
          [class]="codeStyle() === 'classic' ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'"
          class="px-4 py-2 rounded-lg border font-medium text-sm transition-all cursor-pointer">
          Classic new Regex()
        </button>

        @if (codeStyle() === 'source-generated') {
          <div class="flex items-center gap-2 ml-0 sm:ml-2">
            <input
              [(ngModel)]="className"
              type="text"
              placeholder="RegexPatterns"
              class="w-36 px-2 py-1.5 text-xs font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary">
            <input
              [(ngModel)]="methodName"
              type="text"
              placeholder="MyRegex"
              class="w-32 px-2 py-1.5 text-xs font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary">
          </div>
        }
      </div>

      <!-- Output Panel -->
      <div class="bg-gray-900 rounded-xl shadow-md border border-gray-700 overflow-hidden">
        <div class="bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-2.5 border-b border-gray-700 flex justify-between items-center">
          <div class="flex items-center gap-2">
            <div class="w-1.5 h-1.5 rounded-full bg-green-500"></div>
            <h3 class="font-semibold text-sm text-gray-200">C# Output</h3>
          </div>
          <button
            (click)="copyToClipboard()"
            class="px-3 py-1 rounded-md text-xs font-semibold transition-all text-green-400 hover:bg-green-400/10 cursor-pointer">
            <span class="flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copy
            </span>
          </button>
        </div>
        <textarea
          [value]="outputCode()"
          class="w-full h-64 p-4 font-mono text-sm text-green-400 focus:outline-none resize-none bg-gray-900"
          readonly
        ></textarea>
      </div>
    </div>
  `,
  styles: [],
})
export class RegexTesterComponent {
  private readonly regexService = inject(RegexTesterService);

  protected readonly pattern = signal<string>(String.raw`(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})`);
  protected readonly testInput = signal<string>(
    'Order #1024 shipped on 2024-03-15.\nFollow-up scheduled for 2024-04-02.'
  );
  protected readonly replacement = signal<string>('');
  protected readonly showReplacement = signal<boolean>(false);

  protected readonly ignoreCase = signal<boolean>(false);
  protected readonly multiline = signal<boolean>(false);
  protected readonly singleline = signal<boolean>(false);
  protected readonly ignorePatternWhitespace = signal<boolean>(false);
  protected readonly explicitCapture = signal<boolean>(false);
  protected readonly cultureInvariant = signal<boolean>(false);
  protected readonly rightToLeft = signal<boolean>(false);
  protected readonly showOptions = signal<boolean>(true);

  protected readonly codeStyle = signal<RegexCodeStyle>('source-generated');
  protected readonly className = signal<string>('RegexPatterns');
  protected readonly methodName = signal<string>('MyRegex');

  private readonly options = computed<RegexOptionsModel>(() => ({
    ignoreCase: this.ignoreCase(),
    multiline: this.multiline(),
    singleline: this.singleline(),
    ignorePatternWhitespace: this.ignorePatternWhitespace(),
    explicitCapture: this.explicitCapture(),
    cultureInvariant: this.cultureInvariant(),
    rightToLeft: this.rightToLeft(),
  }));

  protected readonly evaluation = computed(() =>
    this.regexService.evaluate(this.pattern(), this.testInput(), this.options())
  );

  protected readonly replacedPreview = computed(() =>
    this.regexService.replacePreview(this.pattern(), this.testInput(), this.replacement(), this.options())
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

  protected readonly highlightedPreview = computed(() => {
    const text = this.testInput();
    const { matches } = this.evaluation();

    if (!text) {
      return '<span class="text-gray-400">Nothing to match yet…</span>';
    }
    if (matches.length === 0) {
      return this.escapeHtml(text);
    }

    let result = '';
    let cursor = 0;
    for (const match of matches) {
      if (match.index < cursor) continue;
      result += this.escapeHtml(text.slice(cursor, match.index));
      result += `<mark class="bg-amber-300/70 text-gray-900 rounded px-0.5">${this.escapeHtml(match.value)}</mark>`;
      cursor = match.index + match.length;
    }
    result += this.escapeHtml(text.slice(cursor));
    return result;
  });

  protected hideReplacement(): void {
    this.replacement.set('');
    this.showReplacement.set(false);
  }

  protected async copyToClipboard(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.outputCode());
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
