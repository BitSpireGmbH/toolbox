import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

interface SketchItem {
  value: string;
  /** Shown struck through: this one is in the input but does not make it out. */
  dropped?: boolean;
}

interface OperatorSketch {
  before: SketchItem[];
  after: string[];
  /**
   * Whether the operator can change how many items come out. The sketches in Steven's
   * "LINQ explained with sketches" are organised around exactly this distinction, and
   * it is the first thing a beginner needs in order to reason about a chain.
   */
  count: 'same' | 'fewer';
}

const keep = (...values: (string | number)[]): SketchItem[] =>
  values.map(value => ({ value: String(value) }));

const drop = (value: string | number): SketchItem => ({ value: String(value), dropped: true });

/**
 * A before-and-after picture for each operator, in the spirit of the sketches at
 * https://steven-giesel.com/blogPost/d65c5411-a69b-489f-b73f-18ce0ed8678d
 *
 * The tool as a whole is about *when* an operator runs; this is the missing half -
 * what it actually does to the data - and seeing it in one glance is far quicker than
 * reading a sentence about it.
 *
 * Keyed by the ids the .NET catalog serves. An operator with no entry simply renders
 * nothing, so adding one on the C# side degrades quietly rather than breaking the page.
 */
const SKETCHES: Record<string, OperatorSketch> = {
  'where-greater-than': {
    before: [drop(1), drop(2), ...keep(3, 4, 5)],
    after: ['3', '4', '5'],
    count: 'fewer',
  },
  'where-even': {
    before: [drop(1), ...keep(2), drop(3), ...keep(4), drop(5)],
    after: ['2', '4'],
    count: 'fewer',
  },
  distinct: {
    before: [...keep(1, 2), drop(1), ...keep(3), drop(2)],
    after: ['1', '2', '3'],
    count: 'fewer',
  },
  'select-double': {
    before: keep(1, 2, 3),
    after: ['2', '4', '6'],
    count: 'same',
  },
  'select-square': {
    before: keep(1, 2, 3),
    after: ['1', '4', '9'],
    count: 'same',
  },
  'select-mod': {
    before: keep(1, 2, 3, 4),
    after: ['1', '2', '0', '1'],
    count: 'same',
  },
  take: {
    before: [...keep(1, 2, 3), drop(4), drop(5)],
    after: ['1', '2', '3'],
    count: 'fewer',
  },
  // Shown over an unsorted run on purpose: TakeWhile only differs from Take when a
  // later number would have passed, and on a sorted list the two are identical.
  'take-while': {
    before: [...keep(1, 2), drop(5), drop(3), drop(4)],
    after: ['1', '2'],
    count: 'fewer',
  },
  skip: {
    before: [drop(1), drop(2), ...keep(3, 4, 5)],
    after: ['3', '4', '5'],
    count: 'fewer',
  },
  // Likewise: once the test fails it stops skipping, so the small numbers after the
  // 5 come through even though they would have been skipped earlier.
  'skip-while': {
    before: [drop(1), drop(2), ...keep(5, 1, 2)],
    after: ['5', '1', '2'],
    count: 'fewer',
  },
  'order-by-asc': {
    before: keep(3, 1, 5, 2),
    after: ['1', '2', '3', '5'],
    count: 'same',
  },
  'order-by-desc': {
    before: keep(3, 1, 5, 2),
    after: ['5', '3', '2', '1'],
    count: 'same',
  },
  reverse: {
    before: keep(1, 2, 3, 4),
    after: ['4', '3', '2', '1'],
    count: 'same',
  },
};

/** Ids that currently have a sketch. Exported so a test can hold the catalog to it. */
export const SKETCHED_OPERATOR_IDS = Object.keys(SKETCHES);

/**
 * A small "in goes this, out comes that" picture for one operator.
 *
 * Deliberately shows the dropped items struck through rather than just omitting them:
 * the interesting thing about `Where` and `Skip` is not only what survives, but that
 * the rejected values were fetched and looked at on the way.
 */
@Component({
  selector: 'app-operator-sketch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sketch(); as picture) {
      <div class="flex items-center gap-1.5 flex-wrap">
        <div class="flex items-center gap-0.5">
          @for (item of picture.before; track $index) {
            <span
              class="px-1 py-0.5 rounded text-[10px] font-mono border"
              [class]="
                item.dropped
                  ? 'bg-gray-50 text-gray-400 border-gray-200 line-through'
                  : 'bg-white text-gray-700 border-gray-300'
              "
            >
              {{ item.value }}
            </span>
          }
        </div>

        <span class="text-gray-400 text-xs">→</span>

        <div class="flex items-center gap-0.5">
          @for (value of picture.after; track $index) {
            <span
              class="px-1 py-0.5 rounded text-[10px] font-mono bg-green-50 text-green-800 border border-green-200"
            >
              {{ value }}
            </span>
          }
        </div>

        <span
          class="px-1.5 py-0.5 rounded text-[10px] font-medium"
          [class]="
            picture.count === 'same'
              ? 'bg-blue-50 text-blue-700'
              : 'bg-amber-50 text-amber-800'
          "
        >
          {{ picture.count === 'same' ? 'same count' : 'can be fewer' }}
        </span>
      </div>
    }
  `,
})
export class OperatorSketchComponent {
  readonly operatorId = input.required<string>();

  protected readonly sketch = computed<OperatorSketch | undefined>(
    () => SKETCHES[this.operatorId()]
  );
}
