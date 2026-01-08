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
  },
  {
    path: 'middleware-designer',
    loadComponent: () => import('./middleware-designer/middleware-designer').then(m => m.MiddlewareDesignerComponent)
  },
  {
    path: 'jwt-decoder',
    loadComponent: () => import('./jwt-decoder/jwt-decoder').then(m => m.JwtDecoderComponent)
  },
  {
    path: 'package-centralizer',
    loadComponent: () => import('./package-centralizer/package-centralizer').then(m => m.PackageCentralizerComponent)
  },
  {
    path: 'csharp-mindmap',
    loadComponent: () => import('./csharp-mindmap/csharp-mindmap.component').then(m => m.CsharpMindmapComponent)
  },
  {
    path: 'list-visualizer',
    loadComponent: () => import('./list-visualizer/list-visualizer').then(m => m.ListVisualizerComponent)
  },
  {
    path: 'srp-analyzer',
    loadComponent: () => import('./srp-analyzer/srp-analyzer').then(m => m.SrpAnalyzerComponent)
  }
];
