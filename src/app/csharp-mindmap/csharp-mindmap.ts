import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CSharpMindmapService } from './csharp-mindmap.service';
import type { CSharpVersion, CSharpFeature } from './csharp-version.model';
import { CSHARP_FOUNDATION } from './csharp-versions.data';

@Component({
  selector: 'app-csharp-mindmap',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-7xl mx-auto p-6">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-1">C# Language Mindmap</h1>
          <p class="text-sm text-gray-600">Interactive exploration of C# language features across versions</p>
        </div>
        <div class="flex items-center gap-2">
          <button
            (click)="toggleAllVersions()"
            class="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2">
            {{ allExpanded() ? 'Collapse All' : 'Expand All' }}
          </button>
        </div>
      </div>

      <!-- Legend -->
      <div class="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h2 class="text-sm font-semibold text-gray-700 mb-3">Feature Categories</h2>
        <div class="flex flex-wrap gap-3" role="list" aria-label="Feature category legend">
          <div class="flex items-center gap-2" role="listitem">
            <span class="w-3 h-3 rounded-full bg-blue-500" aria-hidden="true"></span>
            <span class="text-xs text-gray-600">Syntax</span>
          </div>
          <div class="flex items-center gap-2" role="listitem">
            <span class="w-3 h-3 rounded-full bg-purple-500" aria-hidden="true"></span>
            <span class="text-xs text-gray-600">Types</span>
          </div>
          <div class="flex items-center gap-2" role="listitem">
            <span class="w-3 h-3 rounded-full bg-green-500" aria-hidden="true"></span>
            <span class="text-xs text-gray-600">Patterns</span>
          </div>
          <div class="flex items-center gap-2" role="listitem">
            <span class="w-3 h-3 rounded-full bg-amber-500" aria-hidden="true"></span>
            <span class="text-xs text-gray-600">Async</span>
          </div>
          <div class="flex items-center gap-2" role="listitem">
            <span class="w-3 h-3 rounded-full bg-red-500" aria-hidden="true"></span>
            <span class="text-xs text-gray-600">Performance</span>
          </div>
          <div class="flex items-center gap-2" role="listitem">
            <span class="w-3 h-3 rounded-full bg-gray-500" aria-hidden="true"></span>
            <span class="text-xs text-gray-600">Other</span>
          </div>
        </div>
      </div>

      <!-- Mindmap Container -->
      <div class="relative bg-white rounded-xl shadow-md border border-gray-200 p-6 overflow-x-auto">
        <!-- Central C# Node -->
        <div class="flex flex-col items-center mb-8">
          <a
            href="https://learn.microsoft.com/en-us/dotnet/csharp/"
            target="_blank"
            rel="noopener noreferrer"
            class="group relative flex items-center justify-center w-24 h-24 rounded-full bg-linear-to-br from-brand-primary to-brand-secondary text-white font-bold text-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
            aria-label="C# documentation (opens in new tab)">
            C#
            <span class="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow" aria-hidden="true">
              <svg class="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </span>
          </a>
          <p class="mt-2 text-xs text-gray-500">Click to visit official docs</p>
        </div>

        <!-- Foundation Concepts -->
        <div class="mb-8">
          <h2 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span class="w-4 h-4 rounded bg-gray-700" aria-hidden="true"></span>
            Core Concepts (Since 1.0)
          </h2>
          <div class="flex flex-wrap gap-2">
            @for (concept of foundation.concepts; track concept.name) {
              <a
                [href]="concept.documentationUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                [attr.aria-label]="concept.name + ' documentation (opens in new tab)'">
                <span [class]="getCategoryDotClass(concept.category)" class="w-2 h-2 rounded-full" aria-hidden="true"></span>
                {{ concept.name }}
                <svg class="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            }
          </div>
        </div>

        <!-- Versions Timeline -->
        <div class="space-y-4">
          <h2 class="text-lg font-semibold text-gray-800">Version History</h2>

          @for (version of versions(); track version.version) {
            <div
              class="rounded-xl border-2 overflow-hidden transition-all duration-200"
              [style.border-color]="version.color.border"
              [style.background-color]="isVersionExpanded(version.version) ? version.color.background + '20' : 'transparent'">
              
              <!-- Version Header -->
              <button
                (click)="toggleVersion(version.version)"
                class="w-full flex items-center justify-between p-4 text-left hover:bg-black/5 transition-colors focus:outline-none focus:ring-2 focus:ring-inset"
                [style.--tw-ring-color]="version.color.border"
                [attr.aria-expanded]="isVersionExpanded(version.version)"
                [attr.aria-controls]="'version-' + version.version + '-features'">
                <div class="flex items-center gap-3">
                  <span
                    class="flex items-center justify-center w-12 h-12 rounded-lg font-bold text-lg shadow-sm"
                    [style.background-color]="version.color.background"
                    [style.border-color]="version.color.border"
                    [style.color]="version.color.text"
                    style="border-width: 2px;">
                    {{ version.version }}
                  </span>
                  <div>
                    <span class="font-semibold text-gray-900">C# {{ version.version }}</span>
                    @if (version.releaseYear) {
                      <span class="text-gray-500 text-sm ml-2">({{ version.releaseYear }})</span>
                    }
                    @if (version.dotNetVersion) {
                      <p class="text-xs text-gray-500">{{ version.dotNetVersion }}</p>
                    }
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <span class="text-sm text-gray-500">{{ version.features.length }} features</span>
                  <svg
                    class="w-5 h-5 text-gray-400 transition-transform duration-200"
                    [class.rotate-180]="isVersionExpanded(version.version)"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                    aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              <!-- Version Features -->
              @if (isVersionExpanded(version.version)) {
                <div
                  [id]="'version-' + version.version + '-features'"
                  class="p-4 pt-0 animate-fadeIn">
                  <div class="flex flex-wrap gap-2">
                    @for (feature of version.features; track feature.name) {
                      <a
                        [href]="feature.documentationUrl"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="group inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2"
                        [style.background-color]="version.color.background"
                        [style.border]="'1px solid ' + version.color.border"
                        [style.color]="version.color.text"
                        [style.--tw-ring-color]="version.color.border"
                        [attr.aria-label]="feature.name + ' documentation (opens in new tab)'">
                        <span [class]="getCategoryDotClass(feature.category)" class="w-2 h-2 rounded-full" aria-hidden="true"></span>
                        {{ feature.name }}
                        <svg class="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>

      <!-- Info Panel -->
      <div class="mt-6 bg-linear-to-br from-blue-50 to-purple-50 rounded-xl shadow-md border border-blue-200 p-5">
        <div class="flex items-start gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-blue-600 shrink-0 mt-0.5" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
          <div class="flex-1">
            <h3 class="font-semibold text-sm text-gray-900 mb-2">About this Mindmap</h3>
            <div class="text-xs text-gray-700 space-y-2 leading-relaxed">
              <p>
                This interactive mindmap displays the evolution of C# language features from version 2.0 to the latest preview.
                Click on any feature to visit its official Microsoft documentation.
              </p>
              <p>
                <strong>Tip:</strong> Features are color-coded by category. Use the legend above to understand the categorization.
                The version colors indicate different eras of C# development.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .animate-fadeIn {
      animation: fadeIn 0.2s ease-out;
    }
  `]
})
export class CsharpMindmapComponent {
  private readonly mindmapService = inject(CSharpMindmapService);

  protected readonly foundation = CSHARP_FOUNDATION;
  protected readonly versions = signal<readonly CSharpVersion[]>(this.mindmapService.getAllVersions());
  protected readonly expandedVersions = signal<Set<string>>(new Set());

  protected readonly allExpanded = computed(() => {
    const expanded = this.expandedVersions();
    const allVersions = this.versions();
    return expanded.size === allVersions.length && allVersions.length > 0;
  });

  protected isVersionExpanded(version: string): boolean {
    return this.expandedVersions().has(version);
  }

  protected toggleVersion(version: string): void {
    this.expandedVersions.update(set => {
      const newSet = new Set(set);
      if (newSet.has(version)) {
        newSet.delete(version);
      } else {
        newSet.add(version);
      }
      return newSet;
    });
  }

  protected toggleAllVersions(): void {
    if (this.allExpanded()) {
      this.expandedVersions.set(new Set());
    } else {
      const allVersionIds = this.versions().map(v => v.version);
      this.expandedVersions.set(new Set(allVersionIds));
    }
  }

  protected getCategoryDotClass(category: CSharpFeature['category']): string {
    switch (category) {
      case 'syntax':
        return 'bg-blue-500';
      case 'types':
        return 'bg-purple-500';
      case 'patterns':
        return 'bg-green-500';
      case 'async':
        return 'bg-amber-500';
      case 'performance':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  }
}
