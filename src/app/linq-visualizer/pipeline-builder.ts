import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import {
  LinqCatalog,
  LinqOperatorInfo,
  LinqOperatorSpec,
  LinqPipelineSpec,
} from '../services/linq-visualizer.service';
import { OperatorSketchComponent } from './operator-sketch';

/**
 * Groups while preserving first-seen order, so the palette follows the catalog's
 * ordering rather than reshuffling it alphabetically.
 */
function groupBy<T>(items: readonly T[], key: (item: T) => string): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const name = key(item);
    const existing = groups.get(name);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(name, [item]);
    }
  }
  return [...groups];
}

/**
 * The query editor: how many numbers to start with, an ordered chain of steps, and what
 * finally asks for the result.
 *
 * Everything it offers comes from the catalog the .NET runtime serves, so the palette
 * can never list a step the engine does not implement. Every step is `int` to `int`,
 * which means no combination a learner assembles here is capable of failing - there is
 * deliberately no way to build something that produces an error message.
 *
 * Edits are emitted as a whole new spec rather than mutated in place, which keeps the
 * parent's signal the single source of truth.
 */
@Component({
  selector: 'app-pipeline-builder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OperatorSketchComponent],
  template: `
    <!--
      Laid out left to right so the controls read as the sentence they describe:
      start with these numbers, then do these steps, finally ask for this.
    -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Source -->
      <div class="lg:col-span-3">
        <label
          for="linq-count"
          class="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2"
        >
          Start with
        </label>
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-700">the numbers 1 to</span>
          <input
            id="linq-count"
            type="number"
            min="1"
            max="200"
            class="w-24 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white shadow-sm"
            [value]="spec().source.count"
            (input)="setCount($event)"
          />
        </div>
      </div>

      <!-- Steps -->
      <div class="lg:col-span-6">
        <div class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Then, in order
        </div>

        @if (spec().operators.length === 0) {
          <p class="text-sm text-gray-500 italic mb-2">
            No steps yet — the numbers go straight to the final step below.
          </p>
        }

        <div class="space-y-2">
          @for (operator of spec().operators; track $index) {
            @let info = describe(operator.id);
            <div class="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2.5">
              <span class="font-mono text-xs text-gray-400 w-4">{{ $index + 1 }}</span>

              <div class="flex-1 min-w-0">
                <div class="font-mono text-sm text-gray-900 truncate">{{ info?.label }}</div>
                <div class="mt-1 flex items-center gap-2 flex-wrap">
                  <app-operator-sketch [operatorId]="operator.id" />
                  @if (info?.kind === 'buffering') {
                    <span
                      class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800"
                    >
                      collects all first
                    </span>
                  }
                </div>
              </div>

              @if (info?.argKind === 'number') {
                <input
                  type="number"
                  class="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white"
                  [value]="operator.number ?? info?.defaultNumber ?? 0"
                  (input)="setNumber($index, $event)"
                  [attr.aria-label]="'Number for ' + info?.label"
                />
              }

              <button
                type="button"
                class="px-2 py-1 text-xs rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-30"
                [disabled]="$first"
                (click)="move($index, -1)"
                aria-label="Move this step earlier"
              >
                ↑
              </button>
              <button
                type="button"
                class="px-2 py-1 text-xs rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-30"
                [disabled]="$last"
                (click)="move($index, 1)"
                aria-label="Move this step later"
              >
                ↓
              </button>
              <button
                type="button"
                class="px-2 py-1 text-xs rounded-lg border border-gray-300 bg-white text-red-600 hover:bg-red-50"
                (click)="remove($index)"
                aria-label="Remove this step"
              >
                ✕
              </button>
            </div>
          }
        </div>

        <button
          type="button"
          class="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white shadow-sm hover:bg-gray-50 text-gray-700 font-medium transition-colors"
          (click)="showPalette.set(!showPalette())"
        >
          {{ showPalette() ? 'Close' : '+ Add a step…' }}
        </button>

        <!--
          A grid of pictures rather than a dropdown: with only eight operators they all
          fit, and seeing what each one does to the numbers beats reading its name.
        -->
        @if (showPalette()) {
          <div class="mt-3 space-y-4">
            @for (group of operatorGroups(); track group.name) {
              <div>
                <div class="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                  {{ group.name }}
                </div>
                <div class="grid grid-cols-1 xl:grid-cols-2 gap-2">
                  @for (operator of group.operators; track operator.id) {
                    <button
                      type="button"
                      class="text-left rounded-lg border border-gray-300 bg-white p-2.5 hover:border-brand-primary hover:bg-blue-50 transition-colors"
                      (click)="add(operator.id)"
                    >
                      <div class="font-mono text-xs text-gray-900 truncate">
                        {{ operator.label }}
                      </div>
                      <div class="mt-1.5">
                        <app-operator-sketch [operatorId]="operator.id" />
                      </div>
                      <div class="mt-1.5 text-[11px] text-gray-600 leading-snug">
                        {{ operator.hint }}
                      </div>
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        }
      </div>

      <!-- Terminal -->
      <div class="lg:col-span-3">
        <label
          for="linq-terminal"
          class="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2"
        >
          Finally
        </label>
        <select
          id="linq-terminal"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
          [value]="spec().terminal"
          (change)="setTerminal($event)"
        >
          <!--
            [selected] per option, not just [value] on the select. The options are
            created by @for in the same change-detection pass that sets the select's
            value, and a value naming an option that does not exist yet is dropped by
            the browser - which left the dropdown reading "(nothing)" while the query
            was actually running ToList().
          -->
          @for (group of terminalGroups(); track group.name) {
            <optgroup [label]="group.name">
              @for (terminal of group.terminals; track terminal.id) {
                <option [value]="terminal.id" [selected]="terminal.id === spec().terminal">
                  {{ terminal.label }}
                </option>
              }
            </optgroup>
          }
        </select>

        @if (terminalHint(); as hint) {
          <p class="mt-1.5 text-xs text-gray-600">{{ hint }}</p>
        }

        <label class="mt-3 flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            class="rounded border-gray-300 accent-brand-primary"
            [checked]="spec().enumerateTwice"
            (change)="setEnumerateTwice($event)"
          />
          Use the query twice
        </label>
      </div>
    </div>
  `,
})
export class PipelineBuilderComponent {
  readonly catalog = input.required<LinqCatalog>();
  readonly spec = input.required<LinqPipelineSpec>();

  /**
   * Emits only the fields that changed, not a whole rebuilt spec.
   *
   * Rebuilding from `spec()` looked equivalent but was not: that input only refreshes
   * on the next change-detection pass, so two edits landing in the same tick both read
   * the same stale value and the second silently reverted the first. Emitting a patch
   * lets the parent merge against whatever it currently holds.
   */
  readonly specChange = output<Partial<LinqPipelineSpec>>();

  private readonly operatorsById = computed(
    () => new Map(this.catalog().operators.map(operator => [operator.id, operator]))
  );

  protected readonly terminalHint = computed(
    () =>
      this.catalog().terminals.find(terminal => terminal.id === this.spec().terminal)?.hint ?? null
  );

  /**
   * Groups in the order the catalog lists them, rather than alphabetically: the .NET
   * side already orders operators from "filters" through to "reorders", which is
   * roughly the order a beginner meets them.
   */
  protected readonly operatorGroups = computed(() =>
    groupBy(this.catalog().operators, operator => operator.group).map(([name, operators]) => ({
      name,
      operators,
    }))
  );

  protected readonly terminalGroups = computed(() =>
    groupBy(this.catalog().terminals, terminal => terminal.group).map(([name, terminals]) => ({
      name,
      terminals,
    }))
  );

  protected describe(id: string): LinqOperatorInfo | undefined {
    return this.operatorsById().get(id);
  }

  protected setCount(event: Event): void {
    const count = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(count)) {
      return;
    }
    this.emit({
      source: { kind: this.spec().source.kind, count: Math.min(200, Math.max(1, count)) },
    });
  }

  protected readonly showPalette = signal(false);

  protected add(id: string): void {
    this.showPalette.set(false);
    this.emit({ operators: [...this.spec().operators, { id }] });
  }

  protected remove(index: number): void {
    this.emit({ operators: this.spec().operators.filter((_, position) => position !== index) });
  }

  protected move(index: number, offset: number): void {
    const operators = [...this.spec().operators];
    const target = index + offset;
    if (target < 0 || target >= operators.length) {
      return;
    }
    [operators[index], operators[target]] = [operators[target], operators[index]];
    this.emit({ operators });
  }

  protected setNumber(index: number, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.updateOperator(index, { number: Number.isFinite(value) ? value : undefined });
  }

  protected setTerminal(event: Event): void {
    this.emit({ terminal: (event.target as HTMLSelectElement).value });
  }

  protected setEnumerateTwice(event: Event): void {
    this.emit({ enumerateTwice: (event.target as HTMLInputElement).checked });
  }

  private updateOperator(index: number, patch: Partial<LinqOperatorSpec>): void {
    const operators = this.spec().operators.map((operator, position) =>
      position === index ? { ...operator, ...patch } : operator
    );
    this.emit({ operators });
  }

  private emit(patch: Partial<LinqPipelineSpec>): void {
    this.specChange.emit(patch);
  }
}
