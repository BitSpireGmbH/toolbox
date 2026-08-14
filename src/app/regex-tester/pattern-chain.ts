import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { RegexExplainService, RegexPaletteItem, RegexPart } from '../services/regex-explain.service';
import { QUANTIFIER_CHOICES, REGEX_PALETTE } from './regex-examples.const';

/** Chip tint per token kind, so the shape of a pattern is readable at a glance. */
const KIND_STYLE: Record<string, string> = {
  literal: 'border-gray-300 bg-gray-50 text-gray-800',
  escape: 'border-sky-300 bg-sky-50 text-sky-900',
  class: 'border-teal-300 bg-teal-50 text-teal-900',
  dot: 'border-violet-300 bg-violet-50 text-violet-900',
  anchor: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  backreference: 'border-orange-300 bg-orange-50 text-orange-900',
  unknown: 'border-red-300 bg-red-50 text-red-800',
};

/**
 * The pattern read back as a chain of parts - and the editor for it.
 *
 * Nothing here holds pattern state: every control rewrites the pattern string
 * and emits it, so typing into the field and building visually are the same
 * operation with the same single source of truth.
 */
@Component({
  selector: 'app-pattern-chain',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  // Document-level, because Esc has to reach the palette and the selection
  // whether or not focus is still inside the chain.
  host: { class: 'block', '(document:keydown.escape)': 'clearSelection()' },
  template: `
    <div class="flex flex-wrap items-start gap-2">
      @for (part of parts(); track part.start) {
        <ng-container *ngTemplateOutlet="chip; context: { $implicit: part }" />
      }

      <div class="relative">
        <button
          type="button"
          (click)="palette.set(!palette())"
          [attr.aria-expanded]="palette()"
          class="flex h-full min-h-[4.25rem] cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:border-brand-primary hover:text-brand-primary">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add part
        </button>

        @if (palette()) {
          <div class="absolute top-full left-0 z-20 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
            <p class="px-2 pt-1 pb-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">
              Add to the pattern
            </p>
            <div class="grid grid-cols-2 gap-1">
              @for (item of paletteItems; track item.label) {
                <button
                  type="button"
                  (click)="addPart(item)"
                  class="flex cursor-pointer flex-col items-start rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-gray-100">
                  <span class="font-mono text-xs text-gray-900">{{ item.snippet }}</span>
                  <span class="text-[11px] text-gray-500">{{ item.label }}</span>
                </button>
              }
            </div>
          </div>
        }
      </div>
    </div>

    @if (selected(); as part) {
      <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-brand-primary/30 bg-brand-primary/5 px-3 py-2">
        <span class="font-mono text-sm font-semibold text-gray-900">{{ part.source }}</span>

        <div class="flex items-center gap-1">
          <span class="mr-1 text-xs text-gray-500">repeat</span>
          @for (choice of quantifiers; track choice.value) {
            <button
              type="button"
              [disabled]="!canQuantify()"
              (click)="applyQuantifier(part, choice.value)"
              [class]="part.quantifier === choice.value ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'"
              class="cursor-pointer rounded-md border px-2 py-1 font-mono text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40">
              {{ choice.label }}
            </button>
          }
        </div>

        <div class="flex items-center gap-1">
          <input
            [value]="groupName()"
            (input)="groupName.set($any($event.target).value)"
            (keydown.enter)="wrap(part)"
            placeholder="name"
            aria-label="Group name"
            class="w-24 rounded-md border border-gray-300 px-2 py-1 font-mono text-xs focus:ring-2 focus:ring-brand-primary focus:outline-none" />
          <button
            type="button"
            (click)="wrap(part)"
            class="cursor-pointer rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50">
            Wrap in group
          </button>
        </div>

        <button
          type="button"
          (click)="remove(part)"
          class="cursor-pointer rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50">
          Remove
        </button>
      </div>
    }

    <ng-template #chip let-part>
      @if (part.kind === 'group') {
        <div
          class="rounded-lg border-2 border-dashed px-2 pt-1.5 pb-2"
          [class]="part.group.lookaround ? 'border-purple-300 bg-purple-50/40' : 'border-fuchsia-300 bg-fuchsia-50/40'">
          <button
            type="button"
            (click)="select(part)"
            (mouseenter)="hover(part)"
            (focus)="hover(part)"
            (mouseleave)="hover(null)"
            (blur)="hover(null)"
            class="mb-1.5 block cursor-pointer text-[10px] font-semibold tracking-wide text-fuchsia-700 uppercase hover:underline">
            {{ part.group.heading }}
          </button>
          <div class="flex flex-wrap items-start gap-2">
            @for (child of part.children; track child.start) {
              <ng-container *ngTemplateOutlet="chip; context: { $implicit: child }" />
            }
          </div>
          @if (part.label) {
            <span class="mt-1 block text-[10px] text-gray-500">{{ part.label }}</span>
          }
        </div>
      } @else if (part.kind === 'alternation') {
        <span class="self-center px-1 text-xs font-semibold tracking-wide text-gray-400 uppercase">or</span>
      } @else {
        <button
          type="button"
          (click)="select(part)"
          (mouseenter)="hover(part)"
          (focus)="hover(part)"
          (mouseleave)="hover(null)"
          (blur)="hover(null)"
          [class]="kindStyle(part)"
          class="cursor-pointer rounded-lg border px-2.5 py-1.5 text-left transition-shadow hover:shadow-sm">
          <span class="block font-mono text-sm">{{ part.source }}</span>
          <span class="block text-[11px] text-gray-500">{{ part.label }}</span>
        </button>
      }
    </ng-template>
  `,
})
export class PatternChainComponent {
  private readonly explain = inject(RegexExplainService);

  readonly pattern = input<string>('');
  readonly parts = input<readonly RegexPart[]>([]);
  readonly selected = input<RegexPart | null>(null);

  readonly patternChange = output<string>();
  readonly hoveredPart = output<RegexPart | null>();
  readonly selectedChange = output<RegexPart | null>();

  protected readonly quantifiers = QUANTIFIER_CHOICES;
  protected readonly paletteItems = REGEX_PALETTE;
  protected readonly palette = signal(false);
  protected readonly groupName = signal('');

  /** Anchors and lookarounds match no characters, so repeating them is meaningless. */
  protected readonly canQuantify = computed(() => {
    const part = this.selected();
    if (!part) return false;
    return part.kind !== 'anchor' && part.kind !== 'alternation' && part.kind !== 'unknown' &&
      !part.group?.lookaround;
  });

  protected kindStyle(part: RegexPart): string {
    const base = KIND_STYLE[part.kind] ?? KIND_STYLE['literal'];
    return part.start === this.selected()?.start ? `${base} ring-2 ring-brand-primary` : base;
  }

  protected hover(part: RegexPart | null): void {
    this.hoveredPart.emit(part);
  }

  protected select(part: RegexPart): void {
    this.palette.set(false);
    this.groupName.set(part.group?.name ?? '');
    this.selectedChange.emit(part.start === this.selected()?.start ? null : part);
  }

  protected clearSelection(): void {
    this.palette.set(false);
    this.selectedChange.emit(null);
  }

  protected applyQuantifier(part: RegexPart, quantifier: string): void {
    this.patternChange.emit(this.explain.setQuantifier(this.pattern(), part, quantifier));
  }

  protected wrap(part: RegexPart): void {
    this.patternChange.emit(this.explain.wrapInGroup(this.pattern(), part, this.groupName()));
  }

  protected remove(part: RegexPart): void {
    this.patternChange.emit(this.explain.removePart(this.pattern(), part));
  }

  protected addPart(item: RegexPaletteItem): void {
    this.palette.set(false);
    this.patternChange.emit(this.explain.appendPart(this.pattern(), item));
  }
}
