# Toolbox

A client-side developer toolkit with utilities for code conversion and middleware design for .NET developers.

## PWA & Offline Support

Toolbox is a full [Progressive Web App](https://web.dev/explore/progressive-web-apps) - install it and use every tool with **no internet connection required**.

- **Installable** - use your browser's "Install app" / "Add to Home Screen" option to run Toolbox in its own window, on desktop or mobile.
- **Works fully offline** - all tools run entirely client-side, so once the app has loaded once, it keeps working with no network at all (flight mode, tunnels, flaky wifi, you name it).
- **Background update checks** - a service worker periodically checks for new deployed versions. When one is ready, a small "reload to update" banner appears - your current session is never interrupted or reloaded without asking.

## Features

- **JSON to C# Converter** - Convert JSON into C# classes, records, or structs with customizable serialization options
- **C# ↔ TypeScript Converter** - Bidirectional conversion between C# classes and TypeScript interfaces or types
- **Middleware Designer** - Visual drag-and-drop builder for ASP.NET Core middleware pipelines with request simulation and code generation
- **ASP.NET Core Response Guide** - Searchable reference of HTTP response scenarios, each shown as both an MVC controller action and a Minimal API `TypedResults` endpoint. Covers the everyday codes (200/201/204/400/401/403/404/409) plus the ones that actually show up in microservice failures: `429` with the `Retry-After` contract, `408`, `502`, `503`, `504`, `507`/`508`, and reference entries for codes you only ever see in logs - nginx `499`, AWS/proxy `599`, and the Cloudflare `520`-`526` family
- **JWT Decoder** - Decode and inspect JSON Web Tokens with claim explanations and validity checks.
- **Package Centralizer** - Convert .NET projects to Central Package Management with Directory.Packages.props.
- **C# Mind Map** - A list of all C# versions with their features, including links to the official documentation
- **List<T> Visualizer** - Visualize the internal structure of C# List<T>
- **Span<T> Visualizer** - Visualize the internal structure of C# Span<T>
- **SRP Analyzer** - Analyze C# classes for Single Responsibility Principle violations with color-coded dependencies
- **Strong Typer** - Generate C# Options classes from JSON configuration
- **appsettings ↔ Env Vars** - Flatten `appsettings.json` into environment variables (`Foo:Bar` → `Foo__Bar`) and back, with correct quoting for Bash, PowerShell, cmd/setx, and Docker
- **Typed DI Helper** - Generate strongly-typed dependency injection configurations for .NET HttpClient and SignalR with support for resilience and protocols
- **cURL → HttpClient** - Convert any curl command into idiomatic C# HttpClient code (inline, IHttpClientFactory, or typed client) with optional body record generation
- **Regex Tester** - Test .NET regular expressions with live match highlighting and named-group inspection, generating source-generated (`[GeneratedRegex]`, default) or classic `new Regex(...)` C# code

## Support & Contributing

Thanks to all [contributors](https://github.com/BitSpireGmbH/toolbox/graphs/contributors) and people that are creating bug-reports and valuable input:

<a href="https://github.com/BitSpireGmbH/toolbox/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=BitSpireGmbH/toolbox" alt="Supporters" />
</a>

## Development

Start the development server:

```bash
ng serve
```

Build for production:

```bash
ng build
```

Run tests:

```bash
ng test
```
