import { Component, ChangeDetectionStrategy, signal, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CodeBlockComponent } from '../shared/code-block/code-block.component';
import { ResponseCatalogService } from '../services/response-catalog.service';
import { RESPONSE_CATALOG } from './response-catalog.const';
import { ResponseEntry, ResponseMode, STANDARD_LABELS } from './models/response-entry.models';

const MODE_STORAGE_KEY = 'response-guide.mode';
const QUERY_DEBOUNCE_MS = 150;

@Component({
  selector: 'app-response-guide',
  imports: [CodeBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-5xl mx-auto p-6">
      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 mb-1">ASP.NET Core Response Guide</h1>
        <p class="text-sm text-gray-600 max-w-2xl">
          Same endpoint, two styles. Flip the toggle to see each scenario as a classic MVC
          controller or a Minimal API using <code class="font-mono text-gray-800">TypedResults</code>,
          and search by status code or by what went wrong.
        </p>
      </div>

      <!-- Controls -->
      <div
        class="flex flex-wrap gap-4 items-center mb-6 p-4 bg-white rounded-xl shadow-md border border-gray-200">
        <div
          role="tablist"
          aria-label="Response style"
          class="inline-flex bg-gray-100 border border-gray-200 rounded-full p-0.5 gap-0.5">
          @for (option of modeOptions; track option.value) {
            <button
              type="button"
              role="tab"
              [id]="'mode-tab-' + option.value"
              [attr.aria-selected]="mode() === option.value"
              [attr.aria-controls]="'response-list'"
              [tabindex]="mode() === option.value ? 0 : -1"
              (click)="mode.set(option.value)"
              (keydown)="onModeKeydown($event)"
              [class]="
                mode() === option.value
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              "
              class="px-4 py-1.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap">
              {{ option.label }}
            </button>
          }
        </div>

        <div class="flex-1 min-w-[200px]">
          <label for="response-search" class="sr-only">Search scenarios and status codes</label>
          <input
            id="response-search"
            type="search"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
            placeholder="Search: 504, timeout, rate limit, created…"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white shadow-sm" />
        </div>

        <label
          class="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer select-none">
          <input
            type="checkbox"
            [checked]="showAvoid()"
            (change)="showAvoid.set($any($event.target).checked)"
            class="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-2 focus:ring-amber-500" />
          Show discouraged <code class="font-mono text-amber-700">Results.*</code>
        </label>

        <label
          class="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer select-none">
          <input
            type="checkbox"
            [checked]="showVendorSpecific()"
            (change)="showVendorSpecific.set($any($event.target).checked)"
            class="w-4 h-4 rounded border-gray-300 text-brand-primary focus:ring-2 focus:ring-brand-primary" />
          Show vendor-specific codes
        </label>
      </div>

      <p class="text-xs text-gray-500 mb-4" aria-live="polite">
        Showing {{ filtered().length }} of {{ totalVisible() }} entries
      </p>

      <!-- Results -->
      <div
        id="response-list"
        role="tabpanel"
        [attr.aria-labelledby]="'mode-tab-' + mode()"
        class="space-y-4">
        @for (entry of filtered(); track entry.id) {
          <article class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <!-- Card head -->
            <div
              class="flex items-center justify-between gap-3 flex-wrap px-5 py-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
              <div>
                <h2 class="font-semibold text-sm text-gray-900">{{ entry.title }}</h2>
                <p class="text-xs text-gray-600 mt-0.5">{{ entry.summary }}</p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                @if (entry.standard !== 'standard') {
                  <span
                    class="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                    {{ standardLabel(entry) }}
                  </span>
                }
                @for (code of entry.statusCodes; track code) {
                  <span
                    class="font-mono text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                    {{ code }}
                  </span>
                }
              </div>
            </div>

            @if (entry.kind === 'scenario') {
              <!-- Code panel. The mode toggle only swaps which field renders here,
                   so the list never reflows when you switch styles. -->
              <div class="relative bg-gray-900">
                <button
                  type="button"
                  (click)="copy(snippetFor(entry), entry.id)"
                  [attr.aria-label]="
                    'Copy ' + modeLabel() + ' snippet for ' + entry.title
                  "
                  class="absolute top-2 right-2 z-10 px-2.5 py-1 rounded-md text-xs font-semibold text-green-400 hover:bg-green-400/10 transition-colors">
                  {{ copiedId() === entry.id ? '✓ Copied!' : 'Copy' }}
                </button>
                <app-code-block [code]="snippetFor(entry)" />
              </div>

              @if (showAvoid() && entry.snippets.avoidNote; as avoidNote) {
                <!-- Dark like the panel above: the Prism palette is tuned for a
                     dark ground, and on a light amber background its light
                     token colours wash out. -->
                <div class="border-t-2 border-amber-500/70 bg-gray-900">
                  <p
                    class="flex items-center gap-1.5 px-4 pt-3 text-[11px] font-bold uppercase tracking-wide text-amber-400">
                    ⚠ Avoid — plain Results
                  </p>
                  <app-code-block [code]="avoidNote" />
                </div>
              }
            } @else {
              <!-- Reference entry: no C#, because your app never emits these. -->
              <dl class="px-5 py-4 space-y-3 text-sm">
                <div>
                  <dt class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                    What it means
                  </dt>
                  <dd class="text-gray-700">{{ entry.meaning }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                    Why it happens
                  </dt>
                  <dd class="text-gray-700">{{ entry.cause }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                    What to do
                  </dt>
                  <dd class="text-gray-700">{{ entry.whatToDo }}</dd>
                </div>
                @if (entry.docsUrl) {
                  <div>
                    <a
                      [href]="entry.docsUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-xs font-medium text-brand-primary hover:underline">
                      Vendor documentation ↗
                    </a>
                  </div>
                }
              </dl>
            }
          </article>
        } @empty {
          <div
            class="bg-white rounded-xl shadow-md border border-gray-200 p-12 text-center">
            <p class="text-sm text-gray-500">No scenarios match your search.</p>
            @if (!showVendorSpecific()) {
              <p class="text-xs text-gray-400 mt-2">
                Vendor-specific codes (nginx, Cloudflare, AWS) are hidden — try enabling them.
              </p>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class ResponseGuideComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly catalog = inject(ResponseCatalogService);

  protected readonly modeOptions: readonly { value: ResponseMode; label: string }[] = [
    { value: 'minimal', label: 'Minimal API · TypedResults' },
    { value: 'controller', label: 'MVC Controller' },
  ];

  /** TypedResults is what the guide recommends, so it is what you land on. */
  protected readonly mode = signal<ResponseMode>('minimal');
  /** Bound to the input; updates on every keystroke. */
  protected readonly query = signal('');
  protected readonly showAvoid = signal(false);
  protected readonly showVendorSpecific = signal(false);
  protected readonly copiedId = signal<string | null>(null);

  /** What the filter actually reads - trails `query` by QUERY_DEBOUNCE_MS. */
  private readonly debouncedQuery = signal('');

  protected readonly filtered = computed(() =>
    this.catalog.filter(RESPONSE_CATALOG, {
      query: this.debouncedQuery(),
      showVendorSpecific: this.showVendorSpecific(),
    })
  );

  /** Denominator for the result count - the catalog minus whatever the vendor chip hides. */
  protected readonly totalVisible = computed(
    () =>
      this.catalog.filter(RESPONSE_CATALOG, {
        query: '',
        showVendorSpecific: this.showVendorSpecific(),
      }).length
  );

  protected readonly modeLabel = computed(() =>
    this.mode() === 'controller' ? 'controller' : 'minimal API'
  );

  constructor() {
    this.restoreState();

    // Debounce: each keystroke cancels the pending timer via onCleanup, so
    // debouncedQuery only lands once the user pauses.
    effect(onCleanup => {
      const value = this.query();
      const handle = setTimeout(() => this.debouncedQuery.set(value), QUERY_DEBOUNCE_MS);
      onCleanup(() => clearTimeout(handle));
    });

    // Single writer to the URL. Nothing subscribes to queryParamMap after the
    // one-time snapshot read in restoreState(), so this cannot feed back into
    // the signals and loop.
    effect(() => {
      const mode = this.mode();
      const query = this.debouncedQuery();
      const avoid = this.showAvoid();
      const vendor = this.showVendorSpecific();

      this.persistMode(mode);

      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {
          mode,
          q: query || null,
          avoid: avoid ? '1' : null,
          vendor: vendor ? '1' : null,
        },
        queryParamsHandling: 'merge',
        // Typing 7 characters must not push 7 history entries.
        replaceUrl: true,
      });
    });
  }

  protected snippetFor(entry: Extract<ResponseEntry, { kind: 'scenario' }>): string {
    return this.mode() === 'controller' ? entry.snippets.controller : entry.snippets.minimalApi;
  }

  protected standardLabel(entry: ResponseEntry): string {
    return STANDARD_LABELS[entry.standard];
  }

  /** Left/Right arrows move between tabs, per the WAI-ARIA tablist pattern. */
  protected onModeKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }

    event.preventDefault();
    const next = this.mode() === 'controller' ? 'minimal' : 'controller';
    this.mode.set(next);

    const target = document.getElementById(`mode-tab-${next}`);
    target?.focus();
  }

  protected async copy(code: string, id: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      this.copiedId.set(id);
      setTimeout(() => this.copiedId.set(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }

  /**
   * Seeds state once from the URL, falling back to the remembered mode. Read
   * from the snapshot rather than the queryParamMap stream so the write effect
   * above can never re-trigger it.
   */
  private restoreState(): void {
    const params = this.route.snapshot.queryParamMap;

    const mode = params.get('mode');
    if (mode === 'controller' || mode === 'minimal') {
      this.mode.set(mode);
    } else {
      const remembered = this.readStoredMode();
      if (remembered) {
        this.mode.set(remembered);
      }
    }

    const query = params.get('q') ?? '';
    this.query.set(query);
    this.debouncedQuery.set(query);

    this.showAvoid.set(params.get('avoid') === '1');
    this.showVendorSpecific.set(params.get('vendor') === '1');
  }

  private readStoredMode(): ResponseMode | null {
    try {
      const stored = localStorage.getItem(MODE_STORAGE_KEY);
      return stored === 'controller' || stored === 'minimal' ? stored : null;
    } catch {
      // Safari private mode throws on storage access.
      return null;
    }
  }

  private persistMode(mode: ResponseMode): void {
    try {
      localStorage.setItem(MODE_STORAGE_KEY, mode);
    } catch {
      // Non-fatal - the mode simply won't survive a reload.
    }
  }
}
