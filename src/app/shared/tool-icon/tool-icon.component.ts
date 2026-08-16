import { Component, ChangeDetectionStrategy, input } from '@angular/core';

/**
 * One icon per tool. Kept as a single registry so no two tools can ever be
 * assigned the same glyph by accident (previously JWT Decoder and Middleware
 * Designer both rendered the same lock icon on desktop).
 */
export type ToolIconName =
  | 'braces'
  | 'swap'
  | 'layers'
  | 'terminal'
  | 'pipeline'
  | 'link'
  | 'shears'
  | 'csharp-box'
  | 'list'
  | 'grid'
  | 'lock'
  | 'package'
  | 'regex'
  | 'env'
  | 'signpost'
  | 'flow'
  | 'segments';

@Component({
  selector: 'app-tool-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (name()) {
      @case ('braces') {
        <svg [attr.class]="svgClass()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M14 19H16C17.1046 19 18 18.1046 18 17V14.5616C18 13.6438 18.6246 12.8439 19.5149 12.6213L21.0299 12.2425C21.2823 12.1794 21.2823 11.8206 21.0299 11.7575L19.5149 11.3787C18.6246 11.1561 18 10.3562 18 9.43845V5H14"/>
          <path d="M10 5H8C6.89543 5 6 5.89543 6 7V9.43845C6 10.3562 5.37541 11.1561 4.48507 11.3787L2.97014 11.7575C2.71765 11.8206 2.71765 12.1794 2.97014 12.2425L4.48507 12.6213C5.37541 12.8439 6 13.6438 6 14.5616V19H10"/>
        </svg>
      }
      @case ('swap') {
        <svg [attr.class]="svgClass()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <polyline points="16 18 22 12 16 6"></polyline>
          <polyline points="8 6 2 12 8 18"></polyline>
        </svg>
      }
      @case ('layers') {
        <svg [attr.class]="svgClass()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
        </svg>
      }
      @case ('terminal') {
        <svg [attr.class]="svgClass()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <polyline points="4 17 10 11 4 5" stroke-linecap="round" stroke-linejoin="round"></polyline>
          <line x1="12" y1="19" x2="20" y2="19" stroke-linecap="round"></line>
        </svg>
      }
      @case ('pipeline') {
        <svg [attr.class]="svgClass()" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 6.878V6a2.25 2.25 0 0 1 2.25-2.25h7.5A2.25 2.25 0 0 1 18 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 0 0 4.5 9v.878m13.5-3A2.25 2.25 0 0 1 19.5 9v.878m0 0a2.246 2.246 0 0 0-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0 1 21 12v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6c0-.98.626-1.813 1.5-2.122" />
        </svg>
      }
      @case ('link') {
        <svg [attr.class]="svgClass()" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
        </svg>
      }
      @case ('shears') {
        <svg [attr.class]="svgClass()" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="m15 11.25 1.5 1.5.75-.75V8.758l2.276-.61a3 3 0 1 0-3.675-3.675l-.61 2.277H12l-.75.75 1.5 1.5M15 11.25l-8.47 8.47c-.34.34-.8.53-1.28.53s-.94.19-1.28.53l-.97.97-.75-.75.97-.97c.34-.34.53-.8.53-1.28s.19-.94.53-1.28L12.75 9M15 11.25 12.75 9" />
        </svg>
      }
      @case ('csharp-box') {
        <svg [attr.class]="svgClass()" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="4" stroke="currentColor" stroke-width="2"></rect>
          <text x="50%" y="50%" fill="currentColor" font-family="Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial" font-size="10" font-weight="700" text-anchor="middle" dominant-baseline="central">C#</text>
        </svg>
      }
      @case ('list') {
        <svg [attr.class]="svgClass()" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
        </svg>
      }
      @case ('grid') {
        <svg [attr.class]="svgClass()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M4 8h16M4 16h16M8 4v16M16 4v16" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      }
      @case ('lock') {
        <svg [attr.class]="svgClass()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      }
      @case ('package') {
        <svg [attr.class]="svgClass()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
      }
      @case ('regex') {
        <svg [attr.class]="svgClass()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="10" cy="10" r="7"></circle>
          <line x1="21" y1="21" x2="15" y2="15" stroke-linecap="round"></line>
        </svg>
      }
      @case ('env') {
        <svg [attr.class]="svgClass()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <rect x="2" y="4" width="20" height="16" rx="2"></rect>
          <polyline points="9 9 6 12 9 15" stroke-linecap="round" stroke-linejoin="round"></polyline>
          <polyline points="15 9 18 12 15 15" stroke-linecap="round" stroke-linejoin="round"></polyline>
          <line x1="6" y1="12" x2="18" y2="12" stroke-linecap="round"></line>
        </svg>
      }
      @case ('signpost') {
        <svg [attr.class]="svgClass()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <line x1="12" y1="3" x2="12" y2="21" stroke-linecap="round"></line>
          <path d="M12 6h6l2.5 2.5L18 11h-6" stroke-linecap="round" stroke-linejoin="round"></path>
          <path d="M12 14H6l-2.5 2.5L6 19h6" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
      }
      @case ('flow') {
        <svg [attr.class]="svgClass()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <line x1="3" y1="12" x2="17" y2="12" stroke-linecap="round"></line>
          <circle cx="6.5" cy="12" r="1.6" fill="currentColor" stroke="none"></circle>
          <circle cx="11.5" cy="12" r="1.6" fill="currentColor" stroke="none"></circle>
          <path d="M16.5 8.5 20 12l-3.5 3.5" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
      }
      @case ('segments') {
        <!--
          A byte range divided into fields of unequal width. Deliberately only two
          dividers: this renders at 20px, where anything finer turns to mush.
        -->
        <svg [attr.class]="svgClass()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <rect x="2" y="7" width="20" height="10" rx="2"></rect>
          <line x1="9" y1="7" x2="9" y2="17"></line>
          <line x1="14" y1="7" x2="14" y2="17"></line>
        </svg>
      }
    }
  `,
})
export class ToolIconComponent {
  readonly name = input.required<ToolIconName>();
  readonly svgClass = input('w-5 h-5 shrink-0');
}
