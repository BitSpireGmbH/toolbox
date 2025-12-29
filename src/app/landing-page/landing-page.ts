import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-gradient-to-br from-ide-bg via-ide-panel to-ide-sidebar flex items-center justify-center p-6">
      <div class="max-w-[1600px] w-full">
        <!-- Header -->
        <header class="text-center mb-12 animate-fade-in">
          <div class="mb-6 relative inline-block">
            <div class="absolute inset-0 bg-gradient-to-r from-ide-accent to-brand-secondary blur-2xl opacity-20 rounded-full"></div>
            <a href="https://bitspire.ch" target="_blank" rel="noopener noreferrer" aria-label="Visit Bitspire website" class="inline-block">
              <img src="assets/bitspire-logo.webp" alt="Bitspire Logo" class="w-56 mx-auto relative" width="224" height="auto" />
            </a>
          </div>
          <h1 class="text-5xl md:text-6xl font-bold bg-gradient-to-r from-ide-accent to-ide-success bg-clip-text text-transparent mb-4">
            .NET Developer Toolbox
          </h1>
          <p class="text-xl text-ide-text font-medium max-w-2xl mx-auto mb-6">
            Your IDE companion for everyday .NET development
          </p>
          <p class="text-base text-ide-text-muted max-w-3xl mx-auto leading-relaxed">
            Professional tools for converting data formats, debugging tokens, and designing middleware pipelines —
            all running locally in your browser with enterprise-grade privacy.
          </p>
        </header>

        <!-- Tool Cards -->
        <main>
          <h2 class="sr-only">Available Tools</h2>
          <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- JSON -> C# Card -->
            <a routerLink="/csharp-json"
               class="group relative block bg-ide-sidebar rounded-lg shadow-sm hover:shadow-xl transition-all duration-300 p-4 border border-ide-border hover:border-ide-accent overflow-hidden focus:outline-none focus:ring-2 focus:ring-ide-accent focus:ring-offset-2 focus:ring-offset-ide-bg">
              <div class="absolute inset-0 bg-gradient-to-br from-ide-accent/0 via-ide-accent/0 to-ide-accent/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div class="relative">
                <div class="flex items-center gap-3 mb-3">
                  <div class="w-10 h-10 bg-gradient-to-br from-ide-accent to-blue-600 rounded-md flex items-center justify-center text-white shadow-sm group-hover:shadow-md group-hover:shadow-ide-accent/25 transition-all duration-300" aria-hidden="true">
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                  </div>
                  <div>
                    <h3 class="text-base font-bold text-ide-text group-hover:text-ide-accent transition-colors duration-300">JSON → C#</h3>
                    <p class="text-xs text-ide-text-muted font-medium mt-0.5">Convert JSON to C# classes in real-time</p>
                  </div>
                </div>

                <div class="flex items-center gap-1.5 text-ide-accent font-semibold text-xs">
                  <span>Open Tool</span>
                  <svg class="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </div>
              </div>
            </a>

            <!-- C# <-> TypeScript Card -->
            <a routerLink="/csharp-typescript"
               class="group relative block bg-ide-sidebar rounded-lg shadow-sm hover:shadow-xl transition-all duration-300 p-4 border border-ide-border hover:border-ide-success overflow-hidden focus:outline-none focus:ring-2 focus:ring-ide-success focus:ring-offset-2 focus:ring-offset-ide-bg">
              <div class="absolute inset-0 bg-gradient-to-br from-ide-success/0 via-ide-success/0 to-ide-success/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div class="relative">
                <div class="flex items-center gap-3 mb-3">
                  <div class="w-10 h-10 bg-gradient-to-br from-ide-success to-green-600 rounded-md flex items-center justify-center text-white shadow-sm group-hover:shadow-md group-hover:shadow-ide-success/25 transition-all duration-300" aria-hidden="true">
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="16 18 22 12 16 6"></polyline>
                      <polyline points="8 6 2 12 8 18"></polyline>
                    </svg>
                  </div>
                  <div>
                    <h3 class="text-base font-bold text-ide-text group-hover:text-ide-success transition-colors duration-300">C# ↔ TypeScript</h3>
                    <p class="text-xs text-ide-text-muted font-medium mt-0.5">Real-time bidirectional conversion</p>
                  </div>
                </div>

                <div class="flex items-center gap-1.5 text-ide-success font-semibold text-xs">
                  <span>Open Tool</span>
                  <svg class="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </div>
              </div>
            </a>

            <!-- JWT Decoder Card -->
            <a routerLink="/jwt-decoder"
               class="group relative block bg-ide-sidebar rounded-lg shadow-sm hover:shadow-xl transition-all duration-300 p-4 border border-ide-border hover:border-ide-warning overflow-hidden focus:outline-none focus:ring-2 focus:ring-ide-warning focus:ring-offset-2 focus:ring-offset-ide-bg">
              <div class="absolute inset-0 bg-gradient-to-br from-ide-warning/0 via-ide-warning/0 to-ide-warning/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div class="relative">
                <div class="flex items-center gap-3 mb-3">
                  <div class="w-10 h-10 bg-gradient-to-br from-ide-warning to-orange-600 rounded-md flex items-center justify-center text-white shadow-sm group-hover:shadow-md group-hover:shadow-ide-warning/25 transition-all duration-300" aria-hidden="true">
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </div>
                  <div>
                    <h3 class="text-base font-bold text-ide-text group-hover:text-ide-warning transition-colors duration-300">JWT Decoder</h3>
                    <p class="text-xs text-ide-text-muted font-medium mt-0.5">Decode and inspect JSON Web Tokens</p>
                  </div>
                </div>

                <div class="flex items-center gap-1.5 text-ide-warning font-semibold text-xs">
                  <span>Open Tool</span>
                  <svg class="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </div>
              </div>
            </a>

            <!-- Middleware Designer Card -->
            <a routerLink="/middleware-designer"
               class="group relative block bg-ide-sidebar rounded-lg shadow-sm hover:shadow-xl transition-all duration-300 p-4 border border-ide-border hover:border-ide-keyword overflow-hidden focus:outline-none focus:ring-2 focus:ring-ide-keyword focus:ring-offset-2 focus:ring-offset-ide-bg">
              <div class="absolute inset-0 bg-gradient-to-br from-ide-keyword/0 via-brand-secondary/0 to-brand-secondary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div class="relative">
                <div class="flex items-center gap-3 mb-3">
                  <div class="w-10 h-10 bg-gradient-to-br from-ide-keyword to-brand-secondary rounded-md flex items-center justify-center text-white shadow-sm group-hover:shadow-md group-hover:shadow-ide-keyword/25 transition-all duration-300" aria-hidden="true">
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <circle cx="18" cy="18" r="3"></circle>
                      <circle cx="6" cy="6" r="3"></circle>
                      <path d="M6 9v6"></path>
                      <path d="M9 6h6"></path>
                      <path d="M9 18h6"></path>
                    </svg>
                  </div>
                  <div>
                    <h3 class="text-base font-bold text-ide-text group-hover:text-ide-keyword transition-colors duration-300">Middleware Designer</h3>
                    <p class="text-xs text-ide-text-muted font-medium mt-0.5">Build ASP.NET Core middleware pipelines</p>
                  </div>
                </div>

                <div class="flex items-center gap-1.5 text-ide-keyword font-semibold text-xs">
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
        <footer class="mt-16 text-center text-ide-text-muted text-sm space-y-2">
          <p class="font-medium">
            <a href="https://github.com/BitSpireGmbH/toolbox" target="_blank" rel="noopener noreferrer" class="hover:text-ide-accent transition-colors">Open source</a> • All processing happens in your browser
          </p>
        </footer>
      </div>
    </div>
  `,
  styles: []
})
export class LandingPageComponent {}
