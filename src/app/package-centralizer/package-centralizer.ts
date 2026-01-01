import { Component, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
    PackageCentralizerService,
    CentralizeResult,
    VersionResolutionStrategy,
    ParsedProject
} from '../services/package-centralizer.service';

interface ProjectTab {
    id: number;
    name: string;
    content: string;
}

@Component({
    selector: 'app-package-centralizer',
    imports: [FormsModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div class="max-w-7xl mx-auto p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-1">Package Centralizer</h1>
          <p class="text-sm text-gray-600">
            Convert your .NET projects to use Central Package Management (CPM)
          </p>
        </div>
      </div>

      <!-- Info Banner -->
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div class="flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-blue-600 shrink-0 mt-0.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
          <div class="text-sm text-blue-800">
            <p class="font-medium mb-1">How to use:</p>
            <ol class="list-decimal list-inside space-y-1 text-blue-700">
              <li>Add project tabs and paste your .csproj content into each</li>
              <li>Choose how to handle version conflicts</li>
              <li>Click "Centralize Packages" to generate outputs</li>
            </ol>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Input Section with Tabs -->
        <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <!-- Tab Bar Header -->
          <div class="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
            <h2 class="text-sm font-semibold text-gray-700">Input (.csproj files)</h2>
            <button
              type="button"
              (click)="loadExample()"
              class="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded transition-colors cursor-pointer">
              Load Example
            </button>
          </div>
          <!-- Tab Bar -->
          <div class="bg-gray-100 border-b border-gray-200 flex items-center">
            <div class="flex-1 flex items-center overflow-x-auto">
              @for (tab of projectTabs(); track tab.id) {
                <div
                  class="group flex items-center border-r border-gray-200 shrink-0"
                  [class.bg-white]="activeTabId() === tab.id"
                  [class.bg-gray-100]="activeTabId() !== tab.id">
                  <button
                    type="button"
                    (click)="setActiveTab(tab.id)"
                    class="px-3 py-2 text-sm font-medium transition-colors cursor-pointer"
                    [class.text-gray-900]="activeTabId() === tab.id"
                    [class.text-gray-600]="activeTabId() !== tab.id"
                    [class.hover:text-gray-900]="activeTabId() !== tab.id">
                    @if (editingTabId() === tab.id) {
                      <input
                        type="text"
                        [ngModel]="tab.name"
                        (ngModelChange)="updateTabName(tab.id, $event)"
                        (blur)="stopEditingTab()"
                        (keydown.enter)="stopEditingTab()"
                        (keydown.escape)="stopEditingTab()"
                        class="w-32 px-1 py-0.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-brand-primary focus:border-brand-primary"
                        (click)="$event.stopPropagation()" />
                    } @else {
                      <span (dblclick)="startEditingTab(tab.id); $event.stopPropagation()">{{ tab.name }}</span>
                    }
                  </button>
                  @if (projectTabs().length > 1) {
                    <button
                      type="button"
                      (click)="removeTab(tab.id); $event.stopPropagation()"
                      class="px-1.5 py-2 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                      aria-label="Close tab">
                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18M6 6l12 12"></path>
                      </svg>
                    </button>
                  }
                </div>
              }
              <!-- Add Tab Button -->
              <button
                type="button"
                (click)="addTab()"
                class="px-3 h-full text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer flex items-center"
                aria-label="Add new project">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 5v14M5 12h14"></path>
                </svg>
              </button>
            </div>
          </div>
          <!-- Tab Content -->
          <div class="p-4">
            @for (tab of projectTabs(); track tab.id) {
              @if (activeTabId() === tab.id) {
                <textarea
                  [ngModel]="tab.content"
                  (ngModelChange)="updateTabContent(tab.id, $event)"
                  class="w-full h-80 font-mono text-sm p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  [placeholder]="'<Project Sdk=&quot;Microsoft.NET.Sdk&quot;>\n  <PropertyGroup>\n    <TargetFramework>net8.0</TargetFramework>\n  </PropertyGroup>\n  <ItemGroup>\n    <PackageReference Include=&quot;Newtonsoft.Json&quot; Version=&quot;13.0.1&quot; />\n  </ItemGroup>\n</Project>'">
                </textarea>
              }
            }
          </div>
        </div>

        <!-- Options Section -->
        <div class="space-y-6">
          <!-- Settings Card -->
          <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <div class="bg-gray-50 border-b border-gray-200 px-4 py-3">
              <h2 class="text-sm font-semibold text-gray-700">Options</h2>
            </div>
            <div class="p-4 space-y-4">
              <div>
                <label for="resolution-strategy" class="block text-sm font-medium text-gray-700 mb-1">
                  Version Conflict Resolution
                </label>
                <select
                  id="resolution-strategy"
                  [ngModel]="resolutionStrategy()"
                  (ngModelChange)="resolutionStrategy.set($event)"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary focus:border-transparent">
                  <option value="highest">Highest Version (recommended)</option>
                  <option value="lowest">Lowest Version</option>
                  <option value="first">First Occurrence</option>
                </select>
                <p class="mt-1 text-xs text-gray-500">
                  When the same package has different versions across projects, this determines which version to use.
                </p>
              </div>

              <div class="flex items-center gap-3">
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    [ngModel]="groupByProject()"
                    (ngModelChange)="groupByProject.set($event)"
                    class="sr-only peer" />
                  <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-primary/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-primary"></div>
                </label>
                <div>
                  <span class="text-sm font-medium text-gray-700">Group by Project</span>
                  <p class="text-xs text-gray-500">Create separate ItemGroups with Label for each project. Duplicate packages are assigned to the first project where they occur.</p>
                </div>
              </div>

              <button
                type="button"
                (click)="centralize()"
                [disabled]="!hasContent()"
                class="w-full px-4 py-2.5 rounded-lg bg-brand-primary text-white font-medium text-sm hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer">
                Centralize Packages
              </button>
            </div>
          </div>

          <!-- Conflicts Card -->
          @if (result() && result()!.conflicts.length > 0) {
            <div class="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
              <div class="bg-amber-100 border-b border-amber-200 px-4 py-3 flex items-center gap-2">
                <svg class="w-4 h-4 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <h2 class="text-sm font-semibold text-amber-800">Version Conflicts Resolved</h2>
              </div>
              <div class="p-4 max-h-48 overflow-y-auto">
                <ul class="space-y-2">
                  @for (conflict of result()!.conflicts; track conflict.packageName) {
                    <li class="text-sm">
                      <span class="font-medium text-amber-900">{{ conflict.packageName }}</span>
                      <span class="text-amber-700">
                        → {{ conflict.resolvedVersion }}
                      </span>
                      <div class="text-xs text-amber-600 mt-0.5">
                        @for (v of conflict.versions; track v.projectName) {
                          <span class="inline-block mr-2">{{ v.projectName }}: {{ v.version }}</span>
                        }
                      </div>
                    </li>
                  }
                </ul>
              </div>
            </div>
          }

          <!-- Stats Card -->
          @if (result() && result()!.packageVersions.size > 0) {
            <div class="bg-green-50 border border-green-200 rounded-xl p-4">
              <div class="flex items-center gap-4 text-sm">
                <div class="text-center">
                  <div class="text-2xl font-bold text-green-700">{{ result()!.updatedProjects.length }}</div>
                  <div class="text-xs text-green-600">Projects</div>
                </div>
                <div class="h-8 w-px bg-green-200"></div>
                <div class="text-center">
                  <div class="text-2xl font-bold text-green-700">{{ result()!.packageVersions.size }}</div>
                  <div class="text-xs text-green-600">Packages</div>
                </div>
                <div class="h-8 w-px bg-green-200"></div>
                <div class="text-center">
                  <div class="text-2xl font-bold text-green-700">{{ result()!.conflicts.length }}</div>
                  <div class="text-xs text-green-600">Conflicts</div>
                </div>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Output Section -->
      @if (result() && result()!.directoryPackagesProps) {
        <div class="mt-6 space-y-6">
          <!-- Location Info -->
          <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div class="flex items-start gap-3">
              <svg class="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <div class="text-sm text-emerald-800">
                <p class="font-medium mb-1">Where to place Directory.Packages.props:</p>
                <p class="text-emerald-700">
                  Place the <code class="bg-emerald-100 px-1 rounded">Directory.Packages.props</code> file in the root of your repository, 
                  next to your <code class="bg-emerald-100 px-1 rounded">.sln</code> or <code class="bg-emerald-100 px-1 rounded">.slnx</code> file, 
                  above all your .csproj project folders.
                </p>
              </div>
            </div>
          </div>

          <!-- Tabbed Output Files -->
          <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <!-- Output Tab Bar -->
            <div class="bg-gray-100 border-b border-gray-200 flex items-center">
              <div class="flex-1 flex items-center overflow-x-auto">
                <!-- Directory.Packages.props Tab -->
                <button
                  type="button"
                  (click)="setActiveOutputTab('props')"
                  class="px-3 py-2 text-sm font-medium transition-colors cursor-pointer border-r border-gray-200 shrink-0"
                  [class.bg-white]="activeOutputTab() === 'props'"
                  [class.text-gray-900]="activeOutputTab() === 'props'"
                  [class.bg-gray-100]="activeOutputTab() !== 'props'"
                  [class.text-gray-600]="activeOutputTab() !== 'props'"
                  [class.hover:text-gray-900]="activeOutputTab() !== 'props'">
                  Directory.Packages.props
                </button>
                <!-- Project Tabs -->
                @for (project of result()!.updatedProjects; track project.name) {
                  <button
                    type="button"
                    (click)="setActiveOutputTab(project.name)"
                    class="px-3 py-2 text-sm font-medium transition-colors cursor-pointer border-r border-gray-200 shrink-0"
                    [class.bg-white]="activeOutputTab() === project.name"
                    [class.text-gray-900]="activeOutputTab() === project.name"
                    [class.bg-gray-100]="activeOutputTab() !== project.name"
                    [class.text-gray-600]="activeOutputTab() !== project.name"
                    [class.hover:text-gray-900]="activeOutputTab() !== project.name">
                    {{ project.name }}
                  </button>
                }
              </div>
              <div class="px-2 border-l border-gray-200">
                <button
                  type="button"
                  (click)="copyActiveOutput()"
                  class="text-xs px-3 py-1.5 bg-brand-primary text-white rounded hover:bg-brand-primary/90 transition-colors flex items-center gap-1.5 cursor-pointer">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  Copy
                </button>
              </div>
            </div>
            <!-- Output Content -->
            <div>
              @if (activeOutputTab() === 'props') {
                <pre class="p-4 overflow-x-auto text-sm font-mono bg-gray-900 text-gray-100 max-h-96"><code>{{ result()!.directoryPackagesProps }}</code></pre>
              } @else {
                @for (project of result()!.updatedProjects; track project.name) {
                  @if (activeOutputTab() === project.name) {
                    <pre class="p-4 overflow-x-auto text-sm font-mono bg-gray-900 text-gray-100 max-h-96"><code>{{ project.content }}</code></pre>
                  }
                }
              }
            </div>
          </div>
        </div>
      }

      <!-- Empty State -->
      @if (result() && !result()!.directoryPackagesProps && hasContent()) {
        <div class="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
          <svg class="w-12 h-12 text-gray-400 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
          </svg>
          <h3 class="text-gray-600 font-medium mb-1">No packages found</h3>
          <p class="text-sm text-gray-500">
            Make sure your .csproj files contain PackageReference elements with Version attributes.
          </p>
        </div>
      }
    </div>
  `
})
export class PackageCentralizerComponent {
    private readonly service = inject(PackageCentralizerService);

    private nextTabId = 1;

    protected readonly projectTabs = signal<ProjectTab[]>([
        { id: 0, name: 'Project.csproj', content: '' }
    ]);
    protected readonly activeTabId = signal(0);
    protected readonly editingTabId = signal<number | null>(null);
    protected readonly resolutionStrategy = signal<VersionResolutionStrategy>('highest');
    protected readonly groupByProject = signal(true);
    protected readonly result = signal<CentralizeResult | null>(null);
    protected readonly activeOutputTab = signal<string>('props');

    hasContent(): boolean {
        return this.projectTabs().some(tab => tab.content.trim().length > 0);
    }

    setActiveTab(id: number): void {
        this.activeTabId.set(id);
    }

    setActiveOutputTab(tab: string): void {
        this.activeOutputTab.set(tab);
    }

    copyActiveOutput(): void {
        const result = this.result();
        if (!result) return;

        const activeTab = this.activeOutputTab();
        if (activeTab === 'props') {
            this.copyToClipboard(result.directoryPackagesProps);
        } else {
            const project = result.updatedProjects.find(p => p.name === activeTab);
            if (project) {
                this.copyToClipboard(project.content);
            }
        }
    }

    addTab(): void {
        const newId = this.nextTabId++;
        const tabs = this.projectTabs();
        this.projectTabs.set([
            ...tabs,
            { id: newId, name: `Project${tabs.length + 1}.csproj`, content: '' }
        ]);
        this.activeTabId.set(newId);
    }

    removeTab(id: number): void {
        const tabs = this.projectTabs();
        if (tabs.length <= 1) return;

        const newTabs = tabs.filter(t => t.id !== id);
        this.projectTabs.set(newTabs);

        if (this.activeTabId() === id) {
            this.activeTabId.set(newTabs[0].id);
        }
    }

    startEditingTab(id: number): void {
        this.editingTabId.set(id);
    }

    stopEditingTab(): void {
        this.editingTabId.set(null);
    }

    updateTabName(id: number, name: string): void {
        const tabs = this.projectTabs();
        this.projectTabs.set(
            tabs.map(t => t.id === id ? { ...t, name: name || 'Project.csproj' } : t)
        );
    }

    updateTabContent(id: number, content: string): void {
        const tabs = this.projectTabs();
        this.projectTabs.set(
            tabs.map(t => t.id === id ? { ...t, content } : t)
        );
    }

    centralize(): void {
        const tabs = this.projectTabs().filter(t => t.content.trim());
        if (tabs.length === 0) return;

        // Convert tabs to the format expected by the service
        const projects: ParsedProject[] = tabs.map(tab => ({
            name: tab.name,
            content: tab.content,
            packages: this.service.parsePackageReferences(tab.content)
        }));

        // Filter out projects with no packages
        const projectsWithPackages = projects.filter(p => p.packages.length > 0);

        if (projectsWithPackages.length === 0) {
            this.result.set({
                directoryPackagesProps: '',
                updatedProjects: [],
                packageVersions: new Map(),
                conflicts: []
            });
            return;
        }

        const { packageVersions, conflicts } = this.service.resolveVersionConflicts(
            projectsWithPackages,
            this.resolutionStrategy()
        );

        const globalPackages = this.service.identifyGlobalPackages(projectsWithPackages);

        const updatedProjects = projectsWithPackages.map(project => ({
            ...project,
            content: this.service.updateCsprojContent(project.content, globalPackages)
        }));

        const directoryPackagesProps = this.service.generateDirectoryPackagesProps(
            packageVersions,
            projectsWithPackages,
            this.groupByProject()
        );

        this.result.set({
            directoryPackagesProps,
            updatedProjects,
            packageVersions,
            conflicts
        });

        // Reset output tab to props
        this.activeOutputTab.set('props');
    }

    loadExample(): void {
        this.projectTabs.set([
            {
                id: 0,
                name: 'WebApi.csproj',
                content: `<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.OpenApi" Version="8.0.0" />
    <PackageReference Include="Swashbuckle.AspNetCore" Version="6.5.0" />
    <PackageReference Include="Serilog.AspNetCore" Version="8.0.0" />
    <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
  </ItemGroup>
</Project>`
            },
            {
                id: 1,
                name: 'Core.csproj',
                content: `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="FluentValidation" Version="11.8.0" />
    <PackageReference Include="MediatR" Version="12.2.0" />
    <PackageReference Include="Newtonsoft.Json" Version="13.0.1" />
  </ItemGroup>
</Project>`
            },
            {
                id: 2,
                name: 'Infrastructure.csproj',
                content: `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.EntityFrameworkCore" Version="8.0.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="8.0.0" />
    <PackageReference Include="Serilog" Version="3.1.1" />
    <PackageReference Include="Newtonsoft.Json" Version="12.0.3" />
  </ItemGroup>
</Project>`
            }
        ]);
        this.nextTabId = 3;
        this.activeTabId.set(0);
        this.result.set(null);
    }

    async copyToClipboard(text: string): Promise<void> {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
    }
}
