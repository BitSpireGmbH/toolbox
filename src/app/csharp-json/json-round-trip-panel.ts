import { Component, signal, computed, input, inject, effect, ChangeDetectionStrategy } from '@angular/core';
import {
  JsonNamingService,
  type RoundTripOptions,
  type RoundTripResult,
} from '../services/json-naming.service';
import { CodeBlockComponent } from '../shared/code-block/code-block.component';

/**
 * Runs the pasted payload through the real `System.Text.Json` reader and writer.
 *
 * Split out of {@link CsharpJsonComponent} rather than folded into it because it answers a
 * different question - not "what does this JSON look like as C#" but "what does .NET do
 * with this JSON" - and because it is the only part of the tool that needs the .NET
 * runtime unconditionally. Keeping it behind its own toggle is what stops the converter
 * downloading several megabytes for people who only came to generate a class.
 */
@Component({
  selector: 'app-json-round-trip-panel',
  imports: [CodeBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg border border-gray-200 p-5">
      <div class="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 class="text-sm font-bold text-gray-900">System.Text.Json round-trip</h2>
          <p class="text-xs text-gray-600 mt-0.5">
            Read and rewritten by the real <span class="font-mono">JsonDocument</span> and
            <span class="font-mono">Utf8JsonWriter</span> in .NET. Operates on the JSON itself,
            not on the generated class - that would need a C# compiler in the browser.
          </p>
        </div>
      </div>

      <!-- Reader / writer options -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1 mb-4">
        <label class="flex items-center gap-2 cursor-pointer px-2 py-1.5 hover:bg-gray-100 rounded-lg transition-colors">
          <input type="checkbox" [checked]="allowTrailingCommas()"
                 (change)="allowTrailingCommas.set($any($event.target).checked)"
                 class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-2 focus:ring-brand-primary">
          <span class="text-xs font-medium text-gray-700">Allow trailing commas</span>
        </label>

        <label class="flex items-center gap-2 cursor-pointer px-2 py-1.5 hover:bg-gray-100 rounded-lg transition-colors">
          <input type="checkbox" [checked]="skipComments()"
                 (change)="skipComments.set($any($event.target).checked)"
                 class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-2 focus:ring-brand-primary">
          <span class="text-xs font-medium text-gray-700">Skip <span class="font-mono">//</span> comments</span>
        </label>

        <label class="flex items-center gap-2 cursor-pointer px-2 py-1.5 hover:bg-gray-100 rounded-lg transition-colors"
               title="UnsafeRelaxedJsonEscaping. The default encoder escapes +, <, & and every non-ASCII character.">
          <input type="checkbox" [checked]="relaxedEscaping()"
                 (change)="relaxedEscaping.set($any($event.target).checked)"
                 class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-2 focus:ring-brand-primary">
          <span class="text-xs font-medium text-gray-700">Relaxed escaping</span>
        </label>

        <label class="flex items-center gap-2 cursor-pointer px-2 py-1.5 hover:bg-gray-100 rounded-lg transition-colors">
          <input type="checkbox" [checked]="writeIndented()"
                 (change)="writeIndented.set($any($event.target).checked)"
                 class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-2 focus:ring-brand-primary">
          <span class="text-xs font-medium text-gray-700">Write indented</span>
        </label>

        <label class="flex items-center gap-2 cursor-pointer px-2 py-1.5 hover:bg-gray-100 rounded-lg transition-colors">
          <input type="checkbox" [checked]="indentWithTabs()" [disabled]="!writeIndented()"
                 (change)="indentWithTabs.set($any($event.target).checked)"
                 class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-2 focus:ring-brand-primary disabled:opacity-40">
          <span class="text-xs font-medium" [class]="writeIndented() ? 'text-gray-700' : 'text-gray-400'">Indent with tabs</span>
        </label>

        <label class="flex items-center gap-2 px-2 py-1.5">
          <span class="text-xs font-medium" [class]="writeIndented() && !indentWithTabs() ? 'text-gray-700' : 'text-gray-400'">Indent size</span>
          <input type="number" min="1" max="8" [value]="indentSize()"
                 [disabled]="!writeIndented() || indentWithTabs()"
                 (input)="indentSize.set(+$any($event.target).value)"
                 class="w-16 px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 disabled:text-gray-400">
        </label>
      </div>

      @if (failure(); as message) {
        <p class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          The .NET runtime could not be loaded, so there is nothing to show here.
          <span class="font-mono">JSON.parse</span> would report a different error in a different
          place and escape nothing, so this panel does not guess. ({{ message }})
        </p>
      } @else {
        @if (error(); as parseError) {
          <div class="mb-3 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <p class="font-semibold text-red-800">
              JsonException
              @if (parseError.lineNumber !== null) {
                <span class="font-normal text-red-700">
                  - line {{ parseError.lineNumber + 1 }}, byte {{ parseError.bytePositionInLine }}
                </span>
              }
            </p>
            <p class="text-red-700 mt-0.5 font-mono text-[11px] leading-snug">{{ parseError.message }}</p>
          </div>
        }

        @if (notes().length > 0) {
          <ul class="mb-3 space-y-1">
            @for (note of notes(); track note.path) {
              <li class="text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <span class="font-mono font-semibold text-amber-900">{{ note.path }}</span>
                <span class="text-amber-800"> - {{ note.detail }}</span>
              </li>
            }
          </ul>
        }

        <div class="rounded-xl overflow-hidden border border-gray-700">
          <app-code-block
            [code]="output()"
            language="json"
            [placeholder]="pending() ? 'Running the .NET runtime...' : 'Rewritten JSON will appear here.'"
            heightClass="h-64" />
        </div>
      }
    </div>
  `,
})
export class JsonRoundTripPanelComponent {
  private readonly namingService = inject(JsonNamingService);

  /** The payload to run. Re-runs whenever it or any option changes. */
  readonly json = input.required<string>();

  protected readonly allowTrailingCommas = signal(false);
  protected readonly skipComments = signal(false);
  protected readonly relaxedEscaping = signal(false);
  protected readonly writeIndented = signal(true);
  protected readonly indentWithTabs = signal(false);
  protected readonly indentSize = signal(2);

  private readonly result = signal<RoundTripResult | null>(null);
  protected readonly pending = signal(false);

  /** Set only when the runtime itself is unavailable, never for a bad payload. */
  protected readonly failure = signal<string | null>(null);

  protected readonly output = computed(() => this.result()?.output ?? '');
  protected readonly error = computed(() => this.result()?.error ?? null);
  protected readonly notes = computed(() => this.result()?.notes ?? []);

  /** Discards a run that a later keystroke has already superseded. */
  private sequence = 0;

  constructor() {
    effect(() => {
      const payload = this.json();
      const options = this.options();

      if (!payload.trim()) {
        this.result.set(null);
        return;
      }

      void this.run(payload, options);
    });
  }

  private options(): RoundTripOptions {
    return {
      allowTrailingCommas: this.allowTrailingCommas(),
      skipComments: this.skipComments(),
      // Left at the System.Text.Json default; exposing it would only invite people to
      // raise a limit that exists to stop a hostile payload exhausting the stack.
      maxDepth: 0,
      writeIndented: this.writeIndented(),
      indentSize: this.indentSize(),
      indentWithTabs: this.indentWithTabs(),
      relaxedEscaping: this.relaxedEscaping(),
    };
  }

  private async run(payload: string, options: RoundTripOptions): Promise<void> {
    const sequence = ++this.sequence;
    this.pending.set(true);

    try {
      const result = await this.namingService.roundTrip(payload, options);
      if (sequence !== this.sequence) {
        return;
      }
      this.result.set(result);
      this.failure.set(null);
    } catch (error) {
      if (sequence !== this.sequence) {
        return;
      }
      this.result.set(null);
      this.failure.set(error instanceof Error ? error.message : 'unknown error');
    } finally {
      if (sequence === this.sequence) {
        this.pending.set(false);
      }
    }
  }
}
