import { Component, ChangeDetectionStrategy, input, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SyntaxHighlighterService } from '../services/syntax-highlighter.service';

@Component({
  selector: 'app-code-viewer',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="group relative bg-vscode-bg rounded-xl shadow-md border border-vscode-border overflow-hidden hover:shadow-lg transition-shadow">
      <div class="panel-header px-4 py-2.5 border-b border-vscode-border flex justify-between items-center">
        <div class="flex items-center gap-2">
          <span 
            class="status-dot"
            [class.active]="code()"
            [class.inactive]="!code()">
          </span>
          <h3 class="font-semibold text-sm text-vscode-text">{{ title() }}</h3>
        </div>
        <div class="flex items-center gap-2">
          @if (charCount() > 0) {
            <span class="text-xs text-vscode-text-muted">{{ charCount() }} chars</span>
          }
          @if (copyable() && code()) {
            <button
              (click)="copyToClipboard()"
              class="px-3 py-1 rounded-md text-xs font-semibold transition-all text-vscode-success hover:bg-vscode-success/10"
              aria-label="Copy code to clipboard">
              <span class="flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                {{ copySuccess() ? 'Copied!' : 'Copy' }}
              </span>
            </button>
          }
        </div>
      </div>

      <div 
        class="code-panel overflow-auto"
        [style.height]="height() + 'px'">
        @if (code()) {
          @if (showLineNumbers()) {
            <pre class="code-editor p-4 m-0 code-with-lines"><code [innerHTML]="highlightedCodeWithLines()"></code></pre>
          } @else {
            <pre class="code-editor p-4 m-0"><code [innerHTML]="highlightedCode()"></code></pre>
          }
        } @else {
          <div class="flex items-center justify-center h-full text-vscode-text-muted text-sm">
            {{ placeholder() }}
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .line-number {
      display: inline-block;
      width: 3rem;
      text-align: right;
      padding-right: 1rem;
      color: var(--color-vscode-text-muted, #858585);
      user-select: none;
      border-right: 1px solid #3e3e42;
      margin-right: 1rem;
    }
    
    .code-line {
      display: block;
      line-height: 1.6;
    }
    
    .code-panel {
      background: #1e1e1e;
    }
  `]
})
export class CodeViewerComponent {
  private readonly highlighter = inject(SyntaxHighlighterService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly code = input<string>('');
  readonly language = input<'csharp' | 'typescript' | 'json'>('csharp');
  readonly title = input<string>('Code');
  readonly placeholder = input<string>('No code to display');
  readonly height = input<number>(600);
  readonly copyable = input<boolean>(true);
  readonly showLineNumbers = input<boolean>(false);

  readonly copySuccess = signal<boolean>(false);

  readonly charCount = computed(() => this.code().length);

  readonly highlightedCode = computed<SafeHtml>(() => {
    const code = this.code();
    if (!code) return '';
    const highlighted = this.highlighter.highlight(code, this.language());
    return this.sanitizer.bypassSecurityTrustHtml(highlighted);
  });

  readonly highlightedCodeWithLines = computed<SafeHtml>(() => {
    const code = this.code();
    if (!code) return '';
    const highlighted = this.highlighter.highlightWithLineNumbers(code, this.language());
    return this.sanitizer.bypassSecurityTrustHtml(highlighted);
  });

  protected async copyToClipboard(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.code());
      this.copySuccess.set(true);
      setTimeout(() => this.copySuccess.set(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }
}
