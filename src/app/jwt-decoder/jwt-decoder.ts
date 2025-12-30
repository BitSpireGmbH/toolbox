import { Component, signal, inject, effect, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JwtDecoderService, type DecodedJwt, type ClaimExplanation } from '../services/jwt-decoder.service';

@Component({
  selector: 'app-jwt-decoder',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-400 mx-auto p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-1">JWT Decoder</h1>
          <p class="text-sm text-gray-600">Decode and inspect JSON Web Tokens</p>
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
        <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div class="bg-linear-to-r from-gray-50 to-gray-100 px-4 py-2.5 border-b border-gray-200">
            <div class="flex items-center gap-2">
              <div class="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
              <h3 class="font-semibold text-sm text-gray-700">JWT Token</h3>
            </div>
          </div>
          <textarea
            [(ngModel)]="inputToken"
            class="w-full h-32 p-4 font-mono text-sm focus:outline-none resize-none bg-gray-50/50"
            placeholder="Paste your JWT token here (e.g., eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...)

You can paste the token with or without the 'Bearer' prefix."
          ></textarea>
        </div>
        @if (errorMessage()) {
          <div class="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <svg class="w-5 h-5 text-red-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <p class="text-sm text-red-700">{{ errorMessage() }}</p>
          </div>
        }
      </div>

      @if (decodedToken()) {
        <!-- Output Area -->
        <div class="grid md:grid-cols-2 gap-5">
          <!-- Header Section -->
          <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <div class="bg-linear-to-r from-blue-50 to-blue-100 px-4 py-3 border-b border-blue-200">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  <h3 class="font-semibold text-sm text-gray-800">Header</h3>
                </div>
              </div>
            </div>
            <div class="p-4 space-y-3 max-h-125 overflow-y-auto">
              @for (field of headerExplanations(); track field.name) {
                <div class="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div class="flex items-start justify-between mb-1">
                    <code class="text-sm font-semibold text-blue-600">{{ field.name }}</code>
                    @if (field.isStandard) {
                      <span class="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">Standard</span>
                    } @else {
                      <span class="text-xs px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full font-medium">Custom</span>
                    }
                  </div>
                  <div class="text-sm text-gray-900 font-mono mb-2 break-all">{{ formatValue(field.value) }}</div>
                  <p class="text-xs text-gray-600 leading-relaxed">{{ field.explanation }}</p>
                </div>
              }
            </div>
          </div>

          <!-- Payload Section -->
          <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <div class="bg-linear-to-r from-green-50 to-green-100 px-4 py-3 border-b border-green-200">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                  <h3 class="font-semibold text-sm text-gray-800">Payload (Claims)</h3>
                </div>
              </div>
            </div>
            <div class="p-4 space-y-3 max-h-125 overflow-y-auto">
              @for (claim of claimExplanations(); track claim.name) {
                <div class="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div class="flex items-start justify-between mb-1">
                    <code class="text-sm font-semibold text-green-600">{{ claim.name }}</code>
                    @if (claim.isStandard) {
                      <span class="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Standard</span>
                    } @else {
                      <span class="text-xs px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full font-medium">Custom</span>
                    }
                  </div>
                  <div class="text-sm text-gray-900 font-mono mb-2 break-all">{{ formatValue(claim.value) }}</div>
                  <p class="text-xs text-gray-600 leading-relaxed">{{ claim.explanation }}</p>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Info Panel -->
        <div class="mt-5 bg-linear-to-br from-blue-50 to-purple-50 rounded-xl shadow-md border border-blue-200 p-5">
          <div class="flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-blue-600 shrink-0 mt-0.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
            <div class="flex-1">
              <h4 class="font-semibold text-sm text-gray-900 mb-2">About JWT Tokens</h4>
              <div class="text-xs text-gray-700 space-y-2 leading-relaxed">
                <p>
                  <strong>JSON Web Tokens (JWT)</strong> are compact, URL-safe tokens used for secure information transmission between parties.
                  Each token consists of three parts: Header, Payload, and Signature.
                </p>
                <p>
                  <strong>Security Note:</strong> This decoder only reads and displays the token information.
                  JWTs are not encrypted (only signed), so never include sensitive data in the token itself.
                  Always validate signatures on the server side.
                </p>
                @if (decodedToken()!.issuedAt) {
                  <p><strong>Issued:</strong> {{ decodedToken()!.issuedAt!.toLocaleString() }}</p>
                }
                @if (decodedToken()!.notBefore) {
                  <p><strong>Not Before:</strong> {{ decodedToken()!.notBefore!.toLocaleString() }}</p>
                }
                @if (decodedToken()!.expiresAt) {
                  <p><strong>Expires:</strong> {{ decodedToken()!.expiresAt!.toLocaleString() }}</p>
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
        return 'bg-green-50 border-green-300 text-green-700';
      case 'red':
        return 'bg-red-50 border-red-300 text-red-700';
      case 'orange':
        return 'bg-orange-50 border-orange-300 text-orange-700';
      case 'blue':
        return 'bg-blue-50 border-blue-300 text-blue-700';
      default:
        return 'bg-gray-50 border-gray-300 text-gray-700';
    }
  }
}
