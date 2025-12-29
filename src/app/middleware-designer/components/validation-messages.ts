import { Component, input, ChangeDetectionStrategy } from '@angular/core';

export interface ValidationMessage {
  middlewareId: string;
  message: string;
}

@Component({
  selector: 'app-validation-messages',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (errors().length > 0) {
      <div class="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
        <p class="text-sm font-semibold text-red-800 mb-1">Errors:</p>
        @for (error of errors(); track error.middlewareId) {
          <p class="text-sm text-red-700">• {{ error.message }}</p>
        }
      </div>
    }
    @if (warnings().length > 0) {
      <div class="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p class="text-sm font-semibold text-yellow-800 mb-1">Warnings:</p>
        @for (warning of warnings(); track warning.middlewareId) {
          <p class="text-sm text-yellow-700">• {{ warning.message }}</p>
        }
      </div>
    }
  `,
  styles: []
})
export class ValidationMessagesComponent {
  readonly errors = input<ValidationMessage[]>([]);
  readonly warnings = input<ValidationMessage[]>([]);
}
