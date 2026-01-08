import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { SrpAnalyzerService, AnalysisResult } from '../services/srp-analyzer.service';

@Component({
  selector: 'app-srp-analyzer',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-7xl mx-auto p-6">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-1">SRP Analyzer</h1>
          <p class="text-sm text-gray-600">Analyze C# classes for Single Responsibility Principle violations</p>
        </div>
        
        <label class="flex items-center gap-2 cursor-pointer px-4 py-2 bg-white rounded-lg border border-gray-300 hover:bg-gray-50 transition-all shadow-sm">
          <input 
            type="checkbox"
            [checked]="filterFrameworkServices()"
            (change)="filterFrameworkServices.set($any($event.target).checked)"
            class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-2 focus:ring-brand-primary">
          <span class="text-sm font-medium text-gray-700">Hide framework services</span>
        </label>
      </div>

      <!-- Information Box -->
      <div class="bg-blue-50 border-l-4 border-blue-500 rounded-lg mb-6 shadow-sm overflow-hidden">
        <button 
          (click)="isInfoExpanded.set(!isInfoExpanded())"
          [attr.aria-expanded]="isInfoExpanded()"
          class="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-100 transition-colors">
          <div class="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-blue-600 shrink-0" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
            <h3 class="font-semibold text-blue-900">How it works</h3>
          </div>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke-width="2" 
            stroke="currentColor" 
            class="w-5 h-5 text-blue-600 transition-transform duration-200"
            [class.rotate-180]="isInfoExpanded()"
            aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
        
        @if (isInfoExpanded()) {
          <div class="px-4 pb-4 pt-2">
            <ul class="text-sm text-blue-800 space-y-1 leading-relaxed">
              <li>• Each dependency is assigned a unique color</li>
              <li>• Dependency types, parameters, and their usage are highlighted in that color</li>
              <li>• Methods using multiple dependencies are marked in yellow (mixed responsibilities)</li>
              <li>• Click on a dependency to focus on its usage throughout the code</li>
              <li>• Framework services (ILogger, IOptions, etc.) can be filtered out</li>
            </ul>
          </div>
        }
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <!-- Code Editor with Overlay (Left - 2/3 width) -->
        <div class="lg:col-span-2 space-y-6">
          <div class="group relative bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
            <div class="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                <h3 class="font-semibold text-sm text-gray-700">C# Code Editor</h3>
              </div>
              <span class="text-xs text-gray-500">{{ inputCode().length }} chars</span>
            </div>
            <div class="relative h-[600px]">
              <!-- Highlighted code background -->
              @if (analysis() && analysis()!.dependencies.length > 0) {
                <div 
                  class="absolute inset-0 p-4 font-mono text-sm whitespace-pre-wrap overflow-auto pointer-events-none"
                  [innerHTML]="highlightedCode()"></div>
              }
              <!-- Editable textarea overlay -->
              <textarea
                [value]="inputCode()"
                (input)="inputCode.set($any($event.target).value)"
                (scroll)="onTextareaScroll($event)"
                #textarea
                placeholder="Paste your C# class here..."
                [class]="analysis() && analysis()!.dependencies.length > 0 ? 'text-transparent caret-black' : 'text-gray-900'"
                class="absolute inset-0 w-full h-full p-4 font-mono text-sm focus:outline-none resize-none bg-transparent"
                spellcheck="false"
                aria-label="C# code input"></textarea>
            </div>
          </div>

          <!-- Warnings -->
          @if (analysis() && analysis()!.hasMultipleResponsibilities) {
            <div class="bg-amber-50 rounded-xl shadow-sm border border-amber-200 p-4">
              <div class="flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 text-amber-600 shrink-0 mt-0.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>

                <div class="flex-1">
                  <h3 class="text-sm font-semibold text-amber-900 mb-1">Potential SRP Violation Detected</h3>
                  <p class="text-sm text-amber-800 leading-relaxed mb-3">
                    This class appears to have multiple responsibilities. Each dependency is used in different methods, 
                    suggesting the class handles multiple concerns. Consider splitting into smaller, focused classes.
                  </p>
                  
                  @if (analysis()!.responsibilityGroups.length > 0) {
                    <div class="bg-white/50 rounded-lg p-3 border border-amber-300 mb-3">
                      <p class="text-xs font-semibold text-amber-900 mb-2">Responsibility Breakdown:</p>
                      <div class="space-y-3">
                        @for (group of analysis()!.responsibilityGroups; track group.dependency) {
                          <div>
                            <div class="text-xs font-medium text-amber-900 mb-1">Uses {{ group.dependency }}:</div>
                            <ul class="space-y-1 ml-2">
                              @for (method of group.methods; track method) {
                                <li class="text-xs text-amber-800 font-mono flex items-center gap-2">
                                  <span class="w-1 h-1 rounded-full bg-amber-500"></span>
                                  {{ method }}
                                </li>
                              }
                            </ul>
                          </div>
                        }
                      </div>
                    </div>
                  }

                  @if (analysis()!.mixedResponsibilityMethods.length > 0) {
                    <div class="bg-white/50 rounded-lg p-3 border border-amber-300">
                      <p class="text-xs font-semibold text-amber-900 mb-2">Methods mixing responsibilities:</p>
                      <ul class="space-y-1">
                        @for (method of analysis()!.mixedResponsibilityMethods; track method) {
                          <li class="text-xs text-amber-800 font-mono">• {{ method }}</li>
                        }
                      </ul>
                    </div>
                  }
                </div>
              </div>
            </div>
          }

          @if (analysis() && !analysis()!.hasMultipleResponsibilities && analysis()!.dependencies.length > 0) {
            <div class="bg-green-50 rounded-xl shadow-sm border border-green-200 p-4">
              <div class="flex items-start gap-3">
                <svg class="w-5 h-5 text-green-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <div class="flex-1">
                  <h3 class="text-sm font-semibold text-green-900 mb-1">Single Responsibility Maintained</h3>
                  <p class="text-sm text-green-800 leading-relaxed">
                    Dependencies are used together across methods, suggesting the class has a cohesive, single responsibility.
                  </p>
                </div>
              </div>
            </div>
          }
        </div>

        <!-- Dependencies Panel (Right - 1/3 width) -->
        <div class="space-y-6">
          @if (analysis() && analysis()!.dependencies.length > 0) {
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sticky top-6">
              <div class="flex items-center gap-2 mb-3">
                <div class="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                <h3 class="text-sm font-semibold text-gray-900">Dependencies</h3>
              </div>
              <div class="space-y-2">
                @for (dep of analysis()!.dependencies; track dep.type) {
                  <button
                    (click)="toggleDependencySelection(dep.type)"
                    [class]="selectedDependency() === dep.type ? 'ring-2 ring-offset-2' : ''"
                    [style.--dep-color]="dep.color"
                    [style.ring-color]="dep.color"
                    class="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-all text-left group"
                    aria-label="Select dependency to highlight">
                    <div 
                      class="w-4 h-4 rounded shrink-0"
                      [style.background-color]="dep.color"></div>
                    <div class="flex-1 min-w-0">
                      <div class="font-mono text-sm font-semibold text-gray-900 truncate">{{ dep.type }}</div>
                      <div class="text-xs text-gray-500">
                        @if (dep.parameterName && dep.fieldName) {
                          Parameter: {{ dep.parameterName }} → Field: {{ dep.fieldName }}
                        } @else if (dep.parameterName) {
                          Parameter: {{ dep.parameterName }}
                        } @else if (dep.fieldName) {
                          Field: {{ dep.fieldName }}
                        }
                      </div>
                    </div>
                    <div class="text-xs text-gray-400 shrink-0">
                      Click to focus
                    </div>
                  </button>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host ::ng-deep .srp-highlight {
      padding: 0 2px;
      border-radius: 2px;
      transition: all 0.2s;
    }
    
    :host ::ng-deep .srp-mixed {
      padding: 0 2px;
      border-radius: 2px;
      cursor: help;
    }
    
    :host ::ng-deep .srp-method {
      display: inline-block;
      width: 100%;
    }
  `]
})
export class SrpAnalyzerComponent {
  private readonly srpAnalyzer = inject(SrpAnalyzerService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly isInfoExpanded = signal(false);
  protected readonly inputCode = signal(`public class Processor
{
    private readonly IOrderService _orderService;
    private readonly IEmailService _emailService;

    public Processor(IOrderService orderService, IEmailService emailService)
    {
        _orderService = orderService;
        _emailService = emailService;
    }

    public void ProcessOrder(Order order)
    {
        _orderService.Process(order);
    }

    public void SendConfirmationEmail(Order order)
    {
        _emailService.SendEmail(order.CustomerEmail, "Your order has been processed.");
    }
}`);

  protected readonly filterFrameworkServices = signal(true);
  protected readonly selectedDependency = signal<string | null>(null);

  protected readonly analysis = computed<AnalysisResult | null>(() => {
    const code = this.inputCode();
    if (!code.trim()) {
      return null;
    }
    return this.srpAnalyzer.analyzeCode(code, this.filterFrameworkServices());
  });

  protected readonly highlightedCode = computed<SafeHtml>(() => {
    const result = this.analysis();
    const code = this.inputCode();
    if (!result || !code.trim()) {
      return '';
    }
    const html = this.srpAnalyzer.highlightCode(code, result, this.selectedDependency());
    return this.sanitizer.bypassSecurityTrustHtml(html);
  });

  protected toggleDependencySelection(depType: string): void {
    this.selectedDependency.update(current => current === depType ? null : depType);
  }

  protected onTextareaScroll(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    const highlightedDiv = textarea.previousElementSibling as HTMLElement;
    if (highlightedDiv) {
      highlightedDiv.scrollTop = textarea.scrollTop;
      highlightedDiv.scrollLeft = textarea.scrollLeft;
    }
  }
}