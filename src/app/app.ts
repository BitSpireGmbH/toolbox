import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';
import { NavmenuComponent } from './navmenu/navmenu.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavmenuComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('toolbox');
  protected readonly version = signal(environment.version);
  protected readonly sidebarOpen = signal(false);

  protected toggleSidebar(): void {
    this.sidebarOpen.set(!this.sidebarOpen());
  }

  protected closeSidebar(): void {
    this.sidebarOpen.set(false);
  }
}
