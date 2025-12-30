import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 flex items-center justify-center p-6">
      <div class="max-w-[1600px] w-full">
        <!-- Header -->
        <header class="text-center mb-12 animate-fade-in">
          <div class="mb-6 relative inline-block">
            <div class="absolute inset-0 bg-gradient-to-r from-brand-primary to-brand-secondary blur-2xl opacity-20 rounded-full"></div>
              <img src="/assets/logo.webp" alt="Logo" class="w-56 mx-auto relative" width="224" height="auto" />
          </div>
          <h1 class="text-5xl md:text-6xl font-bold bg-gradient-to-r from-brand-primary to-brand-secondary bg-clip-text text-transparent mb-4">
            Developer Toolbox
          </h1>
          <p class="text-xl text-gray-600 font-medium max-w-2xl mx-auto mb-6">
            Your go-to collection of tools for everyday web development
          </p>
          <p class="text-base text-gray-500 max-w-3xl mx-auto leading-relaxed">
            Whether you're converting data formats, debugging tokens, or designing middleware pipelines —
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
              <div class="absolute inset-0 bg-gradient-to-br from-brand-primary/0 via-brand-primary/0 to-brand-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div class="relative">
                <div class="flex items-center gap-3 mb-3">
                  <div class="w-10 h-10 bg-gradient-to-br from-brand-primary to-blue-600 rounded-md flex items-center justify-center text-white shadow-sm group-hover:shadow-md group-hover:shadow-brand-primary/25 transition-all duration-300" aria-hidden="true">
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
              <div class="absolute inset-0 bg-gradient-to-br from-brand-secondary/0 via-brand-secondary/0 to-brand-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div class="relative">
                <div class="flex items-center gap-3 mb-3">
                  <div class="w-10 h-10 bg-gradient-to-br from-brand-secondary to-purple-600 rounded-md flex items-center justify-center text-white shadow-sm group-hover:shadow-md group-hover:shadow-brand-secondary/25 transition-all duration-300" aria-hidden="true">
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
              <div class="absolute inset-0 bg-gradient-to-br from-amber-500/0 via-amber-500/0 to-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div class="relative">
                <div class="flex items-center gap-3 mb-3">
                  <div class="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-md flex items-center justify-center text-white shadow-sm group-hover:shadow-md group-hover:shadow-amber-500/25 transition-all duration-300" aria-hidden="true">
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
              <div class="absolute inset-0 bg-gradient-to-br from-brand-primary/0 via-purple-500/0 to-brand-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div class="relative">
                <div class="flex items-center gap-3 mb-3">
                  <div class="w-10 h-10 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-md flex items-center justify-center text-white shadow-sm group-hover:shadow-md group-hover:shadow-brand-primary/25 transition-all duration-300" aria-hidden="true">
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <circle cx="18" cy="18" r="3"></circle>
                      <circle cx="6" cy="6" r="3"></circle>
                      <path d="M6 9v6"></path>
                      <path d="M9 6h6"></path>
                      <path d="M9 18h6"></path>
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
          </div>
        </main>

        <!-- Footer Info -->
        <footer class="mt-16 text-center text-gray-500 text-sm space-y-2">
          <p class="font-medium">Built with Angular • Privacy-first • <a href="https://github.com/BitSpireGmbH/toolbox">Open source</a></p>
          <p class="text-xs">All processing happens in your browser • No data sent to servers</p>
        </footer>
      </div>
    </div>
  `,
  styles: []
})
export class LandingPageComponent {}
