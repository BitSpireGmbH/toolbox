import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CodeHighlightService } from '../services/code-highlight.service';

export interface CodeMarker {
  line: number;
  /** Tailwind text color class for the arrow, matching the task's color in the chart. */
  color: string;
  label: string;
}

/** A code panel with an arrow in the gutter for each marked line - the "you are here" of a playback. */
@Component({
  selector: 'app-step-code',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <pre class="m-0 py-4 font-mono text-sm leading-relaxed overflow-x-auto bg-gray-900 language-csharp"><code class="language-csharp">@for (line of lines(); track $index) {<div class="flex transition-colors" [class.bg-white/10]="marker($index)"><span class="w-12 shrink-0 text-right pr-2 select-none text-xs leading-[inherit]" [class]="marker($index)?.color ?? 'text-transparent'" [attr.aria-label]="marker($index)?.label">{{ marker($index) ? marker($index)!.label + ' ▶' : '' }}</span><span class="pr-4 whitespace-pre" [innerHTML]="line"></span></div>}</code></pre>
  `,
})
export class StepCodeComponent {
  readonly code = input.required<string>();
  readonly markers = input<CodeMarker[]>([]);

  private readonly highlighter = inject(CodeHighlightService);

  protected readonly lines = computed(() => this.highlighter.highlightLines(this.code()));

  protected marker(line: number): CodeMarker | undefined {
    return this.markers().find(marker => marker.line === line);
  }
}
