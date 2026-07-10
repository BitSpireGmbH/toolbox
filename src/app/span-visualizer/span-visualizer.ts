import { Component, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';

type ActiveTab = 'what-is-span' | 'substring-vs-slice' | 'stack-heap';
type SpanType = 'Span' | 'ReadOnlySpan';

interface CharCell {
  char: string;
  index: number;
  address: number;
  inWindow: boolean;
}

interface SubstringCharCell {
  char: string;
  index: number;
  address: number;
}

@Component({
  selector: 'app-span-visualizer',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-7xl mx-auto p-6">
      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 mb-1">Span&lt;T&gt; Visualizer</h1>
        <p class="text-sm text-gray-600">Understand memory slices, zero-allocation operations, and the Stack vs Heap</p>
      </div>

      <!-- Info Box -->
      <div class="bg-blue-50 border-l-4 border-brand-primary rounded-lg mb-6 shadow-sm overflow-hidden">
        <button
          (click)="isInfoExpanded.set(!isInfoExpanded())"
          [attr.aria-expanded]="isInfoExpanded()"
          class="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-100 transition-colors">
          <div class="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-brand-primary shrink-0" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
            <h2 class="font-semibold text-blue-900">What is Span&lt;T&gt;?</h2>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
            class="w-5 h-5 text-brand-primary transition-transform duration-200"
            [class.rotate-180]="isInfoExpanded()"
            aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
        @if (isInfoExpanded()) {
          <div class="px-4 pb-4 pt-2 space-y-2">
            <p class="text-sm text-blue-800 leading-relaxed">
              <span class="font-mono font-semibold">Span&lt;T&gt;</span> (introduced in .NET Core 2.1) represents a <strong>contiguous slice of memory</strong>. You can think of it as a very thin wrapper holding just two things: a <strong>pointer</strong> to the start of the memory and a <strong>length</strong>.
            </p>
            <p class="text-sm text-blue-800 leading-relaxed">
              It is a <code class="font-mono bg-blue-100 px-1 rounded">readonly ref struct</code>, which means it <strong>always lives on the Stack</strong> - never on the Heap. This makes allocation essentially free. The trade-off: you can't store it as a field on a class.
              <a href="https://steven-giesel.com/blogPost/9a40d278-9a9f-49fe-bbfd-2d813a58e73e/heap-stack-boxing-and-unboxing-performance-lets-order-things" target="_blank" rel="noopener noreferrer" class="ml-1 text-brand-primary underline hover:no-underline text-xs font-medium">Stack vs Heap deep-dive ↗</a>
            </p>
            <p class="text-sm text-blue-800 leading-relaxed">
              <span class="font-mono font-semibold">ReadOnlySpan&lt;T&gt;</span> is the same concept but does not allow mutating the memory it points to - perfect for reading strings without copying them.
            </p>
          </div>
        }
      </div>

      <!-- Tabs -->
      <div class="border-b border-gray-200 mb-6">
        <nav class="flex gap-1" role="tablist" aria-label="Span visualizer sections">
          <button
            role="tab"
            [attr.aria-selected]="activeTab() === 'what-is-span'"
            [attr.tabindex]="activeTab() === 'what-is-span' ? 0 : -1"
            (click)="activeTab.set('what-is-span')"
            class="px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-1"
            [class.bg-white]="activeTab() === 'what-is-span'"
            [class.border]="activeTab() === 'what-is-span'"
            [class.border-b-white]="activeTab() === 'what-is-span'"
            [class.border-gray-200]="activeTab() === 'what-is-span'"
            [class.-mb-px]="activeTab() === 'what-is-span'"
            [class.text-blue-700]="activeTab() === 'what-is-span'"
            [class.text-gray-500]="activeTab() !== 'what-is-span'"
            [class.hover:text-gray-700]="activeTab() !== 'what-is-span'">
            1. What is Span&lt;T&gt;?
          </button>
          <button
            role="tab"
            [attr.aria-selected]="activeTab() === 'substring-vs-slice'"
            [attr.tabindex]="activeTab() === 'substring-vs-slice' ? 0 : -1"
            (click)="activeTab.set('substring-vs-slice')"
            class="px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-1"
            [class.bg-white]="activeTab() === 'substring-vs-slice'"
            [class.border]="activeTab() === 'substring-vs-slice'"
            [class.border-b-white]="activeTab() === 'substring-vs-slice'"
            [class.border-gray-200]="activeTab() === 'substring-vs-slice'"
            [class.-mb-px]="activeTab() === 'substring-vs-slice'"
            [class.text-blue-700]="activeTab() === 'substring-vs-slice'"
            [class.text-gray-500]="activeTab() !== 'substring-vs-slice'"
            [class.hover:text-gray-700]="activeTab() !== 'substring-vs-slice'">
            2. Substring vs Slice
          </button>
          <button
            role="tab"
            [attr.aria-selected]="activeTab() === 'stack-heap'"
            [attr.tabindex]="activeTab() === 'stack-heap' ? 0 : -1"
            (click)="activeTab.set('stack-heap')"
            class="px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-1"
            [class.bg-white]="activeTab() === 'stack-heap'"
            [class.border]="activeTab() === 'stack-heap'"
            [class.border-b-white]="activeTab() === 'stack-heap'"
            [class.border-gray-200]="activeTab() === 'stack-heap'"
            [class.-mb-px]="activeTab() === 'stack-heap'"
            [class.text-blue-700]="activeTab() === 'stack-heap'"
            [class.text-gray-500]="activeTab() !== 'stack-heap'"
            [class.hover:text-gray-700]="activeTab() !== 'stack-heap'">
            3. Stack &amp; Heap
          </button>
        </nav>
      </div>

      <!-- Tab 1: What is Span<T>? -->
      @if (activeTab() === 'what-is-span') {
        <div role="tabpanel" aria-labelledby="tab-what-is-span">
          <div class="grid lg:grid-cols-3 gap-6">
            <!-- Controls -->
            <div class="lg:col-span-1 space-y-4">
              <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h3 class="font-semibold text-gray-800 mb-3 text-sm">Configure</h3>
                <div class="space-y-4">
                  <div>
                    <label for="spanSourceText" class="block text-xs font-semibold text-gray-600 mb-1.5">Source string</label>
                    <input
                      id="spanSourceText"
                      type="text"
                      [ngModel]="sourceText()"
                      (ngModelChange)="onSourceTextChange($event)"
                      maxlength="20"
                      placeholder="e.g. Hello World"
                      class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white shadow-sm font-mono" />
                    <p class="text-[10px] text-gray-400 mt-1">Max 20 characters</p>
                  </div>

                  @if (sourceText().length > 0) {
                    <div>
                      <label for="spanStart" class="block text-xs font-semibold text-gray-600 mb-1.5">
                        Window start: <span class="font-mono text-blue-700">{{ spanStart() }}</span>
                      </label>
                      <input
                        id="spanStart"
                        type="range"
                        [ngModel]="spanStart()"
                        (ngModelChange)="onSpanStartChange($event)"
                        min="0"
                        [max]="sourceText().length - 1"
                        class="w-full accent-blue-600" />
                    </div>
                    <div>
                      <label for="spanLength" class="block text-xs font-semibold text-gray-600 mb-1.5">
                        Window length: <span class="font-mono text-blue-700">{{ spanLength() }}</span>
                      </label>
                      <input
                        id="spanLength"
                        type="range"
                        [ngModel]="spanLength()"
                        (ngModelChange)="onSpanLengthChange($event)"
                        min="1"
                        [max]="maxSpanLength()"
                        class="w-full accent-blue-600" />
                    </div>

                    <div>
                      <p class="text-xs font-semibold text-gray-600 mb-1.5">Span type</p>
                      <div class="inline-flex w-full rounded-lg border border-gray-300 bg-white p-0.5 shadow-sm">
                        <button
                          (click)="spanType.set('Span')"
                          [class]="spanType() === 'Span' ? 'bg-brand-primary text-white shadow-sm' : 'text-gray-700 hover:bg-gray-50'"
                          class="flex-1 py-1.5 text-xs font-semibold rounded-md transition-all"
                          [attr.aria-pressed]="spanType() === 'Span'">
                          Span&lt;char&gt;
                        </button>
                        <button
                          (click)="spanType.set('ReadOnlySpan')"
                          [class]="spanType() === 'ReadOnlySpan' ? 'bg-brand-primary text-white shadow-sm' : 'text-gray-700 hover:bg-gray-50'"
                          class="flex-1 py-1.5 text-xs font-semibold rounded-md transition-all"
                          [attr.aria-pressed]="spanType() === 'ReadOnlySpan'">
                          ReadOnlySpan&lt;char&gt;
                        </button>
                      </div>
                    </div>
                  }
                </div>
              </div>

              <!-- Span struct anatomy -->
              @if (sourceText().length > 0) {
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <h3 class="font-semibold text-gray-800 mb-3 text-sm">
                    {{ spanType() }}&lt;char&gt; struct
                  </h3>
                  <div class="border-2 rounded-lg overflow-hidden"
                    [class.border-brand-primary]="spanType() === 'Span'"
                    [class.border-blue-400]="spanType() === 'ReadOnlySpan'">
                    <div class="px-3 py-1.5 text-xs font-mono font-bold text-white"
                      [class.bg-blue-500]="spanType() === 'Span'"
                      [class.bg-blue-500]="spanType() === 'ReadOnlySpan'">
                      {{ spanType() === 'Span' ? 'ref struct Span&lt;char&gt;' : 'readonly ref struct ReadOnlySpan&lt;char&gt;' }}
                    </div>
                    <div class="divide-y divide-gray-100">
                      <div class="flex items-center justify-between px-3 py-2">
                        <span class="text-xs font-mono text-gray-500">_pointer</span>
                        <span class="text-xs font-mono font-semibold text-gray-800">→ 0x{{ spanPointerAddress() }}</span>
                      </div>
                      <div class="flex items-center justify-between px-3 py-2">
                        <span class="text-xs font-mono text-gray-500">_length</span>
                        <span class="text-xs font-mono font-semibold text-gray-800">{{ spanLength() }}</span>
                      </div>
                      @if (spanType() === 'ReadOnlySpan') {
                        <div class="px-3 py-2 bg-blue-50">
                          <p class="text-[10px] text-blue-700">Read-only: cannot mutate memory</p>
                        </div>
                      } @else {
                        <div class="px-3 py-2 bg-blue-50">
                          <p class="text-[10px] text-blue-700">Read-write: can mutate memory in-place</p>
                        </div>
                      }
                    </div>
                  </div>

                  <div class="mt-3 bg-gray-900 rounded-lg p-3">
                    <p class="text-[10px] text-gray-500 mb-1 font-mono">C# code</p>
                    <code class="text-xs font-mono text-green-400 block leading-relaxed">
                      @if (spanType() === 'Span') {
                        <span>string s = "{{ sourceText() }}";</span><br>
                        <span>Span&lt;char&gt; span =</span><br>
                        <span>&nbsp;&nbsp;s.AsSpan({{ spanStart() }}, {{ spanLength() }});</span>
                      } @else {
                        <span>string s = "{{ sourceText() }}";</span><br>
                        <span>ReadOnlySpan&lt;char&gt; span =</span><br>
                        <span>&nbsp;&nbsp;s.AsSpan({{ spanStart() }}, {{ spanLength() }});</span>
                      }
                    </code>
                  </div>
                </div>
              }
            </div>

            <!-- Memory visualization -->
            <div class="lg:col-span-2 space-y-4">
              @if (sourceText().length === 0) {
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-12 h-12 mx-auto mb-3 opacity-40" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M12 17.25h8.25" />
                  </svg>
                  <p class="text-sm font-medium">Enter a source string to visualize memory</p>
                </div>
              } @else {
                <!-- Underlying char array on Heap -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div class="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-2">
                    <span class="inline-flex items-center gap-1.5 text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">
                      <span class="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" aria-hidden="true"></span>
                      HEAP
                    </span>
                    <h3 class="text-sm font-semibold text-gray-700">
                      Underlying <code class="font-mono">char[]</code> - @ <span class="font-mono text-gray-500">0x{{ BASE_ADDR.toString(16).toUpperCase() }}</span>
                    </h3>
                  </div>
                  <div class="p-5">
                    <div class="flex flex-wrap gap-x-2 gap-y-8">
                      @for (cell of charCells(); track cell.index) {
                        <div class="relative">
                          <div
                            class="w-11 h-11 border-2 rounded-lg flex items-center justify-center text-sm font-mono font-bold transition-all duration-300"
                            [class.border-brand-primary]="cell.inWindow && spanType() === 'Span'"
                            [class.bg-blue-50]="cell.inWindow && spanType() === 'Span'"
                            [class.text-blue-900]="cell.inWindow && spanType() === 'Span'"
                            [class.ring-2]="cell.inWindow"
                            [class.ring-blue-300]="cell.inWindow && spanType() === 'Span'"
                            [class.ring-blue-300]="cell.inWindow && spanType() === 'ReadOnlySpan'"
                            [class.border-blue-500]="cell.inWindow && spanType() === 'ReadOnlySpan'"
                            [class.bg-blue-50]="cell.inWindow && spanType() === 'ReadOnlySpan'"
                            [class.text-blue-900]="cell.inWindow && spanType() === 'ReadOnlySpan'"
                            [class.border-gray-200]="!cell.inWindow"
                            [class.bg-gray-50]="!cell.inWindow"
                            [class.text-gray-400]="!cell.inWindow"
                            [attr.aria-label]="'Character ' + cell.char + ' at index ' + cell.index + (cell.inWindow ? ', inside span window' : '')">
                            {{ cell.char }}
                          </div>
                          <span class="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-gray-400 font-sans whitespace-nowrap">[{{ cell.index }}]</span>
                          <div class="absolute -bottom-9 left-1/2 -translate-x-1/2 text-[9px] font-mono whitespace-nowrap"
                            [class.text-blue-400]="cell.inWindow && spanType() === 'Span'"
                            [class.text-blue-400]="cell.inWindow && spanType() === 'ReadOnlySpan'"
                            [class.text-gray-300]="!cell.inWindow">
                            0x{{ cell.address.toString(16).toUpperCase() }}
                          </div>
                        </div>
                      }
                    </div>

                    <!-- Span window bracket -->
                    @if (spanLength() > 0) {
                      <div class="mt-14 border-t border-dashed pt-3"
                        [class.border-blue-300]="spanType() === 'Span'"
                        [class.border-blue-300]="spanType() === 'ReadOnlySpan'">
                        <div class="flex items-center gap-2">
                          <div class="w-2 h-2 rounded-full"
                            [class.bg-blue-500]="spanType() === 'Span'"
                            [class.bg-blue-500]="spanType() === 'ReadOnlySpan'"
                            aria-hidden="true"></div>
                          <p class="text-xs font-semibold"
                            [class.text-blue-700]="spanType() === 'Span'"
                            [class.text-blue-700]="spanType() === 'ReadOnlySpan'">
                            {{ spanType() }}&lt;char&gt; window: indices [{{ spanStart() }}..{{ spanStart() + spanLength() - 1 }}]
                            - <span class="font-mono">"{{ spanSliceText() }}"</span>
                          </p>
                        </div>
                        <p class="text-[11px] text-gray-500 mt-1 ml-4">
                          No copy made. The span just knows: start at 0x{{ spanPointerAddress() }} and read {{ spanLength() }} char{{ spanLength() === 1 ? '' : 's' }}.
                        </p>
                      </div>
                    }
                  </div>
                </div>

                <!-- Key insight callout -->
                <div class="rounded-lg p-4 border"
                  [class.bg-blue-50]="spanType() === 'Span'"
                  [class.border-blue-200]="spanType() === 'Span'"
                  [class.bg-blue-50]="spanType() === 'ReadOnlySpan'"
                  [class.border-blue-200]="spanType() === 'ReadOnlySpan'">
                  <p class="text-sm font-semibold mb-1"
                    [class.text-blue-800]="spanType() === 'Span'"
                    [class.text-blue-800]="spanType() === 'ReadOnlySpan'">
                    💡 Key insight
                  </p>
                  @if (spanType() === 'Span') {
                    <p class="text-sm text-blue-700">
                      <code class="font-mono bg-blue-100 px-1 rounded">Span&lt;char&gt;</code> is just a struct containing a pointer and a length. Moving the window start/length sliders above does <strong>not</strong> copy any characters - it only changes two numbers in the struct.
                    </p>
                  } @else {
                    <p class="text-sm text-blue-700">
                      <code class="font-mono bg-blue-100 px-1 rounded">ReadOnlySpan&lt;char&gt;</code> works exactly the same, but the compiler prevents you from writing <code class="font-mono bg-blue-100 px-1 rounded">span[0] = 'X'</code>. It's perfect for passing string data to methods without allocating.
                    </p>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- Tab 2: Substring vs Slice -->
      @if (activeTab() === 'substring-vs-slice') {
        <div role="tabpanel" aria-labelledby="tab-substring-vs-slice">
          <!-- Input Controls -->
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
            <div class="flex flex-wrap gap-6 items-start">
              <div class="flex-1 min-w-48">
                <label for="svs-source" class="block text-xs font-semibold text-gray-600 mb-1.5">Source string</label>
                <input
                  id="svs-source"
                  type="text"
                  [ngModel]="svsSource()"
                  (ngModelChange)="onSvsSourceChange($event)"
                  maxlength="24"
                  placeholder="e.g. Hello, World!"
                  class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white shadow-sm font-mono" />
              </div>
              @if (svsSource().length > 1) {
                <div class="flex-1 min-w-36">
                  <label for="svs-start" class="block text-xs font-semibold text-gray-600 mb-1.5">
                    Start: <span class="font-mono text-blue-700">{{ svsStart() }}</span>
                  </label>
                  <input
                    id="svs-start"
                    type="range"
                    [ngModel]="svsStart()"
                    (ngModelChange)="onSvsStartChange($event)"
                    min="0"
                    [max]="svsSource().length - 1"
                    class="w-full accent-blue-600" />
                </div>
                <div class="flex-1 min-w-36">
                  <label for="svs-length" class="block text-xs font-semibold text-gray-600 mb-1.5">
                    Length: <span class="font-mono text-blue-700">{{ svsLength() }}</span>
                  </label>
                  <input
                    id="svs-length"
                    type="range"
                    [ngModel]="svsLength()"
                    (ngModelChange)="onSvsLengthChange($event)"
                    min="1"
                    [max]="maxSvsLength()"
                    class="w-full accent-blue-600" />
                </div>
              }
            </div>
          </div>

          @if (svsSource().length === 0) {
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-400">
              <p class="text-sm font-medium">Enter a source string to compare operations</p>
            </div>
          } @else {
            <!-- Allocation comparison banner -->
            <div class="grid sm:grid-cols-2 gap-3 mb-6">
              <div class="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <span class="text-2xl font-bold text-red-600" aria-label="1 heap allocation">1</span>
                <div>
                  <p class="text-sm font-semibold text-red-800">Substring()</p>
                  <p class="text-xs text-red-600">heap allocation - new string object</p>
                </div>
              </div>
              <div class="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <span class="text-2xl font-bold text-green-600" aria-label="0 heap allocations">0</span>
                <div>
                  <p class="text-sm font-semibold text-green-800">AsSpan().Slice()</p>
                  <p class="text-xs text-green-600">heap allocations - zero-copy view</p>
                </div>
              </div>
            </div>

            <!-- Side by side -->
            <div class="grid lg:grid-cols-2 gap-6">
              <!-- Substring column -->
              <div class="space-y-4">
                <div class="bg-white rounded-xl shadow-sm border-2 border-red-200 overflow-hidden">
                  <div class="bg-red-50 px-4 py-3 border-b border-red-200">
                    <div class="flex items-center justify-between">
                      <h3 class="text-sm font-bold text-red-800">string.Substring()</h3>
                      <span class="text-xs font-bold text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full">
                        🚨 1 allocation
                      </span>
                    </div>
                  </div>
                  <div class="p-4 space-y-4">
                    <!-- Original string on heap -->
                    <div>
                      <div class="flex items-center gap-2 mb-2">
                        <span class="text-[10px] font-semibold bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded">HEAP</span>
                        <span class="text-xs text-gray-500 font-mono">Original string @ 0x{{ BASE_ADDR.toString(16).toUpperCase() }}</span>
                      </div>
                      <div class="flex flex-wrap gap-x-1.5 gap-y-6">
                        @for (cell of svsSourceCells(); track cell.index) {
                          <div class="relative">
                            <div
                              class="w-9 h-9 border rounded-lg flex items-center justify-center text-xs font-mono font-bold"
                              [class.border-gray-300]="!isSvsSelected(cell.index)"
                              [class.bg-gray-50]="!isSvsSelected(cell.index)"
                              [class.text-gray-400]="!isSvsSelected(cell.index)"
                              [class.border-red-400]="isSvsSelected(cell.index)"
                              [class.bg-red-50]="isSvsSelected(cell.index)"
                              [class.text-red-800]="isSvsSelected(cell.index)">
                              {{ cell.char }}
                            </div>
                            <span class="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] text-gray-400 font-sans whitespace-nowrap">[{{ cell.index }}]</span>
                          </div>
                        }
                      </div>
                    </div>

                    <!-- Arrow -->
                    <div class="flex items-center gap-2 py-2" aria-hidden="true">
                      <div class="flex-1 border-t-2 border-dashed border-red-200"></div>
                      <div class="text-xs text-red-400 font-medium">copies chars → new object</div>
                      <div class="flex-1 border-t-2 border-dashed border-red-200"></div>
                    </div>

                    <!-- New string on heap -->
                    <div>
                      <div class="flex items-center gap-2 mb-2">
                        <span class="text-[10px] font-semibold bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded">HEAP</span>
                        <span class="text-xs text-red-600 font-mono font-semibold">New string @ 0x{{ SVS_NEW_ADDR.toString(16).toUpperCase() }}</span>
                      </div>
                      <div class="flex flex-wrap gap-x-1.5 gap-y-6">
                        @for (cell of svsSubstringCells(); track cell.index) {
                          <div class="relative">
                            <div class="w-9 h-9 border-2 border-red-500 bg-red-50 rounded-lg flex items-center justify-center text-xs font-mono font-bold text-red-800 shadow-sm">
                              {{ cell.char }}
                            </div>
                            <span class="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] text-red-400 font-sans whitespace-nowrap">[{{ cell.index }}]</span>
                          </div>
                        }
                      </div>
                    </div>

                    <!-- Code -->
                    <div class="bg-gray-900 rounded-lg p-3 mt-4">
                      <p class="text-[10px] text-gray-500 mb-1 font-mono">C# code</p>
                      <code class="text-xs font-mono text-green-400 leading-relaxed block">
                        string s = "{{ svsSource() }}";<br>
                        string result =<br>
                        &nbsp;&nbsp;s.Substring({{ svsStart() }}, {{ svsLength() }});<br>
                        // result = "{{ svsResultText() }}"<br>
                        // ⚠ new string object on Heap!
                      </code>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Slice column -->
              <div class="space-y-4">
                <div class="bg-white rounded-xl shadow-sm border-2 border-green-200 overflow-hidden">
                  <div class="bg-green-50 px-4 py-3 border-b border-green-200">
                    <div class="flex items-center justify-between">
                      <h3 class="text-sm font-bold text-green-800">AsSpan().Slice()</h3>
                      <span class="text-xs font-bold text-green-600 bg-green-100 border border-green-200 px-2 py-0.5 rounded-full">
                        ✅ 0 allocations
                      </span>
                    </div>
                  </div>
                  <div class="p-4 space-y-4">
                    <!-- Same original string, span window -->
                    <div>
                      <div class="flex items-center gap-2 mb-2">
                        <span class="text-[10px] font-semibold bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded">HEAP</span>
                        <span class="text-xs text-gray-500 font-mono">Same string @ 0x{{ BASE_ADDR.toString(16).toUpperCase() }}</span>
                      </div>
                      <div class="flex flex-wrap gap-x-1.5 gap-y-6">
                        @for (cell of svsSourceCells(); track cell.index) {
                          <div class="relative">
                            <div
                              class="w-9 h-9 border-2 rounded-lg flex items-center justify-center text-xs font-mono font-bold transition-all"
                              [class.border-green-500]="isSvsSelected(cell.index)"
                              [class.bg-green-50]="isSvsSelected(cell.index)"
                              [class.text-green-800]="isSvsSelected(cell.index)"
                              [class.ring-2]="isSvsSelected(cell.index)"
                              [class.ring-green-300]="isSvsSelected(cell.index)"
                              [class.border-gray-300]="!isSvsSelected(cell.index)"
                              [class.bg-gray-50]="!isSvsSelected(cell.index)"
                              [class.text-gray-400]="!isSvsSelected(cell.index)">
                              {{ cell.char }}
                            </div>
                            <span class="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] text-gray-400 font-sans whitespace-nowrap">[{{ cell.index }}]</span>
                          </div>
                        }
                      </div>
                    </div>

                    <!-- No new allocation indicator -->
                    <div class="flex items-center gap-2 py-2" aria-hidden="true">
                      <div class="flex-1 border-t-2 border-dashed border-green-200"></div>
                      <div class="text-xs text-green-500 font-medium">no copy - just pointer + length</div>
                      <div class="flex-1 border-t-2 border-dashed border-green-200"></div>
                    </div>

                    <!-- Span struct on stack -->
                    <div>
                      <div class="flex items-center gap-2 mb-2">
                        <span class="text-[10px] font-semibold bg-teal-100 text-teal-700 border border-teal-200 px-1.5 py-0.5 rounded">STACK</span>
                        <span class="text-xs text-green-700 font-semibold">ReadOnlySpan&lt;char&gt; struct (8–16 bytes)</span>
                      </div>
                      <div class="border-2 border-green-400 rounded-lg overflow-hidden">
                        <div class="bg-green-500 px-3 py-1">
                          <span class="text-xs font-mono font-bold text-white">readonly ref struct ReadOnlySpan&lt;char&gt;</span>
                        </div>
                        <div class="divide-y divide-gray-100 bg-white">
                          <div class="flex items-center justify-between px-3 py-2">
                            <span class="text-xs font-mono text-gray-500">_pointer</span>
                            <span class="text-xs font-mono font-bold text-green-700">→ 0x{{ svsSpanPointer() }}</span>
                          </div>
                          <div class="flex items-center justify-between px-3 py-2">
                            <span class="text-xs font-mono text-gray-500">_length</span>
                            <span class="text-xs font-mono font-bold text-green-700">{{ svsLength() }}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Code -->
                    <div class="bg-gray-900 rounded-lg p-3 mt-4">
                      <p class="text-[10px] text-gray-500 mb-1 font-mono">C# code</p>
                      <code class="text-xs font-mono text-green-400 leading-relaxed block">
                        string s = "{{ svsSource() }}";<br>
                        ReadOnlySpan&lt;char&gt; span =<br>
                        &nbsp;&nbsp;s.AsSpan({{ svsStart() }}, {{ svsLength() }});<br>
                        // span = "{{ svsResultText() }}"<br>
                        // ✅ Zero heap allocations!
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Summary note -->
            <div class="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p class="text-sm text-amber-800">
                <strong>When does it matter?</strong> In hot paths (e.g. parsing, processing large files, web request handling) calling <code class="font-mono bg-amber-100 px-1 rounded">Substring()</code> in a loop can create thousands of short-lived strings, increasing GC pressure. <code class="font-mono bg-amber-100 px-1 rounded">AsSpan().Slice()</code> avoids this entirely.
              </p>
            </div>
          }
        </div>
      }

      <!-- Tab 3: Stack & Heap -->
      @if (activeTab() === 'stack-heap') {
        <div role="tabpanel" aria-labelledby="tab-stack-heap" class="space-y-6">

          <!-- Nuance callout - the most important message -->
          <div class="bg-emerald-50 border-l-4 border-emerald-500 rounded-lg p-4">
            <p class="text-sm font-bold text-emerald-900 mb-1">💡 Heap allocation is not bad - it's the right default</p>
            <p class="text-sm text-emerald-800 leading-relaxed">
              The .NET GC is highly optimised. For long-lived objects, large data, or anything shared across methods and threads, the Heap is exactly where you want to be. Avoiding all allocations is not the goal - <strong>avoiding <em>unnecessary</em> short-lived allocations in hot paths</strong> is. Measure first, optimize second.
            </p>
          </div>

          <!-- Stack frames & Span lifecycle -->
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h3 class="text-sm font-bold text-gray-800">Stack Frames &amp; the Lifetime of Span</h3>
              <p class="text-xs text-gray-500 mt-0.5">Each method call gets its own stack frame. When the method returns, the frame is gone.</p>
            </div>
            <div class="p-5">
              <div class="grid lg:grid-cols-2 gap-6">
                <!-- Call stack diagram -->
                <div>
                  <p class="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">Call stack (grows downward)</p>
                  <!-- Frame: Main -->
                  <div class="border-2 border-gray-300 rounded-lg overflow-hidden mb-0.5">
                    <div class="bg-gray-200 px-3 py-1.5 flex items-center justify-between">
                      <span class="text-xs font-mono font-bold text-gray-700">Main()</span>
                      <span class="text-[10px] text-gray-500">frame 1</span>
                    </div>
                    <div class="px-3 py-2 bg-white divide-y divide-gray-100">
                      <div class="py-1 flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-orange-400 shrink-0" aria-hidden="true"></span>
                        <code class="text-xs font-mono text-orange-700">string input</code>
                        <span class="text-[10px] text-gray-400 ml-auto">→ Heap ref</span>
                      </div>
                    </div>
                  </div>
                  <!-- Connector -->
                  <div class="flex justify-center my-0.5" aria-hidden="true">
                    <div class="w-0.5 h-4 bg-gray-300"></div>
                  </div>
                  <!-- Frame: ProcessText -->
                  <div class="border-2 border-teal-400 rounded-lg overflow-hidden mb-0.5">
                    <div class="bg-teal-100 px-3 py-1.5 flex items-center justify-between">
                      <span class="text-xs font-mono font-bold text-teal-800">ProcessText(string s)</span>
                      <span class="text-[10px] text-teal-600">frame 2 ← active</span>
                    </div>
                    <div class="px-3 py-2 bg-white divide-y divide-gray-100">
                      <div class="py-1 flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-orange-400 shrink-0" aria-hidden="true"></span>
                        <code class="text-xs font-mono text-orange-700">string s</code>
                        <span class="text-[10px] text-gray-400 ml-auto">→ Heap ref (copy of ref)</span>
                      </div>
                      <div class="py-1 flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-teal-500 shrink-0" aria-hidden="true"></span>
                        <code class="text-xs font-mono text-teal-700">ReadOnlySpan&lt;char&gt; span</code>
                        <span class="text-[10px] text-gray-400 ml-auto">lives here only ⬇</span>
                      </div>
                      <div class="py-1 flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-teal-500 shrink-0" aria-hidden="true"></span>
                        <code class="text-xs font-mono text-teal-700">int count</code>
                        <span class="text-[10px] text-gray-400 ml-auto">value</span>
                      </div>
                    </div>
                  </div>
                  <!-- Frame: Helper -->
                  <div class="border-2 border-blue-300 rounded-lg overflow-hidden mb-0.5">
                    <div class="bg-blue-100 px-3 py-1.5 flex items-center justify-between">
                      <span class="text-xs font-mono font-bold text-blue-800">CountVowels(ReadOnlySpan&lt;char&gt; s)</span>
                      <span class="text-[10px] text-brand-primary">frame 3</span>
                    </div>
                    <div class="px-3 py-2 bg-white divide-y divide-gray-100">
                      <div class="py-1 flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-teal-500 shrink-0" aria-hidden="true"></span>
                        <code class="text-xs font-mono text-teal-700">ReadOnlySpan&lt;char&gt; s</code>
                        <span class="text-[10px] text-gray-400 ml-auto">copy of struct (ptr+len)</span>
                      </div>
                    </div>
                  </div>
                  <!-- Return arrow -->
                  <div class="flex justify-center my-1" aria-hidden="true">
                    <div class="flex flex-col items-center">
                      <div class="w-0.5 h-3 bg-gray-300"></div>
                      <svg class="w-3 h-3 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                      <span class="text-[10px] text-gray-400 mt-0.5">on return, frames 2 &amp; 3 are freed instantly</span>
                    </div>
                  </div>
                </div>

                <!-- Lifecycle explanation -->
                <div class="space-y-3">
                  <div class="bg-teal-50 border border-teal-200 rounded-lg p-3">
                    <p class="text-xs font-bold text-teal-800 mb-1">Span's lifetime = its stack frame</p>
                    <p class="text-xs text-teal-700 leading-relaxed">
                      A <code class="font-mono bg-teal-100 px-0.5 rounded">Span&lt;T&gt;</code> is a struct that lives in the stack frame of the method that declares it. When that method returns, the frame is popped - the Span is gone. The underlying data (on the Heap) still exists until the GC collects it, but the Span itself no longer occupies any memory.
                    </p>
                  </div>
                  <div class="bg-teal-50 border border-teal-200 rounded-lg p-3">
                    <p class="text-xs font-bold text-teal-800 mb-1">Passing a Span to a method</p>
                    <p class="text-xs text-teal-700 leading-relaxed">
                      When you pass a <code class="font-mono bg-teal-100 px-0.5 rounded">ReadOnlySpan&lt;char&gt;</code> to <code class="font-mono bg-teal-100 px-0.5 rounded">CountVowels()</code>, a <strong>copy of the struct</strong> (just the pointer + length) is placed in frame 3. No heap allocation. When <code class="font-mono bg-teal-100 px-0.5 rounded">CountVowels</code> returns, that copy is freed automatically.
                    </p>
                  </div>
                  <div class="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p class="text-xs font-bold text-gray-700 mb-1">Stack allocation cost</p>
                    <p class="text-xs text-gray-600 leading-relaxed">
                      Placing a value on the stack means incrementing the stack pointer register - a single CPU instruction. There is no OS call, no GC bookkeeping, no memory search. It is the cheapest possible "allocation".
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Why Span can't cross async/yield -->
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div class="bg-amber-50 px-4 py-3 border-b border-amber-200">
              <h3 class="text-sm font-bold text-amber-800">Why Span can't cross <code class="font-mono">await</code> or <code class="font-mono">yield</code> boundaries</h3>
              <p class="text-xs text-amber-600 mt-0.5">The compiler transforms these methods into heap-allocated state machines.</p>
            </div>
            <div class="p-5 space-y-5">
              <!-- async/await -->
              <div class="grid lg:grid-cols-2 gap-4">
                <div>
                  <p class="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                    <span class="w-5 h-5 bg-red-100 text-red-700 rounded text-[10px] font-bold flex items-center justify-center" aria-hidden="true">✗</span>
                    Invalid - Span across <code class="font-mono">await</code>
                  </p>
                  <div class="bg-gray-900 rounded-lg p-3">
                    <code class="text-xs font-mono text-gray-200 leading-relaxed block">
                      <span class="text-red-400">// ❌ COMPILER ERROR</span><br>
                      <span class="text-blue-300">async</span> <span class="text-green-400">Task</span> ProcessAsync()<br>
                      &#123;<br>
                      &nbsp;&nbsp;<span class="text-green-400">ReadOnlySpan</span>&lt;<span class="text-green-400">char</span>&gt; span<br>
                      &nbsp;&nbsp;&nbsp;&nbsp;= "hello".AsSpan();<br>
                      &nbsp;&nbsp;<br>
                      &nbsp;&nbsp;<span class="text-blue-300">await</span> SomeTask(); <span class="text-red-400">// ← crosses here</span><br>
                      &nbsp;&nbsp;<br>
                      &nbsp;&nbsp;<span class="text-gray-500">// span is still "used" here</span><br>
                      &nbsp;&nbsp;Console.Write(span[0]);<br>
                      &#125;
                    </code>
                  </div>
                </div>
                <div class="space-y-3">
                  <div class="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p class="text-xs font-bold text-amber-800 mb-1">What the compiler does with async</p>
                    <p class="text-xs text-amber-700 leading-relaxed">
                      The C# compiler rewrites every <code class="font-mono bg-amber-100 px-0.5 rounded">async</code> method into a <strong>state machine class</strong> on the Heap. All local variables that "survive" across an <code class="font-mono bg-amber-100 px-0.5 rounded">await</code> become <strong>fields</strong> on that class so they can be restored when the task resumes.
                    </p>
                  </div>
                  <div class="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p class="text-xs font-bold text-red-800 mb-1">Why Span can't be a field</p>
                    <p class="text-xs text-red-700 leading-relaxed">
                      <code class="font-mono bg-red-100 px-0.5 rounded">Span&lt;T&gt;</code> is a <code class="font-mono bg-red-100 px-0.5 rounded">ref struct</code>. The CLR forbids <code class="font-mono bg-red-100 px-0.5 rounded">ref struct</code>s as fields on a class - because a class lives on the Heap, which would mean the Span (with its raw pointer) also lives on the Heap, which would break the GC's safety guarantees. So the compiler rejects the code outright.
                    </p>
                  </div>
                </div>
              </div>

              <div class="border-t border-gray-100 pt-5">
                <div class="grid lg:grid-cols-2 gap-4">
                  <div>
                    <p class="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                      <span class="w-5 h-5 bg-red-100 text-red-700 rounded text-[10px] font-bold flex items-center justify-center" aria-hidden="true">✗</span>
                      Invalid - Span across <code class="font-mono">yield</code>
                    </p>
                    <div class="bg-gray-900 rounded-lg p-3">
                      <code class="text-xs font-mono text-gray-200 leading-relaxed block">
                        <span class="text-red-400">// ❌ COMPILER ERROR</span><br>
                        <span class="text-green-400">IEnumerable</span>&lt;<span class="text-blue-300">int</span>&gt; Find()<br>
                        &#123;<br>
                        &nbsp;&nbsp;<span class="text-green-400">ReadOnlySpan</span>&lt;<span class="text-green-400">char</span>&gt; span<br>
                        &nbsp;&nbsp;&nbsp;&nbsp;= "hello".AsSpan();<br>
                        &nbsp;&nbsp;<br>
                        &nbsp;&nbsp;<span class="text-blue-300">yield return</span> 1; <span class="text-red-400">// ← crosses here</span><br>
                        &nbsp;&nbsp;<br>
                        &nbsp;&nbsp;Console.Write(span[0]);<br>
                        &#125;
                      </code>
                    </div>
                  </div>
                  <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 self-start">
                    <p class="text-xs font-bold text-amber-800 mb-1">Same reason: iterator state machines</p>
                    <p class="text-xs text-amber-700 leading-relaxed">
                      Methods with <code class="font-mono bg-amber-100 px-0.5 rounded">yield return</code> are also rewritten into state machine classes. Execution is suspended at every <code class="font-mono bg-amber-100 px-0.5 rounded">yield</code> and resumed later - so again, local variables that span the boundary must become heap fields. The same constraint applies.
                    </p>
                  </div>
                </div>
              </div>

              <!-- The fix -->
              <div class="border-t border-gray-100 pt-4">
                <p class="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                  <span class="w-5 h-5 bg-green-100 text-green-700 rounded text-[10px] font-bold flex items-center justify-center" aria-hidden="true">✓</span>
                  The pattern: use Span in a synchronous helper, call it from async code
                </p>
                <div class="bg-gray-900 rounded-lg p-3">
                  <code class="text-xs font-mono text-gray-200 leading-relaxed block">
                    <span class="text-gray-500">// ✅ Works - Span stays inside a sync method</span><br>
                    <span class="text-blue-300">async</span> <span class="text-green-400">Task</span>&lt;<span class="text-blue-300">int</span>&gt; ProcessAsync(<span class="text-green-400">string</span> s)<br>
                    &#123;<br>
                    &nbsp;&nbsp;<span class="text-blue-300">var</span> count = CountVowels(s.AsSpan()); <span class="text-gray-500">// sync call</span><br>
                    &nbsp;&nbsp;<span class="text-blue-300">await</span> SaveAsync(count);            <span class="text-gray-500">// no Span here</span><br>
                    &nbsp;&nbsp;<span class="text-blue-300">return</span> count;<br>
                    &#125;<br>
                    <br>
                    <span class="text-blue-300">static int</span> CountVowels(<span class="text-green-400">ReadOnlySpan</span>&lt;<span class="text-green-400">char</span>&gt; s)<br>
                    &#123;<br>
                    &nbsp;&nbsp;<span class="text-blue-300">var</span> n = 0;<br>
                    &nbsp;&nbsp;<span class="text-blue-300">foreach</span> (<span class="text-blue-300">var</span> c <span class="text-blue-300">in</span> s) <span class="text-blue-300">if</span> (<span class="text-green-400">"aeiou"</span>.Contains(c)) n++;<br>
                    &nbsp;&nbsp;<span class="text-blue-300">return</span> n;<br>
                    &#125;
                  </code>
                </div>
              </div>
            </div>
          </div>

          <!-- Stack vs Heap comparison - nuanced -->
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h3 class="text-sm font-bold text-gray-800">Stack vs Heap - choosing the right tool</h3>
            </div>
            <div class="p-5">
              <div class="grid lg:grid-cols-2 gap-6">
                <!-- Stack -->
                <div>
                  <div class="flex items-center gap-2 mb-3">
                    <div class="w-3 h-3 rounded bg-teal-500" aria-hidden="true"></div>
                    <h4 class="text-sm font-bold text-gray-800">Stack</h4>
                    <span class="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">scope-bound · auto-freed</span>
                  </div>
                  <div class="space-y-2">
                    <div class="bg-teal-50 border border-teal-200 rounded-lg p-3">
                      <p class="text-xs font-bold text-teal-800 mb-1.5">Use for</p>
                      <ul class="text-xs text-teal-700 space-y-1">
                        <li class="flex items-start gap-1.5"><span class="text-teal-500 mt-0.5 shrink-0">✓</span>Short-lived, scope-local data (loop variables, temp buffers)</li>
                        <li class="flex items-start gap-1.5"><span class="text-teal-500 mt-0.5 shrink-0">✓</span><code class="font-mono bg-teal-100 px-0.5 rounded">Span&lt;T&gt;</code> / <code class="font-mono bg-teal-100 px-0.5 rounded">ReadOnlySpan&lt;T&gt;</code> windows into existing memory</li>
                        <li class="flex items-start gap-1.5"><span class="text-teal-500 mt-0.5 shrink-0">✓</span>Small value types (<code class="font-mono bg-teal-100 px-0.5 rounded">int</code>, <code class="font-mono bg-teal-100 px-0.5 rounded">bool</code>, small structs)</li>
                        <li class="flex items-start gap-1.5"><span class="text-teal-500 mt-0.5 shrink-0">✓</span>Hot parsing loops where every allocation counts</li>
                      </ul>
                    </div>
                    <div class="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <p class="text-xs font-bold text-gray-700 mb-1.5">Constraints</p>
                      <ul class="text-xs text-gray-600 space-y-1">
                        <li class="flex items-start gap-1.5"><span class="text-gray-400 shrink-0">·</span>Fixed size per thread (OS-dependent default - stack overflow if exceeded)</li>
                        <li class="flex items-start gap-1.5"><span class="text-gray-400 shrink-0">·</span>Cannot outlive the method that created the value</li>
                        <li class="flex items-start gap-1.5"><span class="text-gray-400 shrink-0">·</span><code class="font-mono bg-gray-100 px-0.5 rounded">ref struct</code>s can't be shared across threads, async, or iterators</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <!-- Heap -->
                <div>
                  <div class="flex items-center gap-2 mb-3">
                    <div class="w-3 h-3 rounded bg-orange-500" aria-hidden="true"></div>
                    <h4 class="text-sm font-bold text-gray-800">Heap</h4>
                    <span class="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">GC-managed · dynamic · shared</span>
                  </div>
                  <div class="space-y-2">
                    <div class="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <p class="text-xs font-bold text-orange-800 mb-1.5">Use for - and this is most code!</p>
                      <ul class="text-xs text-orange-700 space-y-1">
                        <li class="flex items-start gap-1.5"><span class="text-orange-500 mt-0.5 shrink-0">✓</span>Objects that outlive a single method (<code class="font-mono bg-orange-100 px-0.5 rounded">class</code>, <code class="font-mono bg-orange-100 px-0.5 rounded">string</code>, collections)</li>
                        <li class="flex items-start gap-1.5"><span class="text-orange-500 mt-0.5 shrink-0">✓</span>Anything shared across async boundaries or threads</li>
                        <li class="flex items-start gap-1.5"><span class="text-orange-500 mt-0.5 shrink-0">✓</span>Large data structures - heap is essentially unlimited</li>
                        <li class="flex items-start gap-1.5"><span class="text-orange-500 mt-0.5 shrink-0">✓</span>Returning data from a method to its caller</li>
                      </ul>
                    </div>
                    <div class="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <p class="text-xs font-bold text-gray-700 mb-1.5">The real cost of heap allocation</p>
                      <p class="text-xs text-gray-600 leading-relaxed">
                        A single allocation is cheap - the GC's gen-0 allocator is highly optimized. The issue arises in <strong>high-frequency hot paths</strong>: thousands of short-lived objects per second drive frequent gen-0 collections and occasional promotions to gen-1/gen-2, which pause execution. That's when Span pays off.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      }
    </div>
  `,
})
export class SpanVisualizerComponent {
  protected readonly BASE_ADDR = 0x5000;
  protected readonly SVS_NEW_ADDR = 0x8F40;
  protected readonly BYTES_PER_CHAR = 2; // UTF-16 chars in .NET

  // Tab 1 state
  protected readonly activeTab = signal<ActiveTab>('what-is-span');
  protected readonly isInfoExpanded = signal<boolean>(true);
  protected readonly sourceText = signal<string>('Hello World');
  protected readonly spanStart = signal<number>(0);
  protected readonly spanLength = signal<number>(5);
  protected readonly spanType = signal<SpanType>('Span');

  protected readonly maxSpanLength = computed(() =>
    Math.max(1, this.sourceText().length - this.spanStart())
  );

  protected readonly charCells = computed<CharCell[]>(() => {
    const text = this.sourceText();
    const start = this.spanStart();
    const len = this.spanLength();
    return text.split('').map((char, i) => ({
      char,
      index: i,
      address: this.BASE_ADDR + i * this.BYTES_PER_CHAR,
      inWindow: i >= start && i < start + len,
    }));
  });

  protected readonly spanPointerAddress = computed(() => {
    const addr = this.BASE_ADDR + this.spanStart() * this.BYTES_PER_CHAR;
    return addr.toString(16).toUpperCase();
  });

  protected readonly spanSliceText = computed(() => {
    const text = this.sourceText();
    return text.slice(this.spanStart(), this.spanStart() + this.spanLength());
  });

  // Tab 2 state
  protected readonly svsSource = signal<string>('Hello, World!');
  protected readonly svsStart = signal<number>(0);
  protected readonly svsLength = signal<number>(5);

  protected readonly maxSvsLength = computed(() =>
    Math.max(1, this.svsSource().length - this.svsStart())
  );

  protected readonly svsResultText = computed(() =>
    this.svsSource().slice(this.svsStart(), this.svsStart() + this.svsLength())
  );

  protected readonly svsSourceCells = computed<SubstringCharCell[]>(() =>
    this.svsSource().split('').map((char, i) => ({
      char,
      index: i,
      address: this.BASE_ADDR + i * this.BYTES_PER_CHAR,
    }))
  );

  protected readonly svsSubstringCells = computed<SubstringCharCell[]>(() =>
    this.svsResultText().split('').map((char, i) => ({
      char,
      index: i,
      address: this.SVS_NEW_ADDR + i * this.BYTES_PER_CHAR,
    }))
  );

  protected readonly svsSpanPointer = computed(() => {
    const addr = this.BASE_ADDR + this.svsStart() * this.BYTES_PER_CHAR;
    return addr.toString(16).toUpperCase();
  });

  protected isSvsSelected(index: number): boolean {
    return index >= this.svsStart() && index < this.svsStart() + this.svsLength();
  }

  protected onSourceTextChange(value: string): void {
    this.sourceText.set(value);
    const maxStart = Math.max(0, value.length - 1);
    if (this.spanStart() > maxStart) {
      this.spanStart.set(maxStart);
    }
    const maxLen = Math.max(1, value.length - this.spanStart());
    if (this.spanLength() > maxLen) {
      this.spanLength.set(maxLen);
    }
  }

  protected onSpanStartChange(value: number): void {
    const numVal = Number(value);
    this.spanStart.set(numVal);
    const maxLen = Math.max(1, this.sourceText().length - numVal);
    if (this.spanLength() > maxLen) {
      this.spanLength.set(maxLen);
    }
  }

  protected onSpanLengthChange(value: number): void {
    this.spanLength.set(Number(value));
  }

  protected onSvsSourceChange(value: string): void {
    this.svsSource.set(value);
    const maxStart = Math.max(0, value.length - 1);
    if (this.svsStart() > maxStart) {
      this.svsStart.set(maxStart);
    }
    const maxLen = Math.max(1, value.length - this.svsStart());
    if (this.svsLength() > maxLen) {
      this.svsLength.set(maxLen);
    }
  }

  protected onSvsStartChange(value: number): void {
    const numVal = Number(value);
    this.svsStart.set(numVal);
    const maxLen = Math.max(1, this.svsSource().length - numVal);
    if (this.svsLength() > maxLen) {
      this.svsLength.set(maxLen);
    }
  }

  protected onSvsLengthChange(value: number): void {
    this.svsLength.set(Number(value));
  }
}
