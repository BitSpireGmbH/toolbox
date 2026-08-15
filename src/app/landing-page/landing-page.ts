import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DOTNET_BUILD_INFO } from '../../environments/dotnet-build-info';
import { TOOL_CATEGORIES, Tool, ToolCategory, toolsByCategory } from '../shared/tools.registry';
import { ToolIconComponent } from '../shared/tool-icon/tool-icon.component';

interface ToolGroup {
  category: ToolCategory;
  tools: Tool[];
}

@Component({
  selector: 'app-landing-page',
  imports: [RouterLink, ToolIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-linear-to-br from-gray-50 via-blue-50 to-purple-50 flex items-center justify-center p-6">
      <div class="max-w-7xl w-full">
        <!-- Header -->
        <header class="text-center mb-12 animate-fade-in">
          <div class="mb-6 relative inline-block">
            <div class="absolute inset-0 bg-linear-to-r from-brand-primary to-brand-secondary blur-2xl opacity-20 rounded-full"></div>
              <img src="assets/logo.webp" alt="Logo" class="w-56 mx-auto relative" width="224" height="auto" />
          </div>
          <h1 class="text-5xl md:text-6xl font-bold bg-linear-to-r from-brand-primary to-brand-secondary bg-clip-text text-transparent mb-4">
            Developer Toolbox
          </h1>
          <div class="flex flex-wrap items-center justify-center gap-2 mb-4">
            <a
              href="https://bitspire.ch"
              target="_blank"
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/70 border border-gray-200 text-xs font-medium text-gray-600 hover:text-brand-primary hover:border-brand-primary transition-colors shadow-sm">
              <span aria-hidden="true">⚡</span>
              <span>Made by BitSpire - open source</span>
            </a>
            <span
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/70 border border-violet-200 text-xs font-medium text-violet-700 shadow-sm"
              [title]="dotnetTitle">
              <span aria-hidden="true">🧩</span>
              <span>Runs real .NET {{ dotnetRelease }} · SDK {{ dotnet.sdkVersion }}</span>
            </span>
          </div>
          <p class="text-xl text-gray-600 font-medium max-w-2xl mx-auto mb-6">
            Your go-to collection of tools for everyday web development
          </p>
          <p class="text-base text-gray-500 max-w-3xl mx-auto leading-relaxed">
            Whether you're converting data formats, debugging tokens, or designing middleware pipelines -
            we've got you covered. All tools run entirely in your browser with no data stored on servers.
          </p>
          <p class="text-sm text-gray-400 max-w-3xl mx-auto mt-4 flex items-center justify-center gap-2">
            <span>💡 Tip: Press</span>
            <kbd class="px-2 py-1 rounded border border-gray-300 bg-gray-100 font-mono text-xs font-semibold text-gray-700">{{ keyboardShortcut() }}</kbd>
            <span>to search</span>
          </p>
        </header>

        <!-- Tool Sections -->
        <main class="space-y-12">
          <h2 class="sr-only">Available Tools</h2>

          @for (group of groups; track group.category) {
            <section>
              <h2 class="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                @switch (group.category) {
                  @case ('Converters') {
                    <svg class="w-6 h-6 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  }
                  @case ('ASP.NET Core') {
                    <svg class="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  }
                  @case ('Architecture & Analysis') {
                    <svg class="w-6 h-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  }
                  @case ('Utilities') {
                    <svg class="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  }
                }
                {{ group.category }}
              </h2>
              <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                @for (tool of group.tools; track tool.path) {
                  <a
                    [routerLink]="'/' + tool.path"
                    [class]="
                      'group relative block bg-white rounded-lg shadow-sm hover:shadow-xl transition-all duration-300 p-4 border border-gray-200 overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 ' +
                      tool.accent.border + ' ' + tool.accent.ring
                    ">
                    <div
                      [class]="
                        'absolute inset-0 bg-linear-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300 ' + tool.accent.overlay
                      "></div>
                    <div class="relative">
                      <div class="flex items-center gap-3 mb-3">
                        <div
                          [class]="
                            'w-10 h-10 bg-linear-to-br rounded-md flex items-center justify-center text-white shadow-sm group-hover:shadow-md transition-all duration-300 ' +
                            tool.accent.badge
                          "
                          aria-hidden="true">
                          <app-tool-icon [name]="tool.icon" svgClass="w-5 h-5" />
                        </div>
                        <div>
                          <h3 [class]="'text-base font-bold text-gray-900 transition-colors duration-300 ' + tool.accent.titleHover">
                            {{ tool.title }}
                          </h3>
                          <span class="text-xs text-gray-500 font-medium">{{ tool.tagline }}</span>
                        </div>
                      </div>
                      <p class="text-sm text-gray-600 leading-relaxed mb-3">{{ tool.description }}</p>
                      <div [class]="'flex items-center gap-1.5 font-semibold text-xs ' + tool.accent.ctaText">
                        <span>{{ tool.cta }}</span>
                        <svg
                          class="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform duration-300"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          aria-hidden="true">
                          <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                      </div>
                    </div>
                  </a>
                }
              </div>
            </section>
          }
        </main>

        <!-- Footer Info -->
        <footer class="mt-16 text-center text-gray-500 text-sm space-y-2">
          <p class="font-medium">Built with Angular • Privacy-first • <a href="https://github.com/BitSpireGmbH/toolbox" class="hover:text-brand-primary transition-colors">Open source</a></p>
          <p class="text-xs">All processing happens in your browser • No data sent to servers</p>
          <p class="text-xs">
            Found a bug or have a feature idea?
            <a
              href="https://github.com/BitSpireGmbH/toolbox/issues"
              class="text-brand-primary hover:text-brand-secondary transition-colors font-medium inline-flex items-center gap-1"
              target="_blank"
              aria-label="Report bugs or request features on GitHub (opens in a new tab)">
              <span>Report it here</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3 h-3 flex-shrink-0" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          </p>
          <a href="https://bitspire.ch" class="mt-4 inline-flex items-center justify-center gap-2" target="_blank">
            <span class="text-xs">Made by BitSpire</span>
            <img src="assets/bitspire-logo.webp" alt="BitSpire Logo" class="w-24" height="auto" />
          </a>
        </footer>
      </div>
    </div>
  `,
  styles: []
})
export class LandingPageComponent {
  protected readonly groups: ToolGroup[] = TOOL_CATEGORIES.map(category => ({
    category,
    tools: toolsByCategory(category),
  }));

  protected readonly keyboardShortcut = signal(this.getKeyboardShortcut());

  /**
   * Build-time values, so the landing page costs nothing extra. The multi-megabyte
   * runtime is deliberately not loaded here - the tools that need it fetch it on
   * demand, and they report the live version once it is actually up.
   */
  protected readonly dotnet = DOTNET_BUILD_INFO;
  /** `net10.0` is the moniker; people call it ".NET 10". */
  protected readonly dotnetRelease = DOTNET_BUILD_INFO.targetFramework.replace(/^net|\.0$/g, '');
  protected readonly dotnetTitle =
    `Tools like the Regex Tester run the real .NET ${DOTNET_BUILD_INFO.targetFramework} runtime ` +
    'in your browser via WebAssembly, so results match the C# they generate. ' +
    'The runtime is only downloaded when you open one of those tools.';

  constructor() {
    this.keyboardShortcut.set(this.getKeyboardShortcut());
  }

  private getKeyboardShortcut(): string {
    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    return isMac ? '⌘ K' : 'Ctrl + K';
  }
}
