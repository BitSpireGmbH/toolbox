import { Component, signal, computed, inject, effect, ChangeDetectionStrategy } from '@angular/core';
import {
  StructLayoutService,
  LAYOUT_TARGETS,
  type LayoutResult,
  type LayoutTarget,
  type StructLayout,
} from '../services/struct-layout.service';
import { CodeEditorComponent } from '../shared/code-editor/code-editor.component';

/**
 * Shows where the fields of a C# struct actually land, and how many bytes the padding
 * between them costs.
 *
 * The two things that make this worth running on the real runtime rather than guessing in
 * TypeScript are both cases where the intuitive answer is wrong: `decimal` aligns to 8
 * rather than to its own 16 bytes, and - much more surprising - a struct holding any GC
 * reference is not laid out in the order you wrote it at all. CoreCLR reorders it, so
 * `struct S { int Id; string Name; }` puts the pointer at offset 0.
 */
@Component({
  selector: 'app-struct-layout',
  imports: [CodeEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-7xl mx-auto p-6">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-1">Struct Layout</h1>
          <p class="text-sm text-gray-600">
            Paste a struct, see the real field offsets and what the padding costs.
          </p>
        </div>

        @if (framework(); as version) {
          <span
            class="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-medium text-blue-800"
            title="Reported by the runtime itself, not baked in at build time">
            <span class="w-1.5 h-1.5 rounded-full bg-brand-primary"></span>
            {{ version }}
          </span>
        }
      </div>

      @if (unavailable()) {
        <div class="bg-red-50 border-l-4 border-red-500 rounded-lg shadow-sm p-4">
          <h2 class="font-semibold text-red-900 mb-1">The .NET runtime could not be loaded.</h2>
          <p class="text-sm text-red-800">
            This tool has no JavaScript fallback on purpose - an approximate offset table is
            not a degraded answer, it is a wrong one. Check your connection and reload.
          </p>
          @if (failureReason(); as reason) {
            <p class="mt-2 font-mono text-xs text-red-700">{{ reason }}</p>
          }
        </div>
      } @else {
        <div class="grid lg:grid-cols-2 gap-5">
          <!-- Input -->
          <div>
            <div class="mb-3">
              <label for="layout-target" class="block text-xs font-semibold text-gray-700 mb-2">Target</label>
              <select
                id="layout-target"
                [value]="target()"
                (change)="target.set($any($event.target).value)"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white shadow-sm">
                @for (option of targets; track option.id) {
                  <option [value]="option.id">{{ option.label }} - {{ option.note }}</option>
                }
              </select>
            </div>

            <div class="group relative bg-gray-900 rounded-xl shadow-md border border-gray-700 overflow-hidden">
              <div class="bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-2.5 border-b border-gray-700 flex items-center gap-2">
                <div class="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                <h2 class="font-semibold text-sm text-gray-200">C# structs</h2>
              </div>
              <app-code-editor
                [code]="source()"
                (codeChange)="source.set($event)"
                language="csharp"
                ariaLabel="C# struct declarations"
                [placeholder]="placeholder"
                heightClass="h-[420px] lg:h-[560px]" />
            </div>

            @for (caveat of result()?.caveats ?? []; track caveat) {
              <p class="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {{ caveat }}
              </p>
            }

            @for (diagnostic of result()?.diagnostics ?? []; track diagnostic) {
              <p class="mt-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {{ diagnostic }}
              </p>
            }
          </div>

          <!-- Layouts -->
          <div class="space-y-5">
            @for (layout of structs(); track layout.name) {
              <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                <div class="px-4 py-3 border-b border-gray-200 bg-gray-50 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 class="font-bold text-gray-900 font-mono text-sm">{{ layout.name }}</h3>
                  <span class="text-xs text-gray-600">
                    {{ layout.size }} bytes &middot; align {{ layout.alignment }}
                  </span>
                  @if (layout.paddingBytes > 0) {
                    <span class="text-xs font-medium text-amber-700">
                      {{ layout.paddingBytes }} wasted ({{ wastePercent(layout) }}%)
                    </span>
                  } @else {
                    <span class="text-xs font-medium text-green-700">no padding</span>
                  }
                  <span class="ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium"
                        [class]="layout.kind === 'Sequential' ? 'bg-gray-100 text-gray-700' : 'bg-purple-100 text-purple-800'">
                    {{ layout.kind }}
                  </span>
                </div>

                <!-- Offset table. Scrolls on its own so a long type name never widens the page. -->
                <div class="overflow-x-auto">
                  <table class="w-full text-xs font-mono">
                    <thead class="text-gray-500 border-b border-gray-200">
                      <tr>
                        <th scope="col" class="text-right px-3 py-1.5 font-medium">Offset</th>
                        <th scope="col" class="text-left px-3 py-1.5 font-medium">Field</th>
                        <th scope="col" class="text-left px-3 py-1.5 font-medium">Type</th>
                        <th scope="col" class="text-right px-3 py-1.5 font-medium">Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (field of layout.fields; track field.name) {
                        @if (field.paddingBefore > 0) {
                          <tr class="bg-amber-50/60 text-amber-800">
                            <td class="text-right px-3 py-1 tabular-nums">{{ field.offset - field.paddingBefore }}</td>
                            <td class="px-3 py-1 italic">(padding)</td>
                            <td class="px-3 py-1"></td>
                            <td class="text-right px-3 py-1 tabular-nums">{{ field.paddingBefore }}</td>
                          </tr>
                        }
                        <tr class="border-t border-gray-100" [class.bg-red-50]="field.overlaps">
                          <td class="text-right px-3 py-1 tabular-nums text-gray-500">{{ field.offset }}</td>
                          <td class="px-3 py-1 text-gray-900">{{ field.name }}</td>
                          <td class="px-3 py-1 text-blue-700">{{ field.type }}</td>
                          <td class="text-right px-3 py-1 tabular-nums text-gray-500">{{ field.size }}</td>
                        </tr>
                      }
                      @if (layout.trailingPadding > 0) {
                        <tr class="bg-amber-50/60 text-amber-800 border-t border-gray-100">
                          <td class="text-right px-3 py-1 tabular-nums">{{ layout.size - layout.trailingPadding }}</td>
                          <td class="px-3 py-1 italic">(trailing padding)</td>
                          <td class="px-3 py-1"></td>
                          <td class="text-right px-3 py-1 tabular-nums">{{ layout.trailingPadding }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>

                @if (layout.suggestion; as suggestion) {
                  <div class="px-4 py-3 border-t border-gray-200 bg-green-50">
                    <p class="text-xs text-green-900">
                      <span class="font-semibold">{{ layout.size - suggestion.size }} bytes smaller</span>
                      ({{ layout.size }} &rarr; {{ suggestion.size }}) by declaring the fields in this order:
                    </p>
                    <p class="mt-1 font-mono text-xs text-green-800">{{ suggestion.fieldOrder.join(', ') }}</p>
                  </div>
                }

                @for (note of layout.notes; track note) {
                  <p class="px-4 py-2.5 border-t border-gray-200 bg-purple-50 text-xs text-purple-900">{{ note }}</p>
                }
              </div>
            } @empty {
              <div class="bg-white rounded-xl shadow-md border border-gray-200 p-8 text-center text-sm text-gray-500">
                @if (pending()) {
                  Starting the .NET runtime...
                } @else {
                  Paste a struct on the left.
                }
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class StructLayoutComponent {
  private readonly layoutService = inject(StructLayoutService);

  protected readonly targets = LAYOUT_TARGETS;
  protected readonly target = signal<LayoutTarget>('X64');

  protected readonly framework = this.layoutService.frameworkDescription;
  protected readonly failureReason = this.layoutService.runtimeFailure;
  protected readonly unavailable = computed(() => this.layoutService.runtimeStatus() === 'failed');

  private readonly result_ = signal<LayoutResult | null>(null);
  protected readonly result = this.result_.asReadonly();
  protected readonly pending = signal(false);
  protected readonly structs = computed(() => this.result_()?.structs ?? []);

  /**
   * The default deliberately contains a `string`, because that is the case the tool exists
   * for: the layout it produces is not the one the source suggests.
   */
  protected readonly source = signal<string>(`public struct Order
{
    public int Id;
    public string Customer;
    public byte Status;
    public long PlacedAtTicks;
}`);

  protected readonly placeholder = `public struct Point
{
    public byte Kind;
    public double X;
    public double Y;
}`;

  /** Discards a run that a later keystroke has already superseded. */
  private sequence = 0;

  constructor() {
    effect(() => {
      const source = this.source();
      const target = this.target();

      if (!source.trim()) {
        this.result_.set(null);
        return;
      }

      void this.calculate(source, target);
    });
  }

  protected wastePercent(layout: StructLayout): number {
    return layout.size === 0 ? 0 : Math.round((layout.paddingBytes / layout.size) * 100);
  }

  private async calculate(source: string, target: LayoutTarget): Promise<void> {
    const sequence = ++this.sequence;
    this.pending.set(true);

    try {
      const result = await this.layoutService.calculate(source, target);
      if (sequence === this.sequence) {
        this.result_.set(result);
      }
    } catch {
      // `unavailable()` already reads the runtime's own status, so there is nothing to
      // record here - and nothing to fall back to.
      if (sequence === this.sequence) {
        this.result_.set(null);
      }
    } finally {
      if (sequence === this.sequence) {
        this.pending.set(false);
      }
    }
  }
}
