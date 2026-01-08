import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
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

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="space-y-4">
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div class="bg-gradient-to-r from-brand-primary to-brand-secondary px-4 py-3">
              <h2 class="text-sm font-semibold text-white">C# Code Input</h2>
            </div>
            <textarea
              [value]="inputCode()"
              (input)="inputCode.set($any($event.target).value)"
              placeholder="Paste your C# class here..."
              class="w-full h-96 p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
              spellcheck="false"
              aria-label="C# code input"></textarea>
          </div>

          @if (analysis() && analysis()!.dependencies.length > 0) {
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h3 class="text-sm font-semibold text-gray-900 mb-3">Dependencies</h3>
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

        <div class="space-y-4">
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div class="bg-gradient-to-r from-brand-secondary to-purple-600 px-4 py-3">
              <h2 class="text-sm font-semibold text-white">Analysis Result</h2>
            </div>
            <div class="p-4">
              @if (analysis() && analysis()!.dependencies.length === 0) {
                <div class="text-center py-12 text-gray-400">
                  <svg class="w-16 h-16 mx-auto mb-4 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"></path>
                  </svg>
                  <p class="text-sm">No dependencies found in the code</p>
                </div>
              } @else if (analysis()) {
                <div 
                  class="font-mono text-sm whitespace-pre-wrap overflow-x-auto bg-gray-50 rounded-lg p-4 border border-gray-200"
                  [innerHTML]="highlightedCode()"></div>
              } @else {
                <div class="text-center py-12 text-gray-400">
                  <svg class="w-16 h-16 mx-auto mb-4 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"></path>
                  </svg>
                  <p class="text-sm">Paste C# code to see the analysis</p>
                </div>
              }
            </div>
          </div>

          @if (analysis() && analysis()!.hasMultipleResponsibilities) {
            <div class="bg-amber-50 rounded-xl shadow-sm border border-amber-200 p-4">
              <div class="flex items-start gap-3">
                <svg class="w-5 h-5 text-amber-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                <div class="flex-1">
                  <h3 class="text-sm font-semibold text-amber-900 mb-1">Potential SRP Violation Detected</h3>
                  <p class="text-sm text-amber-800 leading-relaxed mb-3">
                    This class appears to have multiple responsibilities. Each dependency is used in different methods, 
                    suggesting the class handles multiple concerns. Consider splitting into smaller, focused classes.
                  </p>
                  
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
      </div>

      <div class="mt-6 bg-blue-50 rounded-xl border border-blue-200 p-4">
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-blue-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 16v-4m0-4h.01"></path>
          </svg>
          <div class="flex-1">
            <h3 class="text-sm font-semibold text-blue-900 mb-1">How it works</h3>
            <ul class="text-sm text-blue-800 space-y-1 leading-relaxed">
              <li>• Each dependency is assigned a unique color</li>
              <li>• Dependency types, parameters, and their usage are highlighted in that color</li>
              <li>• Methods using multiple dependencies are marked in yellow (mixed responsibilities)</li>
              <li>• Click on a dependency to focus on its usage throughout the code</li>
              <li>• Framework services (ILogger, IOptions, etc.) can be filtered out</li>
            </ul>
          </div>
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
  `]
})
export class SrpAnalyzerComponent {
  private readonly srpAnalyzer = inject(SrpAnalyzerService);

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

  protected readonly highlightedCode = computed(() => {
    const result = this.analysis();
    const code = this.inputCode();
    if (!result || !code.trim()) {
      return '';
    }
    return this.srpAnalyzer.highlightCode(code, result, this.selectedDependency());
  });

  protected toggleDependencySelection(depType: string): void {
    this.selectedDependency.update(current => current === depType ? null : depType);
  }
}
