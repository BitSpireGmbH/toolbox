import { Component, signal, inject, effect, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JwtDecoderService, type DecodedJwt, type ClaimExplanation } from '../services/jwt-decoder.service';

@Component({
  selector: 'app-jwt-decoder',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-[1600px] mx-auto p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-vscode-text mb-1">JWT Decoder</h1>
          <p class="text-sm text-vscode-text-muted">Decode and inspect JSON Web Tokens</p>
        </div>
        
        @if (decodedToken()) {
          <div class="flex items-center gap-3 px-4 py-2 rounded-lg border" 
               [class]="getValidityColorClasses()">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              @if (validityInfo()?.status === 'valid') {
                <polyline points="20 6 9 17 4 12"></polyline>
              } @else if (validityInfo()?.status === 'expired') {
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              } @else if (validityInfo()?.status === 'not-yet-valid') {
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              } @else {
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              }
            </svg>
            <span class="font-semibold text-sm">{{ validityInfo()?.message }}</span>
          </div>
        }
      </div>

      <!-- Input Area -->
      <div class="mb-6">
        <div class="bg-vscode-sidebar rounded-xl shadow-md border border-vscode-border overflow-hidden">
          <div class="panel-header px-4 py-2.5 border-b border-vscode-border">
            <div class="flex items-center gap-2">
              <span 
                class="status-dot"
                [class.active]="inputToken()"
                [class.inactive]="!inputToken()">
              </span>
              <h3 class="font-semibold text-sm text-vscode-text">JWT Token</h3>
            </div>
          </div>
          <textarea
            [(ngModel)]="inputToken"
            class="w-full h-32 p-4 font-mono text-sm focus:outline-none resize-none bg-vscode-bg text-vscode-text code-editor"
            placeholder="Paste your JWT token here (e.g., eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...)

You can paste the token with or without the 'Bearer' prefix."
          ></textarea>
        </div>
        @if (errorMessage()) {
          <div class="mt-3 p-3 bg-red-900/20 border border-red-700 rounded-lg flex items-start gap-2">
            <svg class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <p class="text-sm text-red-400">{{ errorMessage() }}</p>
          </div>
        }
      </div>

      @if (decodedToken()) {
        <!-- Output Area -->
        <div class="grid md:grid-cols-2 gap-5">
          <!-- Header Section -->
          <div class="bg-vscode-sidebar rounded-xl shadow-md border border-vscode-border overflow-hidden">
            <div class="bg-gradient-to-r from-blue-900/30 to-blue-800/30 px-4 py-3 border-b border-vscode-border">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="status-dot active"></span>
                  <h3 class="font-semibold text-sm text-vscode-text">Header</h3>
                </div>
                <button 
                  (click)="copyToClipboard(decodedToken()!.header)"
                  class="px-2 py-1 rounded-md text-xs font-semibold text-blue-400 hover:bg-blue-400/10 transition-colors">
                  <span class="flex items-center gap-1">
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    Copy
                  </span>
                </button>
              </div>
            </div>
            <div class="p-4 space-y-3 max-h-[500px] overflow-y-auto">
              @for (field of headerExplanations(); track field.name) {
                <div class="bg-vscode-panel rounded-lg p-3 border border-vscode-border">
                  <div class="flex items-start justify-between mb-1">
                    <code class="text-sm font-semibold text-blue-400">{{ field.name }}</code>
                    @if (field.isStandard) {
                      <span class="text-xs px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded-full font-medium">Standard</span>
                    } @else {
                      <span class="text-xs px-2 py-0.5 bg-vscode-border text-vscode-text-muted rounded-full font-medium">Custom</span>
                    }
                  </div>
                  <div class="text-sm text-vscode-success font-mono mb-2 break-all">{{ formatValue(field.value) }}</div>
                  <p class="text-xs text-vscode-text-muted leading-relaxed">{{ field.explanation }}</p>
                </div>
              }
            </div>
          </div>

          <!-- Payload Section -->
          <div class="bg-vscode-sidebar rounded-xl shadow-md border border-vscode-border overflow-hidden">
            <div class="bg-gradient-to-r from-green-900/30 to-green-800/30 px-4 py-3 border-b border-vscode-border">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="status-dot active"></span>
                  <h3 class="font-semibold text-sm text-vscode-text">Payload (Claims)</h3>
                </div>
                <button 
                  (click)="copyToClipboard(decodedToken()!.payload)"
                  class="px-2 py-1 rounded-md text-xs font-semibold text-green-400 hover:bg-green-400/10 transition-colors">
                  <span class="flex items-center gap-1">
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    Copy
                  </span>
                </button>
              </div>
            </div>
            <div class="p-4 space-y-3 max-h-[500px] overflow-y-auto">
              @for (claim of claimExplanations(); track claim.name) {
                <div class="bg-vscode-panel rounded-lg p-3 border border-vscode-border">
                  <div class="flex items-start justify-between mb-1">
                    <code class="text-sm font-semibold text-green-400">{{ claim.name }}</code>
                    @if (claim.isStandard) {
                      <span class="text-xs px-2 py-0.5 bg-green-900/30 text-green-400 rounded-full font-medium">Standard</span>
                    } @else {
                      <span class="text-xs px-2 py-0.5 bg-vscode-border text-vscode-text-muted rounded-full font-medium">Custom</span>
                    }
                  </div>
                  <div class="text-sm text-vscode-success font-mono mb-2 break-all">{{ formatValue(claim.value) }}</div>
                  <p class="text-xs text-vscode-text-muted leading-relaxed">{{ claim.explanation }}</p>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Info Panel -->
        <div class="mt-5 bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded-xl shadow-md border border-blue-700/30 p-5">
          <div class="flex items-start gap-3">
            <svg class="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <div class="flex-1">
              <h4 class="font-semibold text-sm text-vscode-text mb-2">About JWT Tokens</h4>
              <div class="text-xs text-vscode-text-muted space-y-2 leading-relaxed">
                <p>
                  <strong class="text-vscode-text">JSON Web Tokens (JWT)</strong> are compact, URL-safe tokens used for secure information transmission between parties. 
                  Each token consists of three parts: Header, Payload, and Signature.
                </p>
                <p>
                  <strong class="text-vscode-text">Security Note:</strong> This decoder only reads and displays the token information. 
                  JWTs are not encrypted (only signed), so never include sensitive data in the token itself. 
                  Always validate signatures on the server side.
                </p>
                @if (decodedToken()!.issuedAt) {
                  <p><strong class="text-vscode-text">Issued:</strong> {{ decodedToken()!.issuedAt!.toLocaleString() }}</p>
                }
                @if (decodedToken()!.notBefore) {
                  <p><strong class="text-vscode-text">Not Before:</strong> {{ decodedToken()!.notBefore!.toLocaleString() }}</p>
                }
                @if (decodedToken()!.expiresAt) {
                  <p><strong class="text-vscode-text">Expires:</strong> {{ decodedToken()!.expiresAt!.toLocaleString() }}</p>
                }
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: []
})
export class JwtDecoderComponent {
  private readonly decoderService = inject(JwtDecoderService);

  protected readonly inputToken = signal<string>('');
  protected readonly decodedToken = signal<DecodedJwt | null>(null);
  protected readonly errorMessage = signal<string>('');
  protected readonly headerExplanations = signal<ClaimExplanation[]>([]);
  protected readonly claimExplanations = signal<ClaimExplanation[]>([]);
  protected readonly validityInfo = signal<{ status: string; message: string; color: string } | null>(null);

  constructor() {
    // Auto-decode on input change
    effect(() => {
      const input = this.inputToken();
      if (input.trim()) {
        this.decodeToken();
      } else {
        this.decodedToken.set(null);
        this.errorMessage.set('');
        this.headerExplanations.set([]);
        this.claimExplanations.set([]);
        this.validityInfo.set(null);
      }
    });
  }

  protected decodeToken(): void {
    this.errorMessage.set('');
    
    try {
      const decoded = this.decoderService.decodeToken(this.inputToken());
      this.decodedToken.set(decoded);
      
      // Get explanations
      this.headerExplanations.set(this.decoderService.getHeaderExplanations(decoded.header));
      this.claimExplanations.set(this.decoderService.getClaimExplanations(decoded.payload));
      
      // Get validity info
      this.validityInfo.set(this.decoderService.getValidityMessage(decoded));
    } catch (error) {
      this.decodedToken.set(null);
      this.headerExplanations.set([]);
      this.claimExplanations.set([]);
      this.validityInfo.set(null);
      this.errorMessage.set(error instanceof Error ? error.message : 'An error occurred while decoding the token');
    }
  }

  protected async copyToClipboard(data: unknown): Promise<void> {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }

  protected formatValue(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  }

  protected getValidityColorClasses(): string {
    const color = this.validityInfo()?.color;
    switch (color) {
      case 'green':
        return 'bg-green-900/20 border-green-700 text-green-400';
      case 'red':
        return 'bg-red-900/20 border-red-700 text-red-400';
      case 'orange':
        return 'bg-orange-900/20 border-orange-700 text-orange-400';
      case 'blue':
        return 'bg-blue-900/20 border-blue-700 text-blue-400';
      default:
        return 'bg-vscode-border border-vscode-border text-vscode-text';
    }
  }
}
