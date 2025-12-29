import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing-page',
  imports: [RouterLink],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 flex items-center justify-center p-6">
      <div class="max-w-[1600px] w-full">
        <!-- Header -->
        <div class="text-center mb-16 animate-fade-in">
          <div class="mb-6 relative inline-block">
            <div class="absolute inset-0 bg-gradient-to-r from-brand-primary to-brand-secondary blur-2xl opacity-20 rounded-full"></div>
            <a href="https://bitspire.ch" target="_blank" rel="noopener noreferrer" aria-label="Bitspire website" class="inline-block">
              <img src="assets/bitspire-logo.webp" alt="Bitspire Logo" class="w-56 mx-auto relative" />
            </a>
          </div>
          <h1 class="text-6xl font-bold bg-gradient-to-r from-brand-primary to-brand-secondary bg-clip-text text-transparent mb-4">
            .NET Tool Box
          </h1>
          <p class="text-xl text-gray-600 font-medium">Developer Toolkit for Modern .NET</p>
        </div>

        <!-- Tool Cards -->
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <!-- JSON -> C# Card -->
          <a routerLink="/csharp-json"
             class="group relative block bg-white rounded-xl shadow-sm hover:shadow-2xl transition-all duration-300 p-8 border-2 border-gray-200 hover:border-brand-primary overflow-hidden">
            <div class="absolute inset-0 bg-gradient-to-br from-brand-primary/0 via-brand-primary/0 to-brand-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div class="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-brand-primary to-transparent"></div>
              <div class="absolute bottom-0 right-0 w-full h-px bg-gradient-to-r from-transparent via-brand-primary to-transparent"></div>
            </div>
            <div class="relative">
              <div class="flex items-center gap-4 mb-6">
                <div class="w-14 h-14 bg-gradient-to-br from-brand-primary to-blue-600 rounded-lg flex items-center justify-center text-white shadow-md group-hover:shadow-lg group-hover:shadow-brand-primary/25 transition-all duration-300">
                  <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                </div>
                <div>
                  <h2 class="text-2xl font-bold text-gray-900 group-hover:text-brand-primary transition-colors duration-300">JSON → C#</h2>
                  <span class="text-sm text-gray-500 font-medium">One-way Converter</span>
                </div>
              </div>
              <p class="text-gray-600 leading-relaxed mb-6">Convert JSON to C# classes. Supports records, structs, System.Text.Json, Newtonsoft.Json, and source generators.</p>
              <div class="flex items-center gap-2 text-brand-primary font-semibold text-sm">
                <span>Start Converting</span>
                <svg class="w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>
            </div>
          </a>

          <!-- C# <-> TypeScript Card -->
          <a routerLink="/csharp-typescript"
             class="group relative block bg-white rounded-xl shadow-sm hover:shadow-2xl transition-all duration-300 p-8 border-2 border-gray-200 hover:border-brand-secondary overflow-hidden">
            <div class="absolute inset-0 bg-gradient-to-br from-brand-secondary/0 via-brand-secondary/0 to-brand-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div class="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-brand-secondary to-transparent"></div>
              <div class="absolute bottom-0 right-0 w-full h-px bg-gradient-to-r from-transparent via-brand-secondary to-transparent"></div>
            </div>
            <div class="relative">
              <div class="flex items-center gap-4 mb-6">
                <div class="w-14 h-14 bg-gradient-to-br from-brand-secondary to-purple-600 rounded-lg flex items-center justify-center text-white shadow-md group-hover:shadow-lg group-hover:shadow-brand-secondary/25 transition-all duration-300">
                  <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="16 18 22 12 16 6"></polyline>
                    <polyline points="8 6 2 12 8 18"></polyline>
                  </svg>
                </div>
                <div>
                  <h2 class="text-2xl font-bold text-gray-900 group-hover:text-brand-secondary transition-colors duration-300">C# ↔ TypeScript</h2>
                  <span class="text-sm text-gray-500 font-medium">Bidirectional Converter</span>
                </div>
              </div>
              <p class="text-gray-600 leading-relaxed mb-6">Convert between C# classes and TypeScript interfaces/types. Perfect for full-stack development with Angular, React, or Vue.</p>
              <div class="flex items-center gap-2 text-brand-secondary font-semibold text-sm">
                <span>Start Converting</span>
                <svg class="w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>
            </div>
          </a>

          <!-- Middleware Designer Card -->
          <a routerLink="/middleware-designer"
             class="group relative block bg-white rounded-xl shadow-sm hover:shadow-2xl transition-all duration-300 p-8 border-2 border-gray-200 hover:border-brand-primary overflow-hidden">
            <div class="absolute inset-0 bg-gradient-to-br from-brand-primary/0 via-purple-500/0 to-brand-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div class="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-brand-primary to-transparent"></div>
              <div class="absolute bottom-0 right-0 w-full h-px bg-gradient-to-r from-transparent via-brand-secondary to-transparent"></div>
            </div>
            <div class="relative">
              <div class="flex items-center gap-4 mb-6">
                <div class="w-14 h-14 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-lg flex items-center justify-center text-white shadow-md group-hover:shadow-lg group-hover:shadow-brand-primary/25 transition-all duration-300">
                  <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <circle cx="18" cy="18" r="3"></circle>
                    <circle cx="6" cy="6" r="3"></circle>
                    <path d="M6 9v6"></path>
                    <path d="M9 6h6"></path>
                    <path d="M9 18h6"></path>
                  </svg>
                </div>
                <div>
                  <h2 class="text-2xl font-bold text-gray-900 group-hover:text-brand-primary transition-colors duration-300">Middleware</h2>
                  <span class="text-sm text-gray-500 font-medium">Visual Designer</span>
                </div>
              </div>
              <p class="text-gray-600 leading-relaxed mb-6">Build ASP.NET Core middleware pipelines visually. Simulate requests, test flows, and export ready-to-use C# code.</p>
              <div class="flex items-center gap-2 text-brand-primary font-semibold text-sm">
                <span>Start Designing</span>
                <svg class="w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>
            </div>
          </a>
        </div>

        <!-- Footer Info -->
        <div class="mt-16 text-center text-gray-500 text-sm space-y-2">
          <p class="font-medium">Built with Angular • Powered by .NET</p>
          <p class="text-xs">Instant conversions • No data stored • <a href="https://github.com/BitSpireGmbH/toolbox">Open source</a></p>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class LandingPageComponent {}
