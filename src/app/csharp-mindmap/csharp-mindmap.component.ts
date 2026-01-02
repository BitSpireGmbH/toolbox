import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CsharpVersionService } from './services/csharp-version.service';
import { CsharpVersion } from './models/csharp-version.models';

type ViewMode = 'mindmap' | 'list';

@Component({
  selector: 'app-csharp-mindmap',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-7xl mx-auto p-6">
      <!-- Header & Controls -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-1">C# Version History</h1>
          <p class="text-sm text-gray-600">Explore the evolution of C# language features</p>
        </div>
          
          <div class="bg-white p-1 rounded-lg shadow-sm border border-gray-200 inline-flex">
            <button 
              (click)="viewMode.set('mindmap')"
              [class.bg-brand-primary]="viewMode() === 'mindmap'"
              [class.text-white]="viewMode() === 'mindmap'"
              [class.text-gray-600]="viewMode() !== 'mindmap'"
              class="px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
              Timeline
            </button>
            <button 
              (click)="viewMode.set('list')"
              [class.bg-brand-primary]="viewMode() === 'list'"
              [class.text-white]="viewMode() === 'list'"
              [class.text-gray-600]="viewMode() !== 'list'"
              class="px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
              List
            </button>
          </div>
        </div>

      <!-- Content -->
      <div class="bg-white rounded-xl shadow-md border border-gray-200 p-6 min-h-[600px] overflow-x-auto">
          
          <!-- Mindmap / Timeline View -->
          @if (viewMode() === 'mindmap') {
            <div class="mindmap-container min-w-max p-4">
              <div class="relative">
                <!-- Central Line -->
                <div class="absolute left-[39px] top-0 bottom-0 w-1 bg-gradient-to-b from-purple-600 via-blue-500 to-gray-200 rounded-full"></div>

                <div class="flex flex-col gap-12">
                  <!-- Root Node -->
                  <div class="flex items-center gap-8 relative">
                     <div class="w-20 h-20 rounded-full bg-linear-to-br from-purple-600 to-blue-600 text-white flex items-center justify-center text-2xl font-bold shadow-lg z-10 border-4 border-white">
                       C#
                     </div>
                     <div class="text-xl font-bold text-gray-400">Language Evolution</div>
                  </div>

                  <!-- Versions -->
                  @for (v of versions(); track v.version) {
                    <div class="flex items-start relative group">
                      <!-- Node on Line -->
                      <div class="absolute left-[30px] top-6 w-5 h-5 rounded-full bg-white border-4 border-purple-500 z-10 group-hover:scale-125 transition-transform duration-300 shadow-sm"></div>
                      
                      <!-- Connector -->
                      <div class="w-20 h-0.5 bg-gray-200 mt-[33px] ml-[40px] group-hover:bg-purple-300 transition-colors"></div>

                      <div class="ml-4 flex-1 max-w-4xl">
                        <div class="bg-gray-50 rounded-xl p-5 border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all duration-300 relative">
                           <!-- Version Header -->
                           <div class="flex items-center justify-between mb-4 border-b border-gray-200 pb-3">
                              <div class="flex items-center gap-3">
                                <h2 class="text-2xl font-bold text-gray-800">v{{v.version}}</h2>
                                <span class="text-sm font-medium text-purple-600 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-100">{{v.year}}</span>
                              </div>
                           </div>
                           
                           <!-- Features -->
                           <div class="flex flex-wrap gap-2">
                            @for (feature of v.features; track feature.name) {
                              <a [href]="feature.url" 
                                 target="_blank"
                                 class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-white border border-gray-200 text-gray-700 hover:border-brand-primary hover:text-brand-primary hover:bg-brand-primary/5 transition-all duration-200 cursor-pointer shadow-sm"
                                 [title]="feature.name">
                                 {{feature.name}}
                                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3 h-3 flex-shrink-0 opacity-50" aria-hidden="true">
                                   <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                 </svg>
                              </a>
                            }
                            @if (v.features.length === 0) {
                              <span class="text-gray-400 italic text-sm">Minor update / bug fixes</span>
                            }
                           </div>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </div>
            </div>
          }

          <!-- List View -->
          @if (viewMode() === 'list') {
            <div class="max-w-4xl mx-auto space-y-8">
              @for (v of versions(); track v.version) {
                <div class="border-b border-gray-100 last:border-0 pb-8 last:pb-0">
                  <div class="flex items-baseline gap-4 mb-4">
                    <h2 class="text-2xl font-bold text-gray-900">{{v.version}}</h2>
                    <span class="text-sm text-gray-500 font-mono">({{v.year}})</span>
                    <div class="h-px bg-gray-200 flex-grow"></div>
                  </div>
                  <div class="grid md:grid-cols-2 gap-3">
                    @for (feature of v.features; track feature.name) {
                       <a [href]="feature.url" 
                          target="_blank" 
                          class="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-brand-primary/5 hover:text-brand-primary transition-colors group border border-transparent hover:border-brand-primary/20">
                          <span class="font-medium">{{feature.name}}</span>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-gray-400 group-hover:text-brand-primary transition-colors flex-shrink-0" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                          </svg>
                       </a>
                    }
                    @if (v.features.length === 0) {
                      <div class="col-span-full text-center py-4 text-gray-400 italic">
                        No major features listed for this version.
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          }

        </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    .mindmap-container {
      /* Custom scrollbar for the mindmap */
      scrollbar-width: thin;
      scrollbar-color: #cbd5e1 transparent;
    }
  `]
})
export class CsharpMindmapComponent {
  viewMode = signal<ViewMode>('mindmap');
  
  versions = computed(() => this.service.getVersions());

  constructor(private service: CsharpVersionService) {}
}