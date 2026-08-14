import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { RegexRange } from '../services/regex-explain.service';
import { RegexMatchResult } from '../services/regex-tester.service';

/**
 * Every match with its groups, in the output rail.
 *
 * Hovering a row locates that match in the test text - the reverse direction of
 * the pattern chain, which locates a part.
 */
@Component({
  selector: 'app-match-details-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col' },
  template: `
    <div class="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-md">
      <button
        type="button"
        (click)="expanded.set(!expanded())"
        [attr.aria-expanded]="expanded()"
        class="flex shrink-0 cursor-pointer items-center justify-between gap-2 border-b border-gray-200 bg-linear-to-r from-gray-50 to-gray-100 px-4 py-2.5 text-left">
        <span class="flex items-center gap-1.5">
          <svg
            class="h-3.5 w-3.5 text-gray-500 transition-transform"
            [class.-rotate-90]="!expanded()"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <span class="text-sm font-semibold text-gray-700">Match details</span>
        </span>
        <span class="text-xs text-gray-500">
          {{ matches().length }} found@if (matches().length > 0) {&nbsp;· hover a row to locate it}
        </span>
      </button>

      @if (expanded()) {
        <div class="min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto">
          @for (match of matches(); track match.index; let first = $first) {
            <div
              (mouseenter)="hoveredMatch.emit({ index: match.index, length: match.length })"
              (mouseleave)="hoveredMatch.emit(null)"
              class="px-4 py-3 transition-colors hover:bg-amber-50">
              <div class="mb-1.5 flex items-baseline justify-between gap-3">
                <span class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm break-all text-gray-900">
                  {{ match.value }}
                </span>
                <span class="shrink-0 text-xs text-gray-500">
                  index {{ match.index }} · length {{ match.length }}
                </span>
              </div>

              @if (match.groups.length > 0) {
                <div class="flex flex-wrap gap-1.5">
                  @for (group of match.groups; track group.name) {
                    <span class="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-xs">
                      <span class="font-semibold text-brand-primary">{{ group.name }}</span>
                      <span class="text-gray-700">{{ group.value }}</span>
                    </span>
                  }
                </div>

                @if (first) {
                  <p class="mt-2 text-[11px] leading-snug text-gray-400">
                    Named groups come straight from (?&lt;name&gt;…) in the pattern; the numbered
                    ones are the same groups counted left to right.
                  </p>
                }
              }
            </div>
          } @empty {
            <p class="px-4 py-6 text-center text-sm text-gray-400">
              No matches yet — adjust the pattern or the test text.
            </p>
          }
        </div>
      }
    </div>
  `,
})
export class MatchDetailsPanelComponent {
  readonly matches = input<readonly RegexMatchResult[]>([]);
  readonly hoveredMatch = output<RegexRange | null>();

  protected readonly expanded = signal(true);
}
