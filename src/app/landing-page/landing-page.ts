import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing-page',
  imports: [RouterLink],
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
          <p class="text-xl text-gray-600 font-medium max-w-2xl mx-auto mb-6">
            Your go-to collection of tools for everyday web development
          </p>
          <p class="text-base text-gray-500 max-w-3xl mx-auto leading-relaxed">
            Whether you're converting data formats, debugging tokens, or designing middleware pipelines -
            we've got you covered. All tools run entirely in your browser with no data stored on servers.
          </p>
        </header>

        <!-- Tool Cards -->
        <main>
          <h2 class="sr-only">Available Tools</h2>
          <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- JSON -> C# Card -->
            <a routerLink="/csharp-json"
               class="group relative block bg-white rounded-lg shadow-sm hover:shadow-xl transition-all duration-300 p-4 border border-gray-200 hover:border-brand-primary overflow-hidden focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2">
              <div class="absolute inset-0 bg-linear-to-br from-brand-primary/0 via-brand-primary/0 to-brand-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div class="relative">
                <div class="flex items-center gap-3 mb-3">
                  <div class="w-10 h-10 bg-linear-to-br from-brand-primary to-blue-600 rounded-md flex items-center justify-center text-white shadow-sm group-hover:shadow-md group-hover:shadow-brand-primary/25 transition-all duration-300" aria-hidden="true">
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                  </div>
                  <div>
                    <h3 class="text-base font-bold text-gray-900 group-hover:text-brand-primary transition-colors duration-300">JSON → C#</h3>
                    <span class="text-xs text-gray-500 font-medium">One-way Converter</span>
                  </div>
                </div>
                <p class="text-sm text-gray-600 leading-relaxed mb-3">Convert JSON to C# classes with support for records, structs, and various serializers.</p>
                <div class="flex items-center gap-1.5 text-brand-primary font-semibold text-xs">
                  <span>Start Converting</span>
                  <svg class="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </div>
              </div>
            </a>

            <!-- C# <-> TypeScript Card -->
            <a routerLink="/csharp-typescript"
               class="group relative block bg-white rounded-lg shadow-sm hover:shadow-xl transition-all duration-300 p-4 border border-gray-200 hover:border-brand-secondary overflow-hidden focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:ring-offset-2">
              <div class="absolute inset-0 bg-linear-to-br from-brand-secondary/0 via-brand-secondary/0 to-brand-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div class="relative">
                <div class="flex items-center gap-3 mb-3">
                  <div class="w-10 h-10 bg-linear-to-br from-brand-secondary to-purple-600 rounded-md flex items-center justify-center text-white shadow-sm group-hover:shadow-md group-hover:shadow-brand-secondary/25 transition-all duration-300" aria-hidden="true">
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="16 18 22 12 16 6"></polyline>
                      <polyline points="8 6 2 12 8 18"></polyline>
                    </svg>
                  </div>
                  <div>
                    <h3 class="text-base font-bold text-gray-900 group-hover:text-brand-secondary transition-colors duration-300">C# ↔ TypeScript</h3>
                    <span class="text-xs text-gray-500 font-medium">Bidirectional Converter</span>
                  </div>
                </div>
                <p class="text-sm text-gray-600 leading-relaxed mb-3">Convert between C# classes and TypeScript interfaces for full-stack development.</p>
                <div class="flex items-center gap-1.5 text-brand-secondary font-semibold text-xs">
                  <span>Start Converting</span>
                  <svg class="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </div>
              </div>
            </a>

            <!-- JWT Decoder Card -->
            <a routerLink="/jwt-decoder"
               class="group relative block bg-white rounded-lg shadow-sm hover:shadow-xl transition-all duration-300 p-4 border border-gray-200 hover:border-amber-500 overflow-hidden focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2">
              <div class="absolute inset-0 bg-linear-to-br from-amber-500/0 via-amber-500/0 to-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div class="relative">
                <div class="flex items-center gap-3 mb-3">
                  <div class="w-10 h-10 bg-linear-to-br from-amber-500 to-orange-600 rounded-md flex items-center justify-center text-white shadow-sm group-hover:shadow-md group-hover:shadow-amber-500/25 transition-all duration-300" aria-hidden="true">
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </div>
                  <div>
                    <h3 class="text-base font-bold text-gray-900 group-hover:text-amber-600 transition-colors duration-300">JWT Decoder</h3>
                    <span class="text-xs text-gray-500 font-medium">Token Inspector</span>
                  </div>
                </div>
                <p class="text-sm text-gray-600 leading-relaxed mb-3">Decode and inspect JSON Web Tokens with claim explanations and validity checks.</p>
                <div class="flex items-center gap-1.5 text-amber-600 font-semibold text-xs">
                  <span>Start Decoding</span>
                  <svg class="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </div>
              </div>
            </a>

            <!-- Middleware Designer Card -->
            <a routerLink="/middleware-designer"
               class="group relative block bg-white rounded-lg shadow-sm hover:shadow-xl transition-all duration-300 p-4 border border-gray-200 hover:border-brand-primary overflow-hidden focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2">
              <div class="absolute inset-0 bg-linear-to-br from-brand-primary/0 via-purple-500/0 to-brand-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div class="relative">
                <div class="flex items-center gap-3 mb-3">
                  <div class="w-10 h-10 bg-linear-to-br from-brand-primary to-brand-secondary rounded-md flex items-center justify-center text-white shadow-sm group-hover:shadow-md group-hover:shadow-brand-primary/25 transition-all duration-300" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 6.878V6a2.25 2.25 0 0 1 2.25-2.25h7.5A2.25 2.25 0 0 1 18 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 0 0 4.5 9v.878m13.5-3A2.25 2.25 0 0 1 19.5 9v.878m0 0a2.246 2.246 0 0 0-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0 1 21 12v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6c0-.98.626-1.813 1.5-2.122" />
                    </svg>
                  </div>
                  <div>
                    <h3 class="text-base font-bold text-gray-900 group-hover:text-brand-primary transition-colors duration-300">Middleware Designer</h3>
                    <span class="text-xs text-gray-500 font-medium">Visual Pipeline Builder</span>
                  </div>
                </div>
                <p class="text-sm text-gray-600 leading-relaxed mb-3">Build ASP.NET Core middleware pipelines visually and export ready-to-use C# code.</p>
                <div class="flex items-center gap-1.5 text-brand-primary font-semibold text-xs">
                  <span>Start Designing</span>
                  <svg class="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </div>
              </div>
            </a>

            <!-- Package Centralizer Card -->
            <a routerLink="/package-centralizer"
               class="group relative block bg-white rounded-lg shadow-sm hover:shadow-xl transition-all duration-300 p-4 border border-gray-200 hover:border-emerald-500 overflow-hidden focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2">
              <div class="absolute inset-0 bg-linear-to-br from-emerald-500/0 via-emerald-500/0 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div class="relative">
                <div class="flex items-center gap-3 mb-3">
                  <div class="w-10 h-10 bg-linear-to-br from-emerald-500 to-teal-600 rounded-md flex items-center justify-center text-white shadow-sm group-hover:shadow-md group-hover:shadow-emerald-500/25 transition-all duration-300" aria-hidden="true">
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                      <line x1="12" y1="22.08" x2="12" y2="12"></line>
                    </svg>
                  </div>
                  <div>
                    <h3 class="text-base font-bold text-gray-900 group-hover:text-emerald-600 transition-colors duration-300">Package Centralizer</h3>
                    <span class="text-xs text-gray-500 font-medium">NuGet CPM Tool</span>
                  </div>
                </div>
                <p class="text-sm text-gray-600 leading-relaxed mb-3">Convert .NET projects to Central Package Management with Directory.Packages.props.</p>
                <div class="flex items-center gap-1.5 text-emerald-600 font-semibold text-xs">
                  <span>Start Centralizing</span>
                  <svg class="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </div>
              </div>
            </a>

            <!-- C# Mindmap Card -->
            <a routerLink="/csharp-mindmap"
               class="group relative block bg-white rounded-lg shadow-sm hover:shadow-xl transition-all duration-300 p-4 border border-gray-200 hover:border-purple-500 overflow-hidden focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2">
              <div class="absolute inset-0 bg-linear-to-br from-purple-500/0 via-purple-500/0 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div class="relative">
                <div class="flex items-center gap-3 mb-3">
                  <div class="w-10 h-10 bg-linear-to-br from-purple-500 to-indigo-600 rounded-md flex items-center justify-center text-white shadow-sm group-hover:shadow-md group-hover:shadow-purple-500/25 transition-all duration-300" aria-hidden="true">
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="1.5" y="1.5" width="21" height="21" rx="5" stroke="currentColor" stroke-width="1.5"></rect>
                      <text x="50%" y="50%" fill="currentColor" font-family="Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial" font-size="9" font-weight="700" text-anchor="middle" dominant-baseline="central">C#</text>
                    </svg>
                  </div>
                  <div>
                    <h3 class="text-base font-bold text-gray-900 group-hover:text-purple-600 transition-colors duration-300">C# Mindmap</h3>
                    <span class="text-xs text-gray-500 font-medium">Interactive History</span>
                  </div>
                </div>
                <p class="text-sm text-gray-600 leading-relaxed mb-3">Explore the evolution of C# language features with an interactive mind map.</p>
                <div class="flex items-center gap-1.5 text-purple-600 font-semibold text-xs">
                  <span>Start Exploring</span>
                  <svg class="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </div>
              </div>
            </a>

            <!-- List Visualizer Card -->
            <a routerLink="/list-visualizer"
               class="group relative block bg-white rounded-lg shadow-sm hover:shadow-xl transition-all duration-300 p-4 border border-gray-200 hover:border-sky-500 overflow-hidden focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2">
              <div class="absolute inset-0 bg-linear-to-br from-sky-500/0 via-sky-500/0 to-sky-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div class="relative">
                <div class="flex items-center gap-3 mb-3">
                  <div class="w-10 h-10 bg-linear-to-br from-sky-500 to-cyan-600 rounded-md flex items-center justify-center text-white shadow-sm group-hover:shadow-md group-hover:shadow-sky-500/25 transition-all duration-300" aria-hidden="true">
                    <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
                    </svg>
                  </div>
                  <div>
                    <h3 class="text-base font-bold text-gray-900 group-hover:text-sky-500 transition-colors duration-300">List&lt;T&gt; Visualizer</h3>
                    <span class="text-xs text-gray-500 font-medium">Memory & Resizing</span>
                  </div>
                </div>
                <p class="text-sm text-gray-600 leading-relaxed mb-3">Visualize memory addresses and dynamic resizing behavior of C#'s List&lt;T&gt;.</p>
                <div class="flex items-center gap-1.5 text-sky-500 font-semibold text-xs">
                  <span>Open Visualizer</span>
                  <svg class="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </div>
              </div>
            </a>

            <!-- SRP Analyzer Card -->
            <a routerLink="/srp-analyzer"
               class="group relative block bg-white rounded-lg shadow-sm hover:shadow-xl transition-all duration-300 p-4 border border-gray-200 hover:border-rose-500 overflow-hidden focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2">
              <div class="absolute inset-0 bg-linear-to-br from-rose-500/0 via-rose-500/0 to-rose-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div class="relative">
                <div class="flex items-center gap-3 mb-3">
                  <div class="w-10 h-10 bg-linear-to-br from-rose-500 to-pink-600 rounded-md flex items-center justify-center text-white shadow-sm group-hover:shadow-md group-hover:shadow-rose-500/25 transition-all duration-300" aria-hidden="true">
                    <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 16a9.065 9.065 0 0 1-6.23-.693L5 15.3m14.8 0a9.016 9.016 0 0 1-4.424 4.424m-5.952-12.214a2.25 2.25 0 0 0-.659-1.591L5 7.5m14.8 7.8a9.016 9.016 0 0 0 4.424-4.424m-19.8 0a9.083 9.083 0 0 0 1.424.124m3.1 9.75H12m4.875 0a9 9 0 1 1-9.75 0" />
                    </svg>
                  </div>
                  <div>
                    <h3 class="text-base font-bold text-gray-900 group-hover:text-rose-600 transition-colors duration-300">SRP Analyzer</h3>
                    <span class="text-xs text-gray-500 font-medium">Code Quality Tool</span>
                  </div>
                </div>
                <p class="text-sm text-gray-600 leading-relaxed mb-3">Analyze C# classes for Single Responsibility Principle violations with color-coded dependencies.</p>
                <div class="flex items-center gap-1.5 text-rose-600 font-semibold text-xs">
                  <span>Start Analyzing</span>
                  <svg class="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </div>
              </div>
            </a>
          </div>
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
          <a href="https://bitspire.ch" class="mt-4 inline-flex items-center justify-center gap-2">
            <span class="text-xs">Brought to you by:</span>
            <img src="assets/bitspire-logo.webp" alt="BitSpire Logo" class="w-24" height="auto" />
          </a>
        </footer>
      </div>
    </div>
  `,
  styles: []
})
export class LandingPageComponent { }
