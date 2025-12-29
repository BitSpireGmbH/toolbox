import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-navmenu',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navmenu.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NavmenuComponent {
  readonly sidebarOpen = input.required<boolean>();
  readonly version = input.required<string>();

  readonly toggleSidebar = output<void>();
  readonly closeSidebar = output<void>();

  protected onToggleSidebar(): void {
    this.toggleSidebar.emit();
  }

  protected onCloseSidebar(): void {
    this.closeSidebar.emit();
  }
}
