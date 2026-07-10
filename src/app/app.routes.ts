import { Routes } from '@angular/router';
import { HOME_SEO } from './shared/seo.models';
import { TOOLS } from './shared/tools.registry';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/home',
    pathMatch: 'full'
  },
  {
    path: 'home',
    data: { seo: HOME_SEO },
    loadComponent: () => import('./landing-page/landing-page').then(m => m.LandingPageComponent)
  },
  ...TOOLS.map(tool => ({
    path: tool.path,
    data: { seo: tool.seo },
    loadComponent: tool.loadComponent
  }))
];
