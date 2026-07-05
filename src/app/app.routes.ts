import { Routes } from '@angular/router';
import { TOOLS } from './shared/tools.registry';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/home',
    pathMatch: 'full'
  },
  {
    path: 'home',
    loadComponent: () => import('./landing-page/landing-page').then(m => m.LandingPageComponent)
  },
  ...TOOLS.map(tool => ({
    path: tool.path,
    loadComponent: tool.loadComponent
  }))
];
