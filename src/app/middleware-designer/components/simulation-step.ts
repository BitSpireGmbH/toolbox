import { Component, input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-simulation-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-3 bg-gray-50 border border-gray-200 rounded-lg">
      <div class="flex items-start justify-between">
        <p class="text-sm font-semibold text-gray-800">
          {{ order() }}. {{ middlewareName() }}
        </p>
        @if (decision(); as dec) {
          <span
            class="px-2 py-0.5 text-xs rounded font-medium"
            [class]="getDecisionClass(dec)">
            {{ dec }}
          </span>
        }
      </div>
      <p class="text-xs text-gray-700 mt-1">{{ action() }}</p>
    </div>
  `,
  host: {
    class: 'block'
  },
  styles: []
})
export class SimulationStepComponent {
  readonly order = input.required<number>();
  readonly middlewareName = input.required<string>();
  readonly action = input.required<string>();
  readonly decision = input<string>();

  protected getDecisionClass(decision: string): string {
    if (decision === 'terminate') return 'bg-red-100 text-red-800';
    if (decision === 'continue') return 'bg-green-100 text-green-800';
    if (decision.includes('branch')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  }
}
