import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LinqStage } from '../services/linq-visualizer.service';
import { NarratedStep, shortName } from './linq-narration';

/**
 * The whole trace as a table, for people who want the receipts.
 *
 * Deliberately secondary: this used to be the tool's centrepiece, and as a first thing
 * to look at it reads as a data dump. It earns its place as a reference *after* the
 * animation has made the idea land, so there is no playback here - just every step, in
 * order, with the sentence that describes it.
 */
@Component({
  selector: 'app-enumeration-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (steps().length === 0) {
      <div class="h-full flex items-center justify-center text-center">
        <p class="text-sm text-gray-500">Nothing ran, so there is nothing to list.</p>
      </div>
    } @else {
      <div class="h-full flex flex-col">
        <!-- Column headers -->
        <div class="grid gap-1 pb-1 text-xs border-b border-gray-200" [style.grid-template-columns]="columns()">
          <div class="text-gray-400 font-mono">#</div>
          @for (stage of stages(); track stage.index) {
            <div class="min-w-0 truncate font-medium text-gray-700" [title]="stage.label">
              {{ stage.index === 0 ? 'the list' : name(stage.label) }}
            </div>
          }
          <div class="text-gray-500">What happened</div>
        </div>

        <div class="flex-1 overflow-auto pt-1">
          @for (step of steps(); track step.event.step) {
            <div
              class="grid gap-1 items-center py-0.5 border-b border-gray-100"
              [style.grid-template-columns]="columns()"
            >
              <div class="font-mono text-[10px] text-gray-400">{{ step.event.step + 1 }}</div>

              @for (stage of stages(); track stage.index) {
                <div class="min-w-0 flex justify-center">
                  @if (stage.index === step.event.stage) {
                    @switch (step.kind) {
                      @case ('pulled') {
                        <span
                          class="w-full text-center font-mono text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-1 truncate"
                        >
                          ← asks
                        </span>
                      }
                      @case ('yielded') {
                        <span
                          class="w-full text-center font-mono text-[11px] text-green-800 bg-green-50 border border-green-200 rounded px-1 truncate"
                        >
                          {{ step.value }} →
                        </span>
                      }
                      @default {
                        <span
                          class="w-full text-center font-mono text-[11px] text-gray-500 bg-gray-100 border border-gray-200 rounded px-1 truncate"
                        >
                          empty
                        </span>
                      }
                    }
                  } @else {
                    <span class="block w-px h-3.5 bg-gray-200"></span>
                  }
                </div>
              }

              <div class="text-[11px] text-gray-600 leading-snug">
                @if (step.event.pass > 0) {
                  <span
                    class="mr-1 px-1 rounded bg-blue-100 text-blue-800 text-[10px] font-medium"
                  >
                    2nd run
                  </span>
                }
                {{ step.text }}
              </div>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class EnumerationTimelineComponent {
  readonly stages = input.required<LinqStage[]>();
  readonly steps = input.required<NarratedStep[]>();

  protected name(label: string): string {
    return shortName(label);
  }

  /** Step gutter, one equal column per stage, then a wide description column. */
  protected columns(): string {
    return `1.75rem repeat(${this.stages().length}, minmax(0, 1fr)) minmax(0, 2.5fr)`;
  }
}
