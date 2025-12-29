import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-vscode-bg flex items-center justify-center p-6">
      <div class="max-w-[1600px] w-full">
        <!-- Header -->
        <header class="text-center mb-12 animate-fade-in">
          <div class="mb-6 relative inline-block">
            <div class="absolute inset-0 bg-gradient-to-r from-brand-primary to-brand-secondary blur-2xl opacity-20 rounded-full"></div>
            <a href="https://bitspire.ch" target="_blank" rel="noopener noreferrer" aria-label="Visit Bitspire website" class="inline-block">
              <img src="assets/bitspire-logo.webp" alt="Bitspire Logo" class="w-56 mx-auto relative" width="224" height="auto" />
            </a>
          </div>
          <h1 class="text-5xl md:text-6xl font-bold bg-gradient-to-r from-brand-primary to-brand-secondary bg-clip-text text-transparent mb-4">
            .NET Developer Toolbox
          </h1>
          <p class="text-xl text-vscode-text font-medium max-w-2xl mx-auto mb-6">
            Your IDE for everyday .NET development tasks
          </p>
          <p class="text-base text-vscode-text-muted max-w-3xl mx-auto leading-relaxed">
            A comprehensive suite of developer tools designed specifically for .NET developers.
            Convert data formats, debug tokens, design middleware pipelines — all in a familiar IDE-like environment.
          </p>
        </header>

        <!-- Tool Cards -->
        <main>
          <h2 class="sr-only">Available Tools</h2>
          <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- JSON -> C# Card -->
            <a routerLink="/csharp-json"
               class="group relative block bg-vscode-sidebar rounded-lg shadow-md hover:shadow-xl transition-all duration-300 p-5 border border-vscode-border hover:border-brand-primary overflow-hidden focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-vscode-bg">
              <div class="absolute inset-0 bg-gradient-to-br from-brand-primary/0 via-brand-primary/0 to-brand-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div class="relative">
                <div class="flex items-center gap-3 mb-3">
                  <div class="w-11 h-11 bg-gradient-to-br from-brand-primary to-blue-600 rounded-lg flex items-center justify-center text-white shadow-md group-hover:shadow-lg group-hover:shadow-brand-primary/30 transition-all duration-300" aria-hidden="true">
                    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                  </div>
                  <div>
                    <h3 class="text-base font-bold text-vscode-text group-hover:text-brand-primary transition-colors duration-300">JSON → C#</h3>
                    <span class="text-xs text-vscode-text-muted font-medium">Code Generator</span>
                  </div>
                </div>
                <p class="text-sm text-vscode-text-muted leading-relaxed mb-3">Convert JSON to C# classes, records, or structs with full serialization support.</p>
                <div class="flex items-center gap-1.5 text-brand-primary font-semibold text-xs">
                  <span>Open Tool</span>
                  <svg class="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </div>
              </div>
            </a>

            <!-- C# <-> TypeScript Card -->
            <a routerLink="/csharp-typescript"
               class="group relative block bg-vscode-sidebar rounded-lg shadow-md hover:shadow-xl transition-all duration-300 p-5 border border-vscode-border hover:border-brand-secondary overflow-hidden focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:ring-offset-2 focus:ring-offset-vscode-bg">
              <div class="absolute inset-0 bg-gradient-to-br from-brand-secondary/0 via-brand-secondary/0 to-brand-secondary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div class="relative">
                <div class="flex items-center gap-3 mb-3">
                  <div class="w-11 h-11 bg-gradient-to-br from-brand-secondary to-purple-600 rounded-lg flex items-center justify-center text-white shadow-md group-hover:shadow-lg group-hover:shadow-brand-secondary/30 transition-all duration-300" aria-hidden="true">
                    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="16 18 22 12 16 6"></polyline>
                      <polyline points="8 6 2 12 8 18"></polyline>
                    </svg>
                  </div>
                  <div>
                    <h3 class="text-base font-bold text-vscode-text group-hover:text-brand-secondary transition-colors duration-300">C# ↔ TypeScript</h3>
                    <span class="text-xs text-vscode-text-muted font-medium">Bidirectional Converter</span>
                  </div>
                </div>
                <p class="text-sm text-vscode-text-muted leading-relaxed mb-3">Convert between C# and TypeScript for seamless full-stack development.</p>
                <div class="flex items-center gap-1.5 text-brand-secondary font-semibold text-xs">
                  <span>Open Tool</span>
                  <svg class="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </div>
              </div>
            </a>

            <!-- JWT Decoder Card -->
            <a routerLink="/jwt-decoder"
               class="group relative block bg-vscode-sidebar rounded-lg shadow-md hover:shadow-xl transition-all duration-300 p-5 border border-vscode-border hover:border-amber-500 overflow-hidden focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-vscode-bg">
              <div class="absolute inset-0 bg-gradient-to-br from-amber-500/0 via-amber-500/0 to-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div class="relative">
                <div class="flex items-center gap-3 mb-3">
                  <div class="w-11 h-11 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center text-white shadow-md group-hover:shadow-lg group-hover:shadow-amber-500/30 transition-all duration-300" aria-hidden="true">
                    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </div>
                  <div>
                    <h3 class="text-base font-bold text-vscode-text group-hover:text-amber-500 transition-colors duration-300">JWT Decoder</h3>
                    <span class="text-xs text-vscode-text-muted font-medium">Token Inspector</span>
                  </div>
                </div>
                <p class="text-sm text-vscode-text-muted leading-relaxed mb-3">Decode and inspect JSON Web Tokens with detailed claim analysis.</p>
                <div class="flex items-center gap-1.5 text-amber-500 font-semibold text-xs">
                  <span>Open Tool</span>
                  <svg class="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </div>
              </div>
            </a>

            <!-- Middleware Designer Card -->
            <a routerLink="/middleware-designer"
               class="group relative block bg-vscode-sidebar rounded-lg shadow-md hover:shadow-xl transition-all duration-300 p-5 border border-vscode-border hover:border-brand-primary overflow-hidden focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-vscode-bg">
              <div class="absolute inset-0 bg-gradient-to-br from-brand-primary/0 via-purple-500/0 to-brand-secondary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div class="relative">
                <div class="flex items-center gap-3 mb-3">
                  <div class="w-11 h-11 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-lg flex items-center justify-center text-white shadow-md group-hover:shadow-lg group-hover:shadow-brand-primary/30 transition-all duration-300" aria-hidden="true">
                    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <circle cx="18" cy="18" r="3"></circle>
                      <circle cx="6" cy="6" r="3"></circle>
                      <path d="M6 9v6"></path>
                      <path d="M9 6h6"></path>
                      <path d="M9 18h6"></path>
                    </svg>
                  </div>
                  <div>
                    <h3 class="text-base font-bold text-vscode-text group-hover:text-brand-primary transition-colors duration-300">Middleware Designer</h3>
                    <span class="text-xs text-vscode-text-muted font-medium">Pipeline Builder</span>
                  </div>
                </div>
                <p class="text-sm text-vscode-text-muted leading-relaxed mb-3">Design ASP.NET Core middleware pipelines visually and generate C# code.</p>
                <div class="flex items-center gap-1.5 text-brand-primary font-semibold text-xs">
                  <span>Open Tool</span>
                  <svg class="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </div>
              </div>
            </a>
          </div>
        </main>

        <!-- Footer Info -->
        <footer class="mt-16 text-center text-vscode-text-muted text-sm space-y-2">
          <p class="font-medium">Built with Angular • Privacy-first • Open source</p>
          <p class="text-xs">All processing happens in your browser • No data sent to servers</p>
        </footer>
      </div>
    </div>
  `,
  styles: []
})
export class LandingPageComponent {}
