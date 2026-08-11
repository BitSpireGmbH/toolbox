import type { Type } from '@angular/core';
import type { ToolIconName } from './tool-icon/tool-icon.component';
import type { SeoMetadata } from './seo.models';

/**
 * The four groupings shown in the sidebar, the landing page, and the search
 * palette. Kept as a single list so every surface uses identical labels.
 */
export type ToolCategory = 'Converters' | 'ASP.NET Core' | 'Architecture & Analysis' | 'Utilities';

export const TOOL_CATEGORIES: ToolCategory[] = ['Converters', 'ASP.NET Core', 'Architecture & Analysis', 'Utilities'];

/**
 * Fully literal Tailwind class strings (never assembled from a bare color
 * name at runtime) so Tailwind's build-time content scan can find every
 * class this file references, even though templates bind them dynamically.
 */
export interface ToolAccent {
  /** Icon badge gradient + hover shadow tint on the landing page card. */
  badge: string;
  /** Background tint that fades in on card hover. */
  overlay: string;
  /** Card border color on hover. */
  border: string;
  /** Focus ring color for keyboard navigation. */
  ring: string;
  /** Title color on hover. */
  titleHover: string;
  /** CTA text color (always on). */
  ctaText: string;
}

/**
 * A single tool. This is the ONLY place a tool is registered - routes, the
 * desktop + mobile sidebar, the landing page cards, and the ⌘K search
 * palette all read this same array, so a tool can never appear in one
 * surface while missing from another.
 */
export interface Tool {
  /** Route path, no leading slash. */
  path: string;
  title: string;
  tagline: string;
  description: string;
  /** Search-result and browser title for this tool's route. */
  seo: SeoMetadata;
  /** Landing-page card call-to-action label, e.g. 'Start Converting'. */
  cta: string;
  category: ToolCategory;
  icon: ToolIconName;
  accent: ToolAccent;
  loadComponent: () => Promise<Type<unknown>>;
}

export const TOOLS: Tool[] = [
  // ---- Converters ----
  {
    path: 'csharp-json',
    title: 'JSON → C#',
    tagline: 'One-way Converter',
    description: 'Convert JSON to C# classes with support for records, structs, and various serializers.',
    seo: {
      title: 'JSON to C# Converter | .NET Developer Toolbox',
      description: 'Convert JSON to C# classes, records, or structs with serializer options. Your data stays private in your browser.',
    },
    cta: 'Start Converting',
    category: 'Converters',
    icon: 'braces',
    accent: {
      badge: 'from-brand-primary to-blue-600 group-hover:shadow-brand-primary/25',
      overlay: 'from-brand-primary/0 via-brand-primary/0 to-brand-primary/5',
      border: 'hover:border-brand-primary',
      ring: 'focus:ring-brand-primary',
      titleHover: 'group-hover:text-brand-primary',
      ctaText: 'text-brand-primary',
    },
    loadComponent: () => import('../csharp-json/csharp-json').then(m => m.CsharpJsonComponent),
  },
  {
    path: 'csharp-typescript',
    title: 'C# ↔ TypeScript',
    tagline: 'Bidirectional Converter',
    description: 'Convert between C# classes and TypeScript interfaces for full-stack development.',
    seo: {
      title: 'C# to TypeScript Converter | .NET Developer Toolbox',
      description: 'Convert C# classes to TypeScript interfaces and TypeScript back to C# for full-stack development in your browser.',
    },
    cta: 'Start Converting',
    category: 'Converters',
    icon: 'swap',
    accent: {
      badge: 'from-brand-secondary to-purple-600 group-hover:shadow-brand-secondary/25',
      overlay: 'from-brand-secondary/0 via-brand-secondary/0 to-brand-secondary/5',
      border: 'hover:border-brand-secondary',
      ring: 'focus:ring-brand-secondary',
      titleHover: 'group-hover:text-brand-secondary',
      ctaText: 'text-brand-secondary',
    },
    loadComponent: () => import('../csharp-typescript/csharp-typescript').then(m => m.CsharpTypescriptComponent),
  },
  {
    path: 'strong-typer',
    title: 'Strong-Typer',
    tagline: 'Options Generator',
    description: 'Create strongly-typed C# Options from JSON with validation and registration code.',
    seo: {
      title: 'JSON to C# Options Class Generator | .NET Developer Toolbox',
      description: 'Generate strongly typed C# Options classes from JSON configuration, including validation and registration code.',
    },
    cta: 'Start Generating',
    category: 'Converters',
    icon: 'layers',
    accent: {
      badge: 'from-indigo-500 to-blue-700 group-hover:shadow-indigo-500/25',
      overlay: 'from-indigo-500/0 via-indigo-500/0 to-indigo-500/5',
      border: 'hover:border-indigo-500',
      ring: 'focus:ring-indigo-500',
      titleHover: 'group-hover:text-indigo-600',
      ctaText: 'text-indigo-600',
    },
    loadComponent: () => import('../strong-typer/strong-typer').then(m => m.StrongTyperComponent),
  },
  {
    path: 'appsettings-env',
    title: 'appsettings ↔ Env Vars',
    tagline: 'Config Flattener',
    description: 'Flatten appsettings.json into environment variables and back, with correct quoting per platform.',
    seo: {
      title: 'appsettings.json to Environment Variables Converter | .NET Developer Toolbox',
      description: 'Convert appsettings.json to environment variables (Foo:Bar → Foo__Bar) and back, with Bash, PowerShell, cmd/setx, and Docker output. Runs entirely in your browser.',
    },
    cta: 'Start Converting',
    category: 'Converters',
    icon: 'env',
    accent: {
      badge: 'from-amber-500 to-orange-600 group-hover:shadow-amber-500/25',
      overlay: 'from-amber-500/0 via-amber-500/0 to-amber-500/5',
      border: 'hover:border-amber-500',
      ring: 'focus:ring-amber-500',
      titleHover: 'group-hover:text-amber-600',
      ctaText: 'text-amber-600',
    },
    loadComponent: () => import('../appsettings-env/appsettings-env').then(m => m.AppsettingsEnvComponent),
  },
  {
    path: 'curl-to-httpclient',
    title: 'cURL → HttpClient',
    tagline: 'API Code Generator',
    description: 'Paste any curl command and get idiomatic C# HttpClient code - inline, factory, or typed.',
    seo: {
      title: 'cURL to C# HttpClient Converter | .NET Developer Toolbox',
      description: 'Turn cURL commands into idiomatic C# HttpClient code using inline, factory, or typed-client patterns.',
    },
    cta: 'Start Converting',
    category: 'Converters',
    icon: 'terminal',
    accent: {
      badge: 'from-teal-500 to-cyan-600 group-hover:shadow-teal-500/25',
      overlay: 'from-teal-500/0 via-teal-500/0 to-teal-500/5',
      border: 'hover:border-teal-500',
      ring: 'focus:ring-teal-500',
      titleHover: 'group-hover:text-teal-600',
      ctaText: 'text-teal-600',
    },
    loadComponent: () => import('../curl-to-httpclient/curl-to-httpclient').then(m => m.CurlToHttpClientComponent),
  },

  // ---- ASP.NET Core ----
  {
    path: 'middleware-designer',
    title: 'Middleware Designer',
    tagline: 'Visual Pipeline Builder',
    description: 'Build ASP.NET Core middleware pipelines visually and export ready-to-use C# code.',
    seo: {
      title: 'ASP.NET Core Middleware Designer | .NET Developer Toolbox',
      description: 'Design ASP.NET Core middleware pipelines visually, simulate requests, and export ready-to-use C# code.',
    },
    cta: 'Start Designing',
    category: 'ASP.NET Core',
    icon: 'pipeline',
    accent: {
      badge: 'from-brand-primary to-brand-secondary group-hover:shadow-brand-primary/25',
      overlay: 'from-brand-primary/0 via-purple-500/0 to-brand-secondary/5',
      border: 'hover:border-brand-primary',
      ring: 'focus:ring-brand-primary',
      titleHover: 'group-hover:text-brand-primary',
      ctaText: 'text-brand-primary',
    },
    loadComponent: () => import('../middleware-designer/middleware-designer').then(m => m.MiddlewareDesignerComponent),
  },
  {
    path: 'typed-di-helper',
    title: 'Typed DI Helper',
    tagline: 'DI Snippet Generator',
    description: 'Generate boilerplate for strongly-typed HttpClient and SignalR Hub configurations in .NET.',
    seo: {
      title: 'Typed HttpClient and SignalR DI Generator | .NET Developer Toolbox',
      description: 'Generate strongly typed .NET dependency-injection configuration for HttpClient and SignalR hubs.',
    },
    cta: 'Start Generating',
    category: 'ASP.NET Core',
    icon: 'link',
    accent: {
      badge: 'from-emerald-500 to-teal-600 group-hover:shadow-emerald-500/25',
      overlay: 'from-emerald-500/0 via-emerald-500/0 to-emerald-500/5',
      border: 'hover:border-emerald-500',
      ring: 'focus:ring-emerald-500',
      titleHover: 'group-hover:text-emerald-600',
      ctaText: 'text-emerald-600',
    },
    loadComponent: () => import('../typed-di-helper/typed-di-helper').then(m => m.TypedDiHelperComponent),
  },
  {
    path: 'response-guide',
    title: 'Response Guide',
    tagline: 'Status Code Reference',
    description: 'Every response scenario as both an MVC controller and a Minimal API TypedResults endpoint.',
    seo: {
      title: 'ASP.NET Core Response and HTTP Status Code Guide | .NET Developer Toolbox',
      description: 'Searchable ASP.NET Core response reference: controller and Minimal API TypedResults snippets for 200, 201, 400, 429 with Retry-After, 502, 503, 504, plus nginx 499 and Cloudflare 520-526 explained.',
    },
    cta: 'Start Browsing',
    category: 'ASP.NET Core',
    icon: 'signpost',
    accent: {
      badge: 'from-sky-500 to-blue-700 group-hover:shadow-sky-500/25',
      overlay: 'from-sky-500/0 via-sky-500/0 to-sky-500/5',
      border: 'hover:border-sky-500',
      ring: 'focus:ring-sky-500',
      titleHover: 'group-hover:text-sky-600',
      ctaText: 'text-sky-600',
    },
    loadComponent: () => import('../response-guide/response-guide').then(m => m.ResponseGuideComponent),
  },

  // ---- Architecture & Analysis ----
  {
    path: 'srp-analyzer',
    title: 'SRP Analyzer',
    tagline: 'Code Quality Tool',
    description: 'Analyze C# classes for Single Responsibility Principle violations with color-coded dependencies.',
    seo: {
      title: 'C# Single Responsibility Principle Analyzer | .NET Developer Toolbox',
      description: 'Analyze C# classes for Single Responsibility Principle violations with color-coded dependency insights.',
    },
    cta: 'Start Analyzing',
    category: 'Architecture & Analysis',
    icon: 'shears',
    accent: {
      badge: 'from-rose-500 to-pink-600 group-hover:shadow-rose-500/25',
      overlay: 'from-rose-500/0 via-rose-500/0 to-rose-500/5',
      border: 'hover:border-rose-500',
      ring: 'focus:ring-rose-500',
      titleHover: 'group-hover:text-rose-600',
      ctaText: 'text-rose-600',
    },
    loadComponent: () => import('../srp-analyzer/srp-analyzer').then(m => m.SrpAnalyzerComponent),
  },
  {
    path: 'csharp-mindmap',
    title: 'C# Mindmap',
    tagline: 'Interactive History',
    description: 'Explore the evolution of C# language features with an interactive mind map.',
    seo: {
      title: 'C# Version History and Features | .NET Developer Toolbox',
      description: 'Explore the evolution of C# language versions and features through an interactive mind map.',
    },
    cta: 'Start Exploring',
    category: 'Architecture & Analysis',
    icon: 'csharp-box',
    accent: {
      badge: 'from-purple-500 to-indigo-600 group-hover:shadow-purple-500/25',
      overlay: 'from-purple-500/0 via-purple-500/0 to-purple-500/5',
      border: 'hover:border-purple-500',
      ring: 'focus:ring-purple-500',
      titleHover: 'group-hover:text-purple-600',
      ctaText: 'text-purple-600',
    },
    loadComponent: () => import('../csharp-mindmap/csharp-mindmap.component').then(m => m.CsharpMindmapComponent),
  },
  {
    path: 'list-visualizer',
    title: 'List<T> Visualizer',
    tagline: 'Memory & Resizing',
    description: "Visualize memory addresses and dynamic resizing behavior of C#'s List<T>.",
    seo: {
      title: 'C# List<T> Visualizer | .NET Developer Toolbox',
      description: "Visualize C# List<T> memory layout, capacity growth, and dynamic resizing behavior.",
    },
    cta: 'Open Visualizer',
    category: 'Architecture & Analysis',
    icon: 'list',
    accent: {
      badge: 'from-sky-500 to-cyan-600 group-hover:shadow-sky-500/25',
      overlay: 'from-sky-500/0 via-sky-500/0 to-sky-500/5',
      border: 'hover:border-sky-500',
      ring: 'focus:ring-sky-500',
      titleHover: 'group-hover:text-sky-500',
      ctaText: 'text-sky-500',
    },
    loadComponent: () => import('../list-visualizer/list-visualizer').then(m => m.ListVisualizerComponent),
  },
  {
    path: 'span-visualizer',
    title: 'Span<T> Visualizer',
    tagline: 'Memory Slices & Zero Alloc',
    description: 'Visualize how Span<T> creates zero-allocation memory slices and why it beats Substring().',
    seo: {
      title: 'C# Span<T> Visualizer | .NET Developer Toolbox',
      description: 'Visualize how C# Span<T> creates zero-allocation memory slices and compare it with Substring().',
    },
    cta: 'Open Visualizer',
    category: 'Architecture & Analysis',
    icon: 'grid',
    accent: {
      badge: 'from-violet-500 to-purple-600 group-hover:shadow-violet-500/25',
      overlay: 'from-violet-500/0 via-violet-500/0 to-violet-500/5',
      border: 'hover:border-violet-500',
      ring: 'focus:ring-violet-500',
      titleHover: 'group-hover:text-violet-600',
      ctaText: 'text-violet-600',
    },
    loadComponent: () => import('../span-visualizer/span-visualizer').then(m => m.SpanVisualizerComponent),
  },

  // ---- Utilities ----
  {
    path: 'jwt-decoder',
    title: 'JWT Decoder',
    tagline: 'Token Inspector',
    description: 'Decode and inspect JSON Web Tokens with claim explanations and validity checks.',
    seo: {
      title: '.NET JWT Decoder | .NET Developer Toolbox',
      description: 'Decode JSON Web Tokens in your browser, inspect claims, and check token validity without sending data to a server.',
    },
    cta: 'Start Decoding',
    category: 'Utilities',
    icon: 'lock',
    accent: {
      badge: 'from-amber-500 to-orange-600 group-hover:shadow-amber-500/25',
      overlay: 'from-amber-500/0 via-amber-500/0 to-amber-500/5',
      border: 'hover:border-amber-500',
      ring: 'focus:ring-amber-500',
      titleHover: 'group-hover:text-amber-600',
      ctaText: 'text-amber-600',
    },
    loadComponent: () => import('../jwt-decoder/jwt-decoder').then(m => m.JwtDecoderComponent),
  },
  {
    path: 'package-centralizer',
    title: 'Package Centralizer',
    tagline: 'NuGet CPM Tool',
    description: 'Convert .NET projects to Central Package Management with Directory.Packages.props.',
    seo: {
      title: 'Central Package Management Converter | .NET Developer Toolbox',
      description: 'Convert .NET projects to Central Package Management and generate a Directory.Packages.props file.',
    },
    cta: 'Start Centralizing',
    category: 'Utilities',
    icon: 'package',
    accent: {
      badge: 'from-emerald-500 to-teal-600 group-hover:shadow-emerald-500/25',
      overlay: 'from-emerald-500/0 via-emerald-500/0 to-emerald-500/5',
      border: 'hover:border-emerald-500',
      ring: 'focus:ring-emerald-500',
      titleHover: 'group-hover:text-emerald-600',
      ctaText: 'text-emerald-600',
    },
    loadComponent: () => import('../package-centralizer/package-centralizer').then(m => m.PackageCentralizerComponent),
  },
  {
    path: 'regex-tester',
    title: 'Regex Tester',
    tagline: 'Pattern Matching & Codegen',
    description: 'Test .NET regex with live matches and generate source-generated or classic C# code.',
    seo: {
      title: '.NET Regex Tester and C# Generator | .NET Developer Toolbox',
      description: 'Test .NET regular expressions with live match highlighting and generate source-generated or classic C# regex code.',
    },
    cta: 'Start Testing',
    category: 'Utilities',
    icon: 'regex',
    accent: {
      badge: 'from-fuchsia-500 to-pink-600 group-hover:shadow-fuchsia-500/25',
      overlay: 'from-fuchsia-500/0 via-fuchsia-500/0 to-fuchsia-500/5',
      border: 'hover:border-fuchsia-500',
      ring: 'focus:ring-fuchsia-500',
      titleHover: 'group-hover:text-fuchsia-600',
      ctaText: 'text-fuchsia-600',
    },
    loadComponent: () => import('../regex-tester/regex-tester').then(m => m.RegexTesterComponent),
  },
];

export function toolsByCategory(category: ToolCategory): Tool[] {
  return TOOLS.filter(t => t.category === category);
}
