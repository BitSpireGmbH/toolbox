import { Component, ChangeDetectionStrategy, computed, inject, input } from '@angular/core';
import { CodeHighlightService, HighlightLanguage } from '../../services/code-highlight.service';

/**
 * The dark, syntax-highlighted panel every tool uses to show generated code.
 *
 * Replaces the readonly <textarea> the tools used to render output into: a
 * textarea cannot carry token markup, so generated C# was previously a flat
 * wall of one colour.
 *
 * The `language-*` class on <code> is what the global Prism rules in
 * styles.css hook onto - without it tokens fall back to the inherited body
 * colour, which is near-black on these dark panels.
 */
@Component({
  selector: 'app-code-block',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Kept on one line: <pre> preserves whitespace, so any indentation added for
  // readability would show up as leading blanks in the rendered code. The
  // [innerHTML] must also sit directly on <code> - binding it to a wrapper
  // <span> inside the @if rendered once and then never updated again.
  template: `
    <pre tabindex="0" [class]="heightClass()" class="m-0 p-4 font-mono text-sm leading-relaxed overflow-auto bg-gray-900">@if (code()) {<code [class]="'language-' + language()" [innerHTML]="highlighted()"></code>}@else {<code [class]="error() ? 'text-red-400' : 'text-gray-500'">{{ placeholder() }}</code>}</pre>
  `,
})
export class CodeBlockComponent {
  readonly code = input<string>('');
  readonly language = input<HighlightLanguage>('csharp');
  /** Shown when `code` is empty - usually a hint or the current error. */
  readonly placeholder = input<string>('');
  /** Renders the placeholder in red, for tools that surface parse errors there. */
  readonly error = input<boolean>(false);
  /** Tailwind height/sizing classes, e.g. 'h-[500px] md:h-[600px]'. */
  readonly heightClass = input<string>('');

  private readonly highlighter = inject(CodeHighlightService);

  protected readonly highlighted = computed(() =>
    this.highlighter.highlight(this.code(), this.language())
  );
}
