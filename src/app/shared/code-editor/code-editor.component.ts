import { Component, ChangeDetectionStrategy, computed, inject, input, output } from '@angular/core';
import { CodeHighlightService, HighlightLanguage } from '../../services/code-highlight.service';

/**
 * An editable code pane that is still syntax-highlighted.
 *
 * A <textarea> cannot render token markup, so this uses the overlay technique
 * already established by the SRP Analyzer: a highlighted layer underneath, and
 * a transparent textarea on top that keeps native editing, selection, and the
 * caret. The two must stay pixel-identical, hence the shared typography and
 * padding below - any drift shows up immediately as a caret that misses its
 * character.
 *
 * Dark ground, same as app-code-block, so one Prism palette serves every code
 * surface in the toolbox and input matches output.
 */
@Component({
  selector: 'app-code-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative bg-gray-900" [class]="heightClass()">
      <pre
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 m-0 overflow-hidden"
      ><code [class]="'language-' + language()" [innerHTML]="highlighted()"></code></pre>

      <textarea
        [value]="code()"
        (input)="onInput($event)"
        (scroll)="onScroll($event)"
        [placeholder]="placeholder()"
        [attr.aria-label]="ariaLabel()"
        [class]="code() ? 'text-transparent' : 'text-gray-200'"
        class="absolute inset-0 h-full w-full resize-none border-0 bg-transparent caret-gray-100 placeholder:text-gray-500 focus:outline-none"
        spellcheck="false"
      ></textarea>
    </div>
  `,
  styles: [
    `
      /*
       * Both layers must lay text out identically. Declared together so the
       * two can never drift apart, and with a stable scrollbar gutter so the
       * textarea's scrollbar does not narrow its line box relative to the
       * highlight layer and shift every wrapped line.
       */
      pre,
      textarea {
        padding: 1rem;
        font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
        font-size: 0.875rem;
        line-height: 1.625;
        white-space: pre-wrap;
        overflow-wrap: break-word;
        tab-size: 4;
      }

      textarea {
        overflow: auto;
        scrollbar-gutter: stable;
      }

      pre {
        scrollbar-gutter: stable;
      }
    `,
  ],
})
export class CodeEditorComponent {
  readonly code = input<string>('');
  /**
   * Explicit one-way-in / event-out rather than model(), mirroring the
   * [value] + (input) pairing the other tools use. A model() here fed a stale
   * value back into the parent's signal mid-change-detection, which silently
   * reverted the input and stopped the conversion effect from re-running.
   */
  readonly codeChange = output<string>();
  readonly language = input<HighlightLanguage>('csharp');
  readonly placeholder = input<string>('');
  readonly ariaLabel = input<string>('Code input');
  readonly heightClass = input<string>('');

  private readonly highlighter = inject(CodeHighlightService);

  protected readonly highlighted = computed(() =>
    this.highlighter.highlight(this.code(), this.language())
  );

  protected onInput(event: Event): void {
    this.codeChange.emit((event.target as HTMLTextAreaElement).value);
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
}
