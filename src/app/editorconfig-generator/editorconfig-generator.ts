import { Component, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  EditorconfigGeneratorService,
  EditorConfigSection,
  EditorConfigSettings
} from '../services/editorconfig-generator.service';

interface SettingOption {
  key: keyof EditorConfigSettings;
  label: string;
  description: string;
  type: 'select' | 'checkbox' | 'number' | 'text';
  options?: { value: string | number | boolean; label: string }[];
  default?: string | number | boolean;
  category: 'indentation' | 'line-endings' | 'charset' | 'dotnet' | 'csharp' | 'other';
}

@Component({
  selector: 'app-editorconfig-generator',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-7xl mx-auto p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-1">EditorConfig Generator</h1>
          <p class="text-sm text-gray-600">
            Create and customize .editorconfig files for your .NET projects
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
            <p class="font-medium mb-1">What is EditorConfig?</p>
            <p class="text-blue-700 mb-2">
              EditorConfig helps maintain consistent coding styles across different editors and IDEs. 
              It defines code formatting rules like indentation, line endings, and .NET/C# specific conventions.
            </p>
            <p class="font-medium mb-1">How to use:</p>
            <ol class="list-decimal list-inside space-y-1 text-blue-700">
              <li>Configure global settings that apply to all files</li>
              <li>Add specific sections for different file patterns (e.g., *.cs, tests/**.cs)</li>
              <li>Copy the generated .editorconfig to your project root</li>
            </ol>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Configuration Section -->
        <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div class="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <h2 class="text-sm font-semibold text-gray-700">Configuration</h2>
            <div class="flex gap-2">
              <button
                type="button"
                (click)="loadDefaults()"
                class="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded transition-colors">
                Load Defaults
              </button>
              <button
                type="button"
                (click)="pasteConfig()"
                class="text-xs px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors">
                Paste Config
              </button>
            </div>
          </div>

          <div class="p-4 max-h-[calc(100vh-16rem)] overflow-y-auto">
            <!-- Global Settings -->
            <div class="mb-6">
              <h3 class="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                Global Settings ([*])
              </h3>
              
              @for (category of settingCategories; track category) {
                <div class="mb-4">
                  <h4 class="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">{{ category }}</h4>
                  <div class="space-y-3">
                    @for (setting of getSettingsByCategory(category); track setting.key) {
                      <div class="border border-gray-200 rounded-lg p-3">
                        <div class="flex items-start justify-between mb-2">
                          <label [for]="'global-' + setting.key" class="text-sm font-medium text-gray-900">
                            {{ setting.label }}
                          </label>
                          @if (setting.type === 'checkbox') {
                            <input
                              type="checkbox"
                              [id]="'global-' + setting.key"
                              [checked]="globalSettings()[setting.key] === true"
                              (change)="updateGlobalSetting(setting.key, $any($event.target).checked)"
                              class="w-4 h-4 text-brand-primary bg-gray-100 border-gray-300 rounded focus:ring-brand-primary" />
                          }
                        </div>
                        <p class="text-xs text-gray-600 mb-2">{{ setting.description }}</p>
                        
                        @if (setting.type === 'select') {
                          <select
                            [id]="'global-' + setting.key"
                            [ngModel]="globalSettings()[setting.key]"
                            (ngModelChange)="updateGlobalSetting(setting.key, $event)"
                            class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-brand-primary focus:border-brand-primary">
                            <option [value]="undefined">-- Not set --</option>
                            @for (opt of setting.options; track opt.value) {
                              <option [value]="opt.value">{{ opt.label }}</option>
                            }
                          </select>
                        }
                        
                        @if (setting.type === 'number') {
                          <input
                            type="number"
                            [id]="'global-' + setting.key"
                            [ngModel]="globalSettings()[setting.key]"
                            (ngModelChange)="updateGlobalSetting(setting.key, $event)"
                            class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-brand-primary focus:border-brand-primary" />
                        }
                        
                        @if (setting.type === 'text') {
                          <input
                            type="text"
                            [id]="'global-' + setting.key"
                            [ngModel]="globalSettings()[setting.key]"
                            (ngModelChange)="updateGlobalSetting(setting.key, $event)"
                            class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-brand-primary focus:border-brand-primary" />
                        }
                      </div>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- File-Specific Sections -->
            <div class="mb-6">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  File-Specific Settings
                </h3>
                <button
                  type="button"
                  (click)="addSection()"
                  class="text-xs px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded transition-colors">
                  + Add Section
                </button>
              </div>

              @for (section of sections(); track section.id) {
                <div class="mb-4 border border-gray-300 rounded-lg p-4 bg-gray-50">
                  <div class="flex items-center gap-2 mb-3">
                    <input
                      type="text"
                      [ngModel]="section.pattern"
                      (ngModelChange)="updateSectionPattern(section.id, $event)"
                      placeholder="e.g., *.cs, tests/**.cs, **/*.{cs,vb}"
                      class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-brand-primary focus:border-brand-primary font-mono" />
                    <button
                      type="button"
                      (click)="removeSection(section.id)"
                      class="px-2 py-2 text-red-500 hover:bg-red-50 rounded transition-colors"
                      aria-label="Remove section">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                      </svg>
                    </button>
                  </div>

                  <div class="space-y-2">
                    @for (setting of availableSettings; track setting.key) {
                      @if (section.settings[setting.key] !== undefined) {
                        <div class="flex items-center gap-2 text-xs">
                          <span class="font-mono text-gray-700 min-w-[200px]">{{ setting.key }}</span>
                          <span class="text-gray-400">=</span>
                          <span class="font-mono text-gray-900">{{ section.settings[setting.key] }}</span>
                          <button
                            type="button"
                            (click)="removeSectionSetting(section.id, setting.key)"
                            class="ml-auto text-red-500 hover:text-red-700">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                          </button>
                        </div>
                      }
                    }
                    
                    <button
                      type="button"
                      (click)="showAddSettingModal(section.id)"
                      class="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded transition-colors">
                      + Add Setting
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Output Section -->
        <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div class="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <h2 class="text-sm font-semibold text-gray-700">Generated .editorconfig</h2>
            <div class="flex gap-2">
              <button
                type="button"
                (click)="copyToClipboard()"
                class="text-xs px-2 py-1 bg-brand-primary hover:bg-brand-secondary text-white rounded transition-colors flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
                {{ copyButtonText() }}
              </button>
              <button
                type="button"
                (click)="downloadConfig()"
                class="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-800 text-white rounded transition-colors flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                </svg>
                Download
              </button>
            </div>
          </div>

          <div class="p-4">
            <pre class="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs font-mono max-h-[calc(100vh-16rem)] overflow-y-auto">{{ generatedConfig() }}</pre>
          </div>
        </div>
      </div>

      <!-- Add Setting Modal -->
      @if (addSettingModalVisible()) {
        <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" (click)="hideAddSettingModal()">
          <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" (click)="$event.stopPropagation()">
            <div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 class="text-lg font-semibold text-gray-900">Add Setting</h3>
              <button
                type="button"
                (click)="hideAddSettingModal()"
                class="text-gray-400 hover:text-gray-600">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            
            <div class="p-6 space-y-3">
              @for (setting of availableSettings; track setting.key) {
                <button
                  type="button"
                  (click)="addSettingToSection(setting.key)"
                  class="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-brand-primary hover:bg-blue-50 transition-colors">
                  <div class="font-medium text-sm text-gray-900 mb-1">{{ setting.label }}</div>
                  <div class="text-xs text-gray-600 mb-2">{{ setting.description }}</div>
                  <div class="text-xs font-mono text-gray-500">{{ setting.key }}</div>
                </button>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class EditorconfigGeneratorComponent {
  private readonly service = inject(EditorconfigGeneratorService);

  protected readonly globalSettings = signal<EditorConfigSettings>({});
  protected readonly sections = signal<EditorConfigSection[]>([]);
  protected readonly generatedConfig = signal<string>('');
  protected readonly copyButtonText = signal<string>('Copy');
  protected readonly addSettingModalVisible = signal<boolean>(false);
  protected readonly selectedSectionId = signal<string | null>(null);

  protected readonly settingCategories = ['indentation', 'line-endings', 'charset', 'dotnet', 'csharp', 'other'];

  protected readonly availableSettings: SettingOption[] = [
    // Indentation
    { key: 'indent_style', label: 'Indent Style', description: 'Use spaces or tabs for indentation', type: 'select', options: [{ value: 'space', label: 'Spaces' }, { value: 'tab', label: 'Tabs' }], category: 'indentation' },
    { key: 'indent_size', label: 'Indent Size', description: 'Number of spaces per indentation level', type: 'number', category: 'indentation' },
    { key: 'tab_width', label: 'Tab Width', description: 'Width of a tab character', type: 'number', category: 'indentation' },
    
    // Line endings
    { key: 'end_of_line', label: 'End of Line', description: 'Line ending style', type: 'select', options: [{ value: 'lf', label: 'LF (Unix)' }, { value: 'crlf', label: 'CRLF (Windows)' }, { value: 'cr', label: 'CR (Mac)' }], category: 'line-endings' },
    { key: 'insert_final_newline', label: 'Insert Final Newline', description: 'Insert a newline at the end of the file', type: 'checkbox', category: 'line-endings' },
    { key: 'trim_trailing_whitespace', label: 'Trim Trailing Whitespace', description: 'Remove whitespace at the end of lines', type: 'checkbox', category: 'line-endings' },
    
    // Charset
    { key: 'charset', label: 'Charset', description: 'File character encoding', type: 'select', options: [{ value: 'utf-8', label: 'UTF-8' }, { value: 'utf-8-bom', label: 'UTF-8 with BOM' }, { value: 'utf-16be', label: 'UTF-16 BE' }, { value: 'utf-16le', label: 'UTF-16 LE' }, { value: 'latin1', label: 'Latin-1' }], category: 'charset' },
    
    // .NET
    { key: 'dotnet_sort_system_directives_first', label: 'Sort System Directives First', description: 'Place System.* using directives first', type: 'checkbox', category: 'dotnet' },
    { key: 'dotnet_separate_import_directive_groups', label: 'Separate Import Groups', description: 'Add blank line between import directive groups', type: 'checkbox', category: 'dotnet' },
    
    // C#
    { key: 'csharp_new_line_before_open_brace', label: 'New Line Before Open Brace', description: 'Place opening braces on new line', type: 'text', category: 'csharp' },
    { key: 'csharp_new_line_before_else', label: 'New Line Before Else', description: 'Place else on new line', type: 'checkbox', category: 'csharp' },
    { key: 'csharp_new_line_before_catch', label: 'New Line Before Catch', description: 'Place catch on new line', type: 'checkbox', category: 'csharp' },
    { key: 'csharp_new_line_before_finally', label: 'New Line Before Finally', description: 'Place finally on new line', type: 'checkbox', category: 'csharp' },
    { key: 'csharp_prefer_braces', label: 'Prefer Braces', description: 'Prefer braces even for single-line statements', type: 'text', category: 'csharp' },
    { key: 'csharp_prefer_simple_using_statement', label: 'Prefer Simple Using Statement', description: 'Use simple using statement when possible', type: 'checkbox', category: 'csharp' },
    { key: 'csharp_style_var_for_built_in_types', label: 'Use var for Built-in Types', description: 'Use var for built-in types like int, string', type: 'checkbox', category: 'csharp' },
    { key: 'csharp_style_var_when_type_is_apparent', label: 'Use var When Type is Apparent', description: 'Use var when type is obvious from the right side', type: 'checkbox', category: 'csharp' },
    { key: 'csharp_style_var_elsewhere', label: 'Use var Elsewhere', description: 'Use var in other cases', type: 'checkbox', category: 'csharp' },
    
    // Other
    { key: 'max_line_length', label: 'Max Line Length', description: 'Maximum line length', type: 'number', category: 'other' }
  ];

  constructor() {
    this.loadDefaults();
  }

  protected loadDefaults(): void {
    const defaults = this.service.getDefaultCSharpSettings();
    this.globalSettings.set(defaults);
    this.sections.set([
      {
        id: this.generateId(),
        pattern: '*.cs',
        settings: {
          csharp_prefer_braces: 'true:suggestion'
        }
      }
    ]);
    this.regenerateConfig();
  }

  protected getSettingsByCategory(category: string): SettingOption[] {
    return this.availableSettings.filter(s => s.category === category);
  }

  protected updateGlobalSetting(key: keyof EditorConfigSettings, value: any): void {
    const updated = { ...this.globalSettings() };
    (updated as any)[key] = value;
    this.globalSettings.set(updated);
    this.regenerateConfig();
  }

  protected addSection(): void {
    const newSection: EditorConfigSection = {
      id: this.generateId(),
      pattern: '*.cs',
      settings: {}
    };
    this.sections.set([...this.sections(), newSection]);
    this.regenerateConfig();
  }

  protected removeSection(id: string): void {
    this.sections.set(this.sections().filter(s => s.id !== id));
    this.regenerateConfig();
  }

  protected updateSectionPattern(id: string, pattern: string): void {
    const updated = this.sections().map(s => 
      s.id === id ? { ...s, pattern } : s
    );
    this.sections.set(updated);
    this.regenerateConfig();
  }

  protected removeSectionSetting(sectionId: string, key: keyof EditorConfigSettings): void {
    const updated = this.sections().map(s => {
      if (s.id === sectionId) {
        const newSettings = { ...s.settings };
        delete (newSettings as any)[key];
        return { ...s, settings: newSettings };
      }
      return s;
    });
    this.sections.set(updated);
    this.regenerateConfig();
  }

  protected showAddSettingModal(sectionId: string): void {
    this.selectedSectionId.set(sectionId);
    this.addSettingModalVisible.set(true);
  }

  protected hideAddSettingModal(): void {
    this.addSettingModalVisible.set(false);
    this.selectedSectionId.set(null);
  }

  protected addSettingToSection(key: keyof EditorConfigSettings): void {
    const sectionId = this.selectedSectionId();
    if (!sectionId) return;

    const setting = this.availableSettings.find(s => s.key === key);
    if (!setting) return;

    const updated = this.sections().map(s => {
      if (s.id === sectionId) {
        const newSettings = { ...s.settings };
        (newSettings as any)[key] = setting.default || (setting.type === 'checkbox' ? true : '');
        return { ...s, settings: newSettings };
      }
      return s;
    });
    
    this.sections.set(updated);
    this.regenerateConfig();
    this.hideAddSettingModal();
  }

  protected async pasteConfig(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = this.service.parseEditorConfig(text);
      this.globalSettings.set(parsed.rootSettings);
      this.sections.set(parsed.sections);
      this.regenerateConfig();
    } catch (error) {
      alert('Failed to read from clipboard. Please make sure you have granted clipboard permissions.');
    }
  }

  protected async copyToClipboard(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.generatedConfig());
      this.copyButtonText.set('Copied!');
      setTimeout(() => this.copyButtonText.set('Copy'), 2000);
    } catch (error) {
      alert('Failed to copy to clipboard');
    }
  }

  protected downloadConfig(): void {
    const blob = new Blob([this.generatedConfig()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '.editorconfig';
    a.click();
    URL.revokeObjectURL(url);
  }

  private regenerateConfig(): void {
    const config = this.service.generateEditorConfig(this.globalSettings(), this.sections());
    this.generatedConfig.set(config);
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 11);
  }
}
