import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-navmenu',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navmenu.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavmenuComponent {
  readonly sidebarOpen = input.required<boolean>();

  readonly toggleSidebar = output<void>();
  readonly closeSidebar = output<void>();

  protected readonly version = signal(environment.version);

  protected onToggleSidebar(): void {
    this.toggleSidebar.emit();
  }

  protected onCloseSidebar(): void {
    this.closeSidebar.emit();
  }
}
