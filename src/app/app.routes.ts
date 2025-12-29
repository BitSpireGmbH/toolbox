import { Routes } from '@angular/router';

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
  {
    path: 'csharp-json',
    loadComponent: () => import('./csharp-json/csharp-json').then(m => m.CsharpJsonComponent)
  },
  {
    path: 'csharp-typescript',
    loadComponent: () => import('./csharp-typescript/csharp-typescript').then(m => m.CsharpTypescriptComponent)
  }
];
