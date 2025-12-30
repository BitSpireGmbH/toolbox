import { Component, input, output, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import type { MiddlewareType, MiddlewareConfig } from '../models';

export interface MiddlewareLibraryItemData {
  type: MiddlewareType;
  name: string;
  icon: string;
  description: string;
  defaultConfig: MiddlewareConfig;
}

@Component({
  selector: 'app-middleware-library-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block'
  },
  template: `
    <button
      (click)="itemClick.emit({ type: item().type, config: item().defaultConfig })"
      class="cursor-pointer w-full text-left p-2.5 bg-white border border-gray-200 rounded-lg hover:border-brand-primary hover:shadow-sm transition-all duration-200 group">
      <div class="flex items-start gap-2.5">
        <div class="text-gray-600 group-hover:text-brand-primary mt-0.5 flex-shrink-0" [innerHTML]="safeIcon()"></div>
        <div class="flex-1 min-w-0">
          <p class="font-medium text-sm text-gray-800 group-hover:text-brand-primary transition-colors">
            {{ item().name }}
          </p>
          <p class="text-xs text-gray-600 mt-0.5 line-clamp-2">{{ item().description }}</p>
        </div>
      </div>
    </button>
  `,
  styles: []
})
export class MiddlewareLibraryItemComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly item = input.required<MiddlewareLibraryItemData>();
  readonly itemClick = output<{ type: MiddlewareType; config: MiddlewareConfig }>();

  protected readonly safeIcon = computed(() => 
    this.sanitizer.bypassSecurityTrustHtml(this.item().icon)
  );
}
