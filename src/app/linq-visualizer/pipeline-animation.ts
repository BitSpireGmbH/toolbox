import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { LinqStage, LinqStats } from '../services/linq-visualizer.service';
import { NarratedStep, shortName } from './linq-narration';

/** Playback speeds, slowest first. Beginners tend to want the slow one. */
const SPEEDS = [
  { label: 'Slow', ms: 900 },
  { label: 'Normal', ms: 450 },
  { label: 'Fast', ms: 200 },
];

/** Above this, the list is shown abbreviated rather than as hundreds of chips. */
const MAX_SOURCE_CHIPS = 10;

/**
 * The pipeline as a machine, rather than as a log - and the one thing on the page that
 * is meant to hold your attention.
 *
 * Boxes left to right: the list, one per step, then whatever is asking for the answer.
 * A request travels *backwards* (amber, right to left) and a number travels *forwards*
 * (green, left to right). That backwards-flowing demand is the single hardest idea in
 * lazy enumeration, so it gets the width of the screen rather than a glyph in a table.
 *
 * Input, output, narration, controls and the running cost all live in here too. They
 * were separate cards, which turned one continuous idea into five things to look at.
 */
@Component({
  selector: 'app-pipeline-animation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
      <!-- In and out -->
      <div class="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div class="min-w-0">
          <div class="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            You start with
          </div>
          <div class="font-mono text-sm text-gray-600">{{ inputPreview() }}</div>
        </div>
        <span class="text-gray-300 text-lg">→</span>
        <div class="min-w-0">
          <div class="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            You end up with
          </div>
          <div class="font-mono text-sm font-semibold text-gray-900 break-words">
            {{ resultText() }}
          </div>
        </div>
      </div>

      @if (steps().length === 0) {
        <div class="px-5 py-12 text-center">
          <p class="text-base font-semibold text-gray-900">Nothing happened at all.</p>
          <p class="mt-1.5 text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
            Without a final step like
            <code class="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">ToList()</code>,
            the query is just a written-down plan. Nobody asked it for a number, so it
            never ran.
          </p>
        </div>
      } @else {
        <!-- The pipeline -->
        <div class="px-5 pt-5 pb-4 overflow-x-auto">
          <div class="flex items-stretch min-w-max">
            @for (stage of stages(); track stage.index) {
              <div class="w-44 shrink-0 rounded-xl p-3 transition-all duration-200" [class]="boxClass(stage.index)">
                <div class="font-semibold text-sm text-gray-900 truncate">
                  {{ stage.index === 0 ? 'the list' : name(stage.label) }}
                </div>

                @if (stage.index === 0) {
                  <div class="mt-2 flex flex-wrap gap-1">
                    @for (number of sourceChips(); track $index) {
                      <span
                        class="px-1.5 py-0.5 rounded-md text-[11px] font-mono border transition-colors"
                        [class]="
                          $index < consumed()
                            ? 'bg-gray-100 text-gray-300 border-gray-100 line-through'
                            : 'bg-white text-gray-700 border-gray-200'
                        "
                      >
                        {{ number }}
                      </span>
                    }
                    @if (sourceTruncated()) {
                      <span class="text-[11px] text-gray-400 self-center">…{{ sourceCount() }}</span>
                    }
                  </div>
                } @else {
                  <div class="mt-1 font-mono text-[11px] text-gray-500 truncate" [title]="stage.label">
                    {{ stage.label }}
                  </div>
                  <div
                    class="mt-2 inline-block px-2 py-0.5 rounded-full text-[10px] font-medium"
                    [class]="
                      stage.kind === 'buffering'
                        ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                        : 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                    "
                  >
                    {{ stage.kind === 'buffering' ? 'collects all first' : 'passes through' }}
                  </div>
                }

                <div class="mt-2 text-[11px] text-gray-400">asked {{ asked()[stage.index] }}×</div>
              </div>

              <!-- the gap this stage's traffic crosses -->
              <div class="w-20 shrink-0 relative flex items-center justify-center">
                <span class="absolute inset-x-0 h-0.5 rounded-full bg-gray-200"></span>

                @if (frame(); as step) {
                  @if (step.slot === stage.index) {
                    @if (step.direction === 'backward') {
                      <span
                        class="relative px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 ring-1 ring-amber-300 text-[11px] font-medium whitespace-nowrap"
                      >
                        ← asks
                      </span>
                    } @else if (step.kind === 'exhausted') {
                      <span
                        class="relative px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 ring-1 ring-gray-300 text-[11px] whitespace-nowrap"
                      >
                        empty →
                      </span>
                    } @else {
                      <span
                        class="relative px-2 py-0.5 rounded-full bg-green-100 text-green-800 ring-1 ring-green-300 font-mono text-[11px] whitespace-nowrap"
                      >
                        {{ step.value }} →
                      </span>
                    }
                  }
                }
              </div>
            }

            <!-- whatever is asking for the answer -->
            <div class="w-44 shrink-0 rounded-xl p-3 transition-all duration-200" [class]="terminalBoxClass()">
              <div class="font-semibold text-sm text-gray-900 truncate">
                {{ name(terminalLabel()) }}
              </div>
              <div class="mt-1 text-[11px] text-gray-500">wants the answer</div>
              <div class="mt-2 flex flex-wrap gap-1">
                @for (value of delivered(); track $index) {
                  <span
                    class="px-1.5 py-0.5 rounded-md text-[11px] font-mono bg-green-50 text-green-700 border border-green-200"
                  >
                    {{ value }}
                  </span>
                }
              </div>
            </div>
          </div>
        </div>

        <!-- Narration -->
        <div class="mx-5 mb-4 rounded-xl bg-blue-50 px-4 py-3">
          <p class="text-sm text-blue-900 leading-relaxed">
            @if (frame(); as step) {
              {{ step.text }}
            }
          </p>
        </div>

        <!-- Controls -->
        <div class="px-5 pb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="w-9 h-9 grid place-items-center rounded-lg ring-1 ring-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-colors"
            [disabled]="currentStep() <= 0"
            (click)="stepBack()"
            aria-label="Previous step"
          >
            ‹
          </button>
          <button
            type="button"
            class="px-4 h-9 rounded-lg bg-brand-primary hover:bg-brand-secondary text-white text-sm font-medium transition-colors min-w-[6.5rem]"
            (click)="togglePlay()"
          >
            {{ playing() ? 'Pause' : 'Play again' }}
          </button>
          <button
            type="button"
            class="w-9 h-9 grid place-items-center rounded-lg ring-1 ring-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-colors"
            [disabled]="currentStep() >= steps().length - 1"
            (click)="stepForward()"
            aria-label="Next step"
          >
            ›
          </button>

          <input
            type="range"
            class="flex-1 min-w-32 accent-brand-primary"
            min="0"
            [max]="steps().length - 1"
            [value]="currentStep()"
            (input)="scrubTo($event)"
            aria-label="Step through what happens"
          />

          <span class="text-xs text-gray-400 font-mono tabular-nums whitespace-nowrap">
            {{ currentStep() + 1 }} / {{ steps().length }}
          </span>

          <div class="flex items-center gap-0.5 ml-auto">
            @for (speed of speeds; track speed.ms) {
              <button
                type="button"
                class="px-2 h-7 rounded-md text-xs transition-colors"
                [class]="
                  speed.ms === intervalMs()
                    ? 'bg-blue-50 text-brand-primary font-medium ring-1 ring-blue-200'
                    : 'text-gray-500 hover:bg-gray-50'
                "
                (click)="intervalMs.set(speed.ms)"
              >
                {{ speed.label }}
              </button>
            }
          </div>
        </div>
      }

      <!-- Running cost -->
      <div class="px-5 py-3 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span class="text-gray-600">
          the list was asked
          <strong class="text-brand-primary font-semibold">{{ stats().sourcePulls }}×</strong>
        </span>
        <span class="text-gray-600">
          it handed over
          <strong class="text-gray-900 font-semibold">{{ stats().sourceYields }}</strong>
          number(s)
        </span>
        <span class="text-gray-600">
          stopped early
          <strong
            class="font-semibold"
            [class]="stats().shortCircuited ? 'text-green-700' : 'text-gray-900'"
            >{{ stats().shortCircuited ? 'yes' : 'no' }}</strong
          >
        </span>
      </div>
    </section>
  `,
})
export class PipelineAnimationComponent {
  readonly stages = input.required<LinqStage[]>();
  readonly steps = input.required<NarratedStep[]>();
  readonly terminalLabel = input.required<string>();
  readonly sourceCount = input.required<number>();
  readonly resultText = input.required<string>();
  readonly stats = input.required<LinqStats>();

  protected readonly speeds = SPEEDS;
  protected readonly intervalMs = signal(SPEEDS[1].ms);

  /** Starts at the beginning: a beginner should watch it happen, not read the ending. */
  protected readonly currentStep = linkedSignal<number>(() => {
    this.steps();
    return 0;
  });

  protected readonly playing = signal(false);

  protected readonly frame = computed(() => this.steps()[this.currentStep()]);

  constructor() {
    // A fresh run plays itself. The whole point is to be watched, and asking a beginner
    // to find the play button before anything moves loses them.
    effect(() => {
      const hasSteps = this.steps().length > 0;
      untracked(() => this.playing.set(hasSteps));
    });

    effect(onCleanup => {
      if (!this.playing()) {
        return;
      }

      const handle = setInterval(() => {
        const next = this.currentStep() + 1;
        if (next >= this.steps().length) {
          this.playing.set(false);
          return;
        }
        this.currentStep.set(next);
      }, this.intervalMs());

      onCleanup(() => clearInterval(handle));
    });
  }

  protected name(label: string): string {
    return shortName(label);
  }

  protected readonly inputPreview = computed(() => {
    const count = this.sourceCount();
    if (count <= MAX_SOURCE_CHIPS) {
      return `[${Array.from({ length: count }, (_, index) => index + 1).join(', ')}]`;
    }
    return `[1, 2, 3, …, ${count}]`;
  });

  /** How many times each stage has been asked, up to the current step. */
  protected readonly asked = computed(() => {
    const counts = new Array<number>(this.stages().length).fill(0);
    for (const step of this.steps().slice(0, this.currentStep() + 1)) {
      if (step.kind === 'pulled') {
        counts[step.event.stage] += 1;
      }
    }
    return counts;
  });

  /** Numbers the list has handed over during the enumeration currently on screen. */
  protected readonly consumed = computed(() => {
    const step = this.frame();
    const pass = step?.event.pass ?? 0;

    return this.steps()
      .slice(0, this.currentStep() + 1)
      .filter(
        candidate =>
          candidate.event.stage === 0 &&
          candidate.kind === 'yielded' &&
          candidate.event.pass === pass
      ).length;
  });

  /** What has reached the terminal so far. */
  protected readonly delivered = computed(() => {
    const lastStage = this.stages().length - 1;
    return this.steps()
      .slice(0, this.currentStep() + 1)
      .filter(step => step.event.stage === lastStage && step.kind === 'yielded')
      .map(step => step.value ?? '')
      .slice(-8);
  });

  protected readonly sourceChips = computed(() =>
    Array.from({ length: Math.min(this.sourceCount(), MAX_SOURCE_CHIPS) }, (_, index) => index + 1)
  );

  protected readonly sourceTruncated = computed(() => this.sourceCount() > MAX_SOURCE_CHIPS);

  protected boxClass(stage: number): string {
    const active = this.frame()?.event.stage === stage;
    return active
      ? 'bg-white ring-2 ring-brand-primary shadow-md'
      : 'bg-white ring-1 ring-gray-200';
  }

  protected terminalBoxClass(): string {
    const step = this.frame();
    const active = step !== undefined && step.slot === this.stages().length - 1;
    return active ? 'bg-white ring-2 ring-brand-primary shadow-md' : 'bg-white ring-1 ring-gray-200';
  }

  protected stepBack(): void {
    this.playing.set(false);
    this.currentStep.update(step => Math.max(0, step - 1));
  }

  protected stepForward(): void {
    this.playing.set(false);
    this.currentStep.update(step => Math.min(this.steps().length - 1, step + 1));
  }

  protected togglePlay(): void {
    if (this.playing()) {
      this.playing.set(false);
      return;
    }
    if (this.currentStep() >= this.steps().length - 1) {
      this.currentStep.set(0);
    }
    this.playing.set(true);
  }

  protected scrubTo(event: Event): void {
    this.playing.set(false);
    this.currentStep.set(Number((event.target as HTMLInputElement).value));
  }
}
