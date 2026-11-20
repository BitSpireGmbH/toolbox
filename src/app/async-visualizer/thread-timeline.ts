import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
} from '@angular/core';

export interface TimelineSegment {
  task: string;
  /** `run` works on a thread, `block` waits while still holding it, `wait` holds none. */
  kind: 'run' | 'block' | 'wait';
  startMs: number;
  endMs: number;
  /** Null while awaiting: an awaiting task holds no thread. */
  threadId: number | null;
  label: string;
}

export interface ThreadTimeline {
  segments: TimelineSegment[];
  totalMs: number;
  threadCount: number;
}

interface Bar {
  step: number;
  left: number;
  width: number;
  segment: TimelineSegment;
}

interface Row {
  label: string;
  bars: Bar[];
}

const TASK_COLORS: Record<string, string> = {
  A: 'bg-sky-500',
  B: 'bg-violet-500',
  C: 'bg-emerald-500',
};

const TICK_MS = 50;
export const STEP_MS = 900;

/** One sentence per step, so the chart can be read as a story rather than decoded. */
export function narrate(segment: TimelineSegment, blocking = false): string {
  const task = `Task ${segment.task}`;
  const thread = `Thread #${segment.threadId}`;
  switch (segment.kind) {
    case 'wait':
      return `${task} reaches ${segment.label}. It hands the thread back and, while it waits, holds no thread at all.`;
    case 'block':
      return `${task} calls ${segment.label}. ${thread} is stuck waiting with it - nothing else can run until the sleep ends.`;
    default:
      if (segment.label === 'starts') {
        return `${thread} starts ${task} and runs it until its first wait.`;
      }
      if (blocking) {
        return segment.label === 'resumes, finishes'
          ? `${task}'s sleep ends and it finishes its work - it never let go of ${thread}.`
          : `${task}'s sleep ends and it carries on - it never let go of ${thread}.`;
      }
      return segment.label === 'resumes, finishes'
        ? `${task}'s wait is over. ${thread} picks it up where it left off and runs it to the end.`
        : `${task}'s wait is over. ${thread} picks it up where it left off.`;
  }
}

/**
 * Task lanes over a shared thread lane, played back one step at a time. The point is the
 * bottom row: three tasks, one thread, and the thread idle while every task awaits.
 */
@Component({
  selector: 'app-thread-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="text-xs">
      <div class="flex flex-wrap items-center gap-2 mb-3">
        <button
          type="button"
          class="px-3 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
          (click)="playing() ? pause() : play()"
        >
          {{ playing() ? 'Pause' : step() >= lastStep() ? 'Replay' : 'Play' }}
        </button>
        <input
          type="range"
          class="flex-1 min-w-40 accent-brand-primary"
          min="0"
          [max]="lastStep()"
          [value]="step()"
          (input)="scrub($event)"
          aria-label="Step through the timeline"
        />
        <span class="text-gray-500 tabular-nums w-20 text-right">step {{ step() + 1 }} / {{ lastStep() + 1 }}</span>
      </div>

      <p class="min-h-10 mb-3 rounded-lg bg-gray-900 text-gray-100 px-3 py-2 text-sm leading-snug" aria-live="polite">
        <span class="text-gray-400 tabular-nums">{{ current()?.startMs ?? 0 | number: '1.0-0' }} ms</span>
        {{ current() ? narrate(current()!, hasBlocking()) : '' }}
      </p>

      @for (row of taskRows(); track row.label) {
        <div class="flex items-center gap-3 mb-1.5">
          <span class="w-20 shrink-0 font-medium text-gray-700">Task {{ row.label }}</span>
          <div class="relative flex-1 h-7">
            @for (bar of row.bars; track bar.step) {
              @if (bar.segment.kind === 'wait') {
                <div
                  class="absolute inset-y-1 rounded border border-dashed border-gray-400 bg-gray-50 px-1.5 flex items-center overflow-hidden transition-opacity"
                  [class.opacity-15]="bar.step > step()"
                  [class.ring-2]="bar.step === step()"
                  [class.ring-gray-900]="bar.step === step()"
                  [style.left.%]="bar.left"
                  [style.width.%]="bar.width"
                  [title]="bar.segment.label + ': holds no thread'"
                >
                  <span class="truncate font-mono text-[10px] text-gray-500">{{ bar.segment.label }}</span>
                </div>
              } @else {
                <div
                  class="absolute inset-y-0 rounded flex items-center px-1.5 overflow-hidden transition-opacity"
                  [class]="color(bar.segment)"
                  [class.opacity-15]="bar.step > step()"
                  [class.ring-2]="bar.step === step()"
                  [class.ring-gray-900]="bar.step === step()"
                  [style.left.%]="bar.left"
                  [style.width.%]="bar.width"
                  [style.min-width.px]="3"
                  [title]="bar.segment.label + ' on thread #' + bar.segment.threadId"
                >
                  @if (bar.segment.kind === 'block') {
                    <span class="truncate font-mono text-[10px] text-white">{{ bar.segment.label }}</span>
                  }
                </div>
              }
            }
            <div class="absolute inset-y-0 w-px bg-gray-900/60 pointer-events-none" [style.left.%]="playhead()"></div>
          </div>
        </div>
      }

      @for (row of threadRows(); track row.label) {
        <div class="flex items-center gap-3 mt-3 pt-3 border-t border-gray-200">
          <span class="w-20 shrink-0 font-semibold text-gray-900">{{ row.label }}</span>
          <div class="relative flex-1 h-7 rounded bg-gray-100">
            @for (bar of row.bars; track bar.step) {
              <div
                class="absolute inset-y-0 rounded flex items-center justify-center text-[10px] font-semibold text-white transition-opacity"
                [class]="color(bar.segment)"
                [class.opacity-15]="bar.step > step()"
                [style.left.%]="bar.left"
                [style.width.%]="bar.width"
                [style.min-width.px]="3"
                [title]="'Busy with task ' + bar.segment.task"
              >
                {{ bar.width > 2.5 ? bar.segment.task : '' }}
              </div>
            }
            <div class="absolute inset-y-0 w-px bg-gray-900/60 pointer-events-none" [style.left.%]="playhead()"></div>
          </div>
        </div>
      }

      <div class="flex gap-3 mt-1">
        <span class="w-20 shrink-0"></span>
        <div class="relative flex-1 h-4 text-[10px] text-gray-400">
          @for (tick of ticks(); track tick) {
            <span class="absolute -translate-x-1/2" [style.left.%]="(tick / timeline().totalMs) * 100">{{ tick }} ms</span>
          }
        </div>
      </div>

      <div class="flex flex-wrap gap-4 mt-3 text-gray-600">
        <span class="inline-flex items-center gap-1.5"><span class="w-4 h-3 rounded bg-sky-500"></span> working: holds the thread</span>
        @if (hasBlocking()) {
          <span class="inline-flex items-center gap-1.5"><span class="w-4 h-3 rounded bg-sky-500 bg-stripes"></span> blocked: waiting, but still holds the thread</span>
        } @else {
          <span class="inline-flex items-center gap-1.5">
            <span class="w-4 h-3 rounded border border-dashed border-gray-400 bg-gray-50"></span> awaiting: holds no thread
          </span>
        }
        <span class="inline-flex items-center gap-1.5"><span class="w-4 h-3 rounded bg-gray-100"></span> thread idle</span>
      </div>
    </div>
  `,
  styles: `
    .bg-stripes {
      background-image: repeating-linear-gradient(135deg, rgb(255 255 255 / 0.45) 0 4px, transparent 4px 8px);
    }
  `,
  imports: [DecimalPipe],
})
export class ThreadTimelineComponent {
  readonly timeline = input.required<ThreadTimeline>();
  /** The step being shown, so the code beside the chart can point at it. */
  readonly currentChange = output<TimelineSegment | undefined>();

  protected readonly narrate = narrate;

  /** Playback order: by start time, so the story follows the clock. */
  private readonly bars = computed<Bar[]>(() => {
    const { segments, totalMs } = this.timeline();
    return [...segments]
      .sort((a, b) => a.startMs - b.startMs)
      .map((segment, step) => ({
        step,
        segment,
        left: (segment.startMs / totalMs) * 100,
        width: ((segment.endMs - segment.startMs) / totalMs) * 100,
      }));
  });

  protected readonly lastStep = computed(() => this.bars().length - 1);

  /** Reset to the start whenever a new run arrives, so each run is played back. */
  protected readonly step = linkedSignal(() => (this.reducedMotion ? this.bars().length - 1 : 0));

  protected readonly current = computed(() => this.bars()[this.step()]?.segment);

  protected readonly playhead = computed(() => this.bars()[this.step()]?.left ?? 0);

  protected readonly playing = signal(false);

  protected readonly taskRows = computed(() =>
    this.group(this.bars(), bar => bar.segment.task, task => task).sort((a, b) => a.label.localeCompare(b.label))
  );

  protected readonly threadRows = computed(() =>
    this.group(
      this.bars().filter(bar => bar.segment.kind !== 'wait'),
      bar => String(bar.segment.threadId),
      id => `Thread #${id}`
    )
  );

  protected readonly hasBlocking = computed(() => this.timeline().segments.some(segment => segment.kind === 'block'));

  protected readonly ticks = computed(() => {
    const ticks: number[] = [];
    for (let tick = 0; tick <= this.timeline().totalMs; tick += TICK_MS) {
      ticks.push(tick);
    }
    return ticks;
  });

  private readonly reducedMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  private timer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    effect(() => {
      this.timeline();
      if (!this.reducedMotion) {
        untracked(() => this.play());
      }
    });
    effect(() => this.currentChange.emit(this.current()));
    inject(DestroyRef).onDestroy(() => this.pause());
  }

  protected play(): void {
    this.pause();
    if (this.step() >= this.lastStep()) {
      this.step.set(0);
    }
    this.playing.set(true);
    this.timer = setInterval(() => {
      if (this.step() >= this.lastStep()) {
        this.pause();
        return;
      }
      this.step.update(step => step + 1);
    }, STEP_MS);
  }

  protected pause(): void {
    clearInterval(this.timer);
    this.playing.set(false);
  }

  protected scrub(event: Event): void {
    this.pause();
    this.step.set(Number((event.target as HTMLInputElement).value));
  }

  protected color(segment: TimelineSegment): string {
    const base = TASK_COLORS[segment.task] ?? 'bg-gray-500';
    return segment.kind === 'block' ? `${base} bg-stripes` : base;
  }

  private group(bars: Bar[], key: (bar: Bar) => string, label: (key: string) => string): Row[] {
    const rows = new Map<string, Bar[]>();
    for (const bar of bars) {
      rows.set(key(bar), [...(rows.get(key(bar)) ?? []), bar]);
    }
    return [...rows].map(([name, rowBars]) => ({ label: label(name), bars: rowBars }));
  }
}
