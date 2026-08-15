import {
  ChangeDetectionStrategy,
  Component,
  computed,
  debounced,
  inject,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { CodeBlockComponent } from '../shared/code-block/code-block.component';
import {
  LinqPipelineSpec,
  LinqRunResult,
  LinqVisualizerService,
  NUMBERS_SOURCE,
} from '../services/linq-visualizer.service';
import { EnumerationTimelineComponent } from './enumeration-timeline';
import { narrate, shortName } from './linq-narration';
import { PipelineAnimationComponent } from './pipeline-animation';
import { PipelineBuilderComponent } from './pipeline-builder';

/** Coalesces a burst of edits (holding the count spinner) into one run. */
export const INPUT_DEBOUNCE_MS = 150;

/**
 * Opens on something that already does something interesting - a filter and a
 * projection - so the animation has a story to tell before anything is touched.
 */
const DEFAULT_SPEC: LinqPipelineSpec = {
  source: { kind: NUMBERS_SOURCE, count: 5 },
  operators: [{ id: 'where-greater-than', number: 2 }, { id: 'select-double' }],
  terminal: 'toList',
  enumerateTwice: false,
};

/**
 * Shows *when* a LINQ query runs, by running it through the real `System.Linq` in
 * WebAssembly and tracing every pull and yield as it happens.
 *
 * Built for someone meeting deferred execution for the first time, which drives the
 * shape: the centrepiece is a moving pipeline with a plain-English sentence per step
 * rather than an event table, the numbers involved stay small, and every element is an
 * `int` so no query a learner assembles here is capable of failing.
 *
 * There is deliberately no JavaScript fallback. The Regex Tester degrades to `RegExp`
 * because that is a defensible approximation; here the entire subject is .NET
 * enumeration semantics, so approximating it would teach something false.
 */
@Component({
  selector: 'app-linq-visualizer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CodeBlockComponent,
    EnumerationTimelineComponent,
    PipelineAnimationComponent,
    PipelineBuilderComponent,
  ],
  template: `
    <div class="max-w-7xl mx-auto p-4 md:p-6">
      <div class="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-1">LINQ Visualizer</h1>
          <p class="text-sm text-gray-600 max-w-2xl">
            When does a LINQ query actually run? Build one and watch each number travel
            through it, powered by the real
            <code class="font-mono text-xs bg-gray-100 px-1 rounded">System.Linq</code>.
          </p>
        </div>

        @if (framework(); as version) {
          <span
            class="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-medium text-blue-800"
            title="Reported by the runtime itself, not baked in at build time"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-brand-primary"></span>
            {{ version }}
          </span>
        }
      </div>

      @if (unavailable()) {
        <div class="bg-red-50 border-l-4 border-red-500 rounded-lg shadow-sm p-4">
          <h2 class="font-semibold text-red-900 mb-1">The .NET runtime could not be loaded.</h2>
          <p class="text-sm text-red-800">
            This tool has no JavaScript fallback on purpose - it exists to show real .NET
            behaviour, and an approximation would be misleading. Check your connection and
            reload.
          </p>
          @if (failureReason(); as reason) {
            <p class="mt-2 font-mono text-xs text-red-700">{{ reason }}</p>
          }
        </div>
      } @else if (catalog.hasValue()) {
        @let loadedCatalog = catalog.value();

        <!-- Primer -->
        <div class="bg-blue-50 rounded-2xl ring-1 ring-blue-100 mb-6 overflow-hidden">
          <button
            type="button"
            class="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-100 transition-colors"
            (click)="showPrimer.set(!showPrimer())"
          >
            <h3 class="font-semibold text-blue-900">New to this? Start here</h3>
            <svg
              class="w-5 h-5 text-blue-600 transition-transform duration-200"
              [class.rotate-180]="showPrimer()"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          @if (showPrimer()) {
            <div class="px-4 pb-4">
              <p class="text-sm text-blue-800 leading-relaxed">
                Most people picture a LINQ query as a series of passes: filter the whole
                list, then transform the whole list. That picture is wrong, and almost
                every LINQ surprise comes from it.
              </p>
              <p class="text-sm text-blue-800 leading-relaxed mt-2">
                What really happens is a chain of requests running
                <strong>backwards</strong>. The last step asks the one before it for a
                single number, which asks the one before it, all the way back to the list.
                One number then travels forward through every step before the next is even
                fetched. Nothing moves at all until something asks for a result.
              </p>
              <p class="text-sm font-semibold text-blue-900 mt-3">Things worth trying</p>
              <ul class="text-sm text-blue-800 list-disc list-inside mt-1 space-y-1">
                <li>Set the last step to <strong>(nothing)</strong> — watch the whole query do nothing.</li>
                <li>Use <strong>First()</strong> over 1000 numbers — see how few get fetched.</li>
                <li>Now add <strong>OrderByDescending</strong> before it — see that saving disappear.</li>
                <li>Tick <strong>use the query twice</strong> — watch the list get read all over again.</li>
              </ul>

              <p class="text-sm text-blue-800 leading-relaxed mt-3">
                This tool is about <strong>when</strong> LINQ runs. For what each operator
                <strong>does</strong> to your data, see
                <a
                  class="underline font-medium hover:text-blue-900"
                  href="https://steven-giesel.com/blogPost/d65c5411-a69b-489f-b73f-18ce0ed8678d/linq-explained-with-sketches"
                  target="_blank"
                  rel="noopener"
                  >LINQ explained with sketches</a
                >, which covers 27 of them as before-and-after pictures.
              </p>
            </div>
          }
        </div>

        <!-- The query -->
        <div class="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 overflow-hidden mb-4">
          <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <h3 class="font-semibold text-sm text-gray-700">Your query</h3>
          </div>
          <div class="p-4">
            <app-pipeline-builder
              [catalog]="loadedCatalog"
              [spec]="spec()"
              (specChange)="applyPatch($event)"
            />
          </div>
        </div>

        @if (result(); as run) {
          @if (run.error) {
            <div class="bg-red-50 border-l-4 border-red-500 rounded-lg shadow-sm p-4">
              <p class="text-sm text-red-800">{{ run.error }}</p>
            </div>
          } @else {
            <app-pipeline-animation
              [stages]="run.stages"
              [steps]="steps()"
              [terminalLabel]="terminalLabel()"
              [sourceCount]="spec().source.count"
              [resultText]="run.resultText"
              [stats]="run.stats"
            />

            @if (run.truncated) {
              <p class="mt-2 text-xs text-amber-700">
                This query does more steps than the visualizer can show, so the animation
                stops early.
              </p>
            }

            <!-- What that means -->
            @if (summary().length > 0) {
              <div class="mt-4 rounded-2xl bg-blue-50 ring-1 ring-blue-100 px-5 py-4">
                <h3 class="font-semibold text-blue-900 text-sm mb-1.5">What just happened</h3>
                <ul class="space-y-1.5">
                  @for (line of summary(); track line) {
                    <li class="text-sm text-blue-800 leading-relaxed">{{ line }}</li>
                  }
                </ul>
              </div>
            }

            <!-- The C# -->
            <div class="mt-4 bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
              <button
                type="button"
                class="w-full bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
                (click)="showCode.set(!showCode())"
              >
                <h3 class="font-semibold text-sm text-gray-700">See the C#</h3>
                <span class="text-xs text-gray-500">{{ showCode() ? 'Hide' : 'Show' }}</span>
              </button>
              @if (showCode()) {
                <div class="p-4">
                  @if (run.querySyntax) {
                    <div class="flex gap-1 mb-2">
                      <button
                        type="button"
                        class="px-3 py-1 text-xs rounded-md border transition-colors"
                        [class]="
                          !useQuerySyntax()
                            ? 'border-brand-primary bg-blue-50 text-brand-primary font-medium'
                            : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                        "
                        (click)="useQuerySyntax.set(false)"
                      >
                        Method syntax
                      </button>
                      <button
                        type="button"
                        class="px-3 py-1 text-xs rounded-md border transition-colors"
                        [class]="
                          useQuerySyntax()
                            ? 'border-brand-primary bg-blue-50 text-brand-primary font-medium'
                            : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                        "
                        (click)="useQuerySyntax.set(true)"
                      >
                        Query syntax
                      </button>
                    </div>
                  }
                  <app-code-block
                    [code]="(useQuerySyntax() ? run.querySyntax : run.methodSyntax) ?? ''"
                    heightClass="h-56"
                  />
                </div>
              }
            </div>

            <!-- Detailed log -->
            <div class="mt-4 bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
              <button
                type="button"
                class="w-full bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
                (click)="showLog.set(!showLog())"
              >
                <h3 class="font-semibold text-sm text-gray-700">
                  Every step as a table
                  <span class="font-normal text-gray-500">(for the curious)</span>
                </h3>
                <span class="text-xs text-gray-500">{{ showLog() ? 'Hide' : 'Show' }}</span>
              </button>
              @if (showLog()) {
                <div class="p-4 h-96">
                  <app-enumeration-timeline [stages]="run.stages" [steps]="steps()" />
                </div>
              }
            </div>
          }
        } @else {
          <div class="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 p-12 text-center">
            <p class="text-sm text-gray-500">Starting the .NET runtime…</p>
          </div>
        }
      } @else {
        <div class="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 p-12 text-center">
          <p class="text-sm text-gray-500">Loading the .NET runtime…</p>
        </div>
      }
    </div>
  `,
})
export class LinqVisualizerComponent {
  private readonly linq = inject(LinqVisualizerService);

  protected readonly framework = this.linq.frameworkDescription;

  protected readonly catalog = resource({ loader: () => this.linq.loadCatalog() });

  /**
   * `resource.value()` throws while a resource is in its error state, so the template
   * must never reach it on a failed load. Both failure routes are folded into one
   * predicate: the runtime refusing to start, and the catalog request failing.
   */
  protected readonly unavailable = computed(
    () => this.linq.runtimeStatus() === 'failed' || this.catalog.error() !== undefined
  );

  protected readonly failureReason = computed(
    () => this.linq.runtimeFailure() ?? this.catalog.error()?.message ?? null
  );

  protected readonly spec = signal<LinqPipelineSpec>(DEFAULT_SPEC);

  /** Collapsed by default: the tool should open on the thing itself, not on prose. */
  protected readonly showPrimer = signal(false);
  protected readonly showCode = signal(false);
  protected readonly showLog = signal(false);
  protected readonly useQuerySyntax = signal(false);

  private readonly debouncedSpec = debounced(() => this.spec(), INPUT_DEBOUNCE_MS);

  private readonly runResource = resource({
    params: () => this.debouncedSpec.value(),
    loader: ({ params }) => this.linq.run(params),
  });

  /**
   * Holds the previous run while the next is in flight, so tweaking a control does not
   * blank the animation out mid-thought.
   */
  protected readonly result = linkedSignal<LinqRunResult | undefined, LinqRunResult | undefined>({
    source: () => (this.runResource.hasValue() ? this.runResource.value() : undefined),
    computation: (next, previous) => next ?? previous?.value,
  });

  protected readonly terminalLabel = computed(() => {
    const terminal = this.spec().terminal;
    if (!this.catalog.hasValue()) {
      return terminal;
    }
    return this.catalog.value().terminals.find(entry => entry.id === terminal)?.label ?? terminal;
  });

  protected readonly steps = computed(() => {
    const run = this.result();
    if (!run || run.error) {
      return [];
    }
    return narrate(run.stages, run.events, this.terminalLabel());
  });

  /**
   * A couple of sentences about the run that just happened.
   *
   * The animation shows *what* occurred; this says why it matters, and it adapts to
   * whatever the user built rather than describing a fixed example. Without it the
   * interesting cases - a sort quietly destroying an early exit, a query being run
   * twice - are visible but easy to scroll straight past.
   */
  /**
   * Merged against the current value rather than replacing it, so edits arriving in the
   * same tick compose instead of overwriting one another.
   */
  protected applyPatch(patch: Partial<LinqPipelineSpec>): void {
    this.spec.update(current => ({ ...current, ...patch }));
  }

  protected readonly summary = computed<string[]>(() => {
    const run = this.result();
    if (!run || run.error) {
      return [];
    }

    if (run.stats.totalEvents === 0) {
      return [
        'Nothing ran at all. Without a final step, the query is just a written-down plan — nobody asked it for a number, so no work happened.',
      ];
    }

    const lines: string[] = [];
    const { sourcePulls, sourceYields, shortCircuited } = run.stats;

    lines.push(
      shortCircuited
        ? `The list was asked ${sourcePulls} time(s) and then everything stopped — it still had more numbers to give.`
        : `The list was read all the way to the end, handing over ${sourceYields} number(s).`
    );

    const buffering = run.stages.find(stage => stage.kind === 'buffering');
    if (buffering) {
      lines.push(
        `${shortName(buffering.label)} had to collect every number before it could hand back even one, so nothing downstream could stop early.`
      );
    }

    if (this.spec().enumerateTwice) {
      lines.push(
        'The query was used twice, so the whole thing ran again from scratch. When the list is a database or an API, that is two round trips instead of one.',
      );
    }

    if (run.stages.filter(stage => stage.kind === 'streaming').length >= 2) {
      lines.push(
        'Notice each number went all the way through every step before the next one was fetched — the intermediate lists you might picture never existed.',
      );
    }

    return lines;
  });
}
