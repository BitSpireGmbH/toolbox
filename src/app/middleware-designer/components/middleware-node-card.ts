import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { MiddlewareNode, MiddlewareConfig } from '../../services/middleware-designer.service';

@Component({
  selector: 'app-middleware-node-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-start gap-3">
      <div class="flex-shrink-0 w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center text-xs font-bold text-gray-700">
        {{ middleware().order }}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between">
          <h4 class="font-semibold text-sm text-gray-800">{{ middleware().type }}</h4>
          <div class="flex gap-1.5">
            <button
              (click)="edit.emit()"
              class="px-2 py-1 text-xs bg-blue-50 text-brand-primary rounded hover:bg-blue-100 transition-all font-medium">
              Edit
            </button>
            <button
              (click)="delete.emit()"
              class="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 transition-all font-medium">
              Delete
            </button>
          </div>
        </div>
        @if (configSummary(); as summary) {
          <p class="text-xs text-gray-600 mt-1">{{ summary }}</p>
        }
        @if (middleware().branch) {
          <div class="mt-2 p-2 bg-purple-50 border border-purple-200 rounded text-xs">
            <p class="font-semibold text-purple-800">Branch Condition:</p>
            <p class="text-purple-700">{{ branchText() }}</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: []
})
export class MiddlewareNodeCardComponent {
  readonly middleware = input.required<MiddlewareNode>();
  readonly configSummary = input<string>();
  readonly branchText = input<string>();
  readonly selected = input<boolean>(false);

  readonly edit = output<void>();
  readonly delete = output<void>();
}
