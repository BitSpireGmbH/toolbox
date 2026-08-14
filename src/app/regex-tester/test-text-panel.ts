import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RegexRange } from '../services/regex-explain.service';

/** Strongest wins, so a hovered part still reads on top of its own match. */
const PLAIN_MATCH = 'bg-amber-200/70 border-b border-amber-400';
const ACTIVE_MATCH = 'bg-amber-300 border-b-2 border-amber-600';
const HOVERED_PART = 'bg-blue-300/80 border-b-2 border-blue-600';

/**
 * The test text and its matches, in one panel.
 *
 * These used to be two panels side by side showing the same string twice, once
 * editable and once highlighted. Merging them is what frees the vertical space
 * the output rail needs.
 *
 * Same overlay trick as `app-code-editor`, inverted: there the textarea is
 * transparent and the layer below carries the visible text, here the textarea's
 * own text stays visible and the layer contributes nothing but the highlight
 * rectangles behind it. Either way the two must lay text out identically, hence
 * the shared block in `styles` - any drift shows up as highlights sliding off
 * the characters they belong to.
 */
@Component({
  selector: 'app-test-text-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col' },
  template: `
    <div class="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-md">
      <div class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-linear-to-r from-gray-50 to-gray-100 px-4 py-2.5">
        <div class="flex items-center gap-2">
          <h3 class="text-xs font-semibold tracking-wide text-gray-500 uppercase">Test text</h3>
          <span
            class="rounded-md px-1.5 py-0.5 text-xs font-medium"
            [class]="matches().length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-600'">
            {{ matches().length }} {{ matches().length === 1 ? 'match' : 'matches' }}
          </span>
        </div>
        <span class="text-xs text-gray-500">
          {{ text().length }} characters · edit freely, matches update as you type
        </span>
      </div>

      <div class="relative min-h-0 flex-1">
        <div class="layer absolute inset-0" aria-hidden="true" [innerHTML]="highlighted()"></div>
        <textarea
          [value]="text()"
          (input)="onInput($event)"
          (scroll)="onScroll($event)"
          spellcheck="false"
          aria-label="Test text"
          placeholder="Paste text to test the pattern against…"
          class="absolute inset-0 h-full w-full resize-none border-0 bg-transparent text-gray-900 caret-gray-900 placeholder:text-gray-400 focus:outline-none"
        ></textarea>
      </div>
    </div>
  `,
  styles: [
    `
      /*
       * Declared together so the two layers can never drift apart, with a
       * stable scrollbar gutter on both - without it the textarea's scrollbar
       * narrows its line box and every wrapped line shifts out from under its
       * highlight.
       */
      .layer,
      textarea {
        padding: 1rem;
        font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
        font-size: 0.875rem;
        line-height: 1.625;
        white-space: pre-wrap;
        overflow-wrap: break-word;
        tab-size: 4;
        scrollbar-gutter: stable;
      }

      textarea {
        overflow: auto;
      }

      /* Behind the textarea, so it must contribute backgrounds and nothing else. */
      .layer {
        overflow: hidden;
        color: transparent;
      }
    `,
  ],
})
export class TestTextPanelComponent {
  readonly text = input<string>('');
  /** Every match in the text - the base highlight. */
  readonly matches = input<readonly RegexRange[]>([]);
  /** What the part currently hovered in the chain matched. */
  readonly partRanges = input<readonly RegexRange[]>([]);
  /** The match whose row is hovered in Match details. */
  readonly activeRange = input<RegexRange | null>(null);

  readonly textChange = output<string>();

  /**
   * Ranges overlap - a hovered part sits inside its match, and a hovered row
   * repeats one of the matches. Rather than nesting elements, the text is cut
   * at every range boundary and each resulting slice takes the class of the
   * strongest range covering it. One span per slice, no nesting to get wrong.
   */
  protected readonly highlighted = computed(() => {
    const text = this.text();
    if (!text) return '';

    const layers: { ranges: readonly RegexRange[]; className: string }[] = [
      { ranges: this.matches(), className: PLAIN_MATCH },
      { ranges: this.activeRange() ? [this.activeRange() as RegexRange] : [], className: ACTIVE_MATCH },
      { ranges: this.partRanges(), className: HOVERED_PART },
    ];

    const cuts = new Set<number>([0, text.length]);
    for (const layer of layers) {
      for (const range of layer.ranges) {
        cuts.add(Math.max(0, Math.min(range.index, text.length)));
        cuts.add(Math.max(0, Math.min(range.index + range.length, text.length)));
      }
    }

    const points = [...cuts].sort((a, b) => a - b);
    let html = '';
    for (let i = 0; i < points.length - 1; i++) {
      const [from, to] = [points[i], points[i + 1]];
      if (from === to) continue;
      const slice = this.escapeHtml(text.slice(from, to));

      // Later layers win, so walk them in order and keep the last hit.
      let className = '';
      for (const layer of layers) {
        if (layer.ranges.some(range => range.index <= from && from < range.index + range.length)) {
          className = layer.className;
        }
      }

      html += className ? `<span class="${className}">${slice}</span>` : slice;
    }

    // A pre-wrap block swallows a trailing newline, which would leave the last
    // line of a text that ends in one sitting a row too high.
    return `${html}\n`;
  });

  protected onInput(event: Event): void {
    this.textChange.emit((event.target as HTMLTextAreaElement).value);
  }

  /** Keeps the highlight layer locked to whatever the textarea scrolled to. */
  protected onScroll(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    const layer = textarea.previousElementSibling as HTMLElement | null;
    if (layer) {
      layer.scrollTop = textarea.scrollTop;
      layer.scrollLeft = textarea.scrollLeft;
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
