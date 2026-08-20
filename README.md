# Toolbox

A client-side developer toolkit with utilities for code conversion and middleware design for .NET developers.

Use it at **[toolbox.bitspire.ch](https://toolbox.bitspire.ch)**, or install it from npm and run it on your own machine.

## Install

```bash
npm install -g dotnet-toolbox
dotnet-toolbox
```

That serves the app on <http://localhost:7654> and opens your browser.

The package carries the whole application, including the .NET WebAssembly runtime, so
the command is a static file server over your own disk. Nothing is downloaded when you
run it and nothing you paste into a tool leaves the machine. It needs Node 20.19 or newer,
and no .NET SDK - the runtime it serves is already compiled.

| Flag | Default | |
| --- | --- | --- |
| `--port <number>` | `7654` | Port to listen on |
| `--host <address>` | `127.0.0.1` | Address to bind. Pass `0.0.0.0` to reach it from another device |
| `--no-open` | | Print the URL instead of opening a browser |
| `-v`, `--version` | | Print the version |
| `-h`, `--help` | | Print usage |

The port is part of the origin, and browsers key the offline cache and any installed copy
of the app to an origin - so `--port 8080` gets its own cache and its own install, separate
from the default. Keep `7654` unless something else already has it. If that something else
turns out to be another `dotnet-toolbox`, the command says so and just opens the tab.

Upgrade with `npm install -g dotnet-toolbox@latest`. A tab left open on the old version
notices the new files and offers the usual "reload to update" banner.

## PWA & Offline Support

Toolbox is a full [Progressive Web App](https://web.dev/explore/progressive-web-apps) - install it and use every tool with **no internet connection required**.

- **Installable** - use your browser's "Install app" / "Add to Home Screen" option to run Toolbox in its own window, on desktop or mobile. This works both on the hosted site and on the local `dotnet-toolbox` server, since browsers treat `localhost` as a secure origin.
- **Works fully offline** - all tools run entirely client-side, so once the app has loaded once, it keeps working with no network at all (flight mode, tunnels, flaky wifi, you name it). The npm package goes one step further: the app never has to load from anywhere in the first place.
- **Background update checks** - a service worker periodically checks for new deployed versions. When one is ready, a small "reload to update" banner appears - your current session is never interrupted or reloaded without asking.

## Features

- **JSON to C# Converter** - Convert JSON into C# classes, records, or structs with customizable serialization options. The naming policy is the real `System.Text.Json.JsonNamingPolicy` rather than a reimplementation, so `[JsonPropertyName]` is emitted exactly when it is needed - including under `snake_case` and `kebab-case`, where no reasonable approximation exists. The runtime is only fetched for names it can actually change the answer for, so the everyday payload still converts without downloading it. A round-trip panel runs the payload through the real `JsonDocument`/`Utf8JsonWriter`: the exact `JsonException` line and byte position, what the default encoder does to `+`, `<`, `&` and non-ASCII, and which numbers survive as `decimal` but not as `double` - the last of which JavaScript cannot report at all
- **C# ↔ TypeScript Converter** - Bidirectional conversion between C# classes and TypeScript interfaces or types
- **Middleware Designer** - Visual drag-and-drop builder for ASP.NET Core middleware pipelines with request simulation and code generation
- **ASP.NET Core Response Guide** - Searchable reference of HTTP response scenarios, each shown as both an MVC controller action and a Minimal API `TypedResults` endpoint. Covers the everyday codes (200/201/204/400/401/403/404/409) plus the ones that actually show up in microservice failures: `429` with the `Retry-After` contract, `408`, `502`, `503`, `504`, `507`/`508`, and reference entries for codes you only ever see in logs - nginx `499`, AWS/proxy `599`, and the Cloudflare `520`-`526` family
- **JWT Decoder** - Decode and inspect JSON Web Tokens with claim explanations and validity checks, and verify the signature for real: paste the signing secret and the actual `System.Security.Cryptography` HMAC runs in your browser, so a tampered payload or a wrong secret is proven rather than assumed. `alg: none` is called out as the authentication bypass it is
- **Package Centralizer** - Convert .NET projects to Central Package Management with Directory.Packages.props.
- **C# Mind Map** - A list of all C# versions with their features, including links to the official documentation
- **List<T> Visualizer** - Visualize the internal structure of C# List<T>
- **Span<T> Visualizer** - Visualize the internal structure of C# Span<T> and ReadOnlySpan<T>, with the allocation comparison *measured* rather than asserted: `Substring` vs `AsSpan()` vs `AsSpan().ToString()` are run through the real GC in your browser, so widening the slice visibly grows the string's byte count while the span stays at zero - and materialising a span back to a string costs exactly what `Substring` did
- **SRP Analyzer** - Analyze C# classes for Single Responsibility Principle violations with color-coded dependencies
- **Strong Typer** - Generate C# Options classes from JSON configuration
- **appsettings ↔ Env Vars** - Flatten `appsettings.json` into environment variables (`Foo:Bar` → `Foo__Bar`) and back, with correct quoting for Bash, PowerShell, cmd/setx, and Docker
- **Typed DI Helper** - Generate strongly-typed dependency injection configurations for .NET HttpClient and SignalR with support for resilience and protocols
- **cURL → HttpClient** - Convert any curl command into idiomatic C# HttpClient code (inline, IHttpClientFactory, or typed client) with optional body record generation
- **Regex Tester** - Test .NET regular expressions with live match highlighting and named-group inspection, generating source-generated (`[GeneratedRegex]`, default) or classic `new Regex(...)` C# code
- **Struct Layout** - Paste a C# struct and see where its fields actually land: every offset, the padding between them, and a field order that wastes fewer bytes. The rules are modelled with the pointer size as a parameter and pinned against `Unsafe.SizeOf`/`Unsafe.ByteOffset` on a 64-bit host, so you can ask about x64, ARM64, x86 or wasm32 rather than only about the 32-bit runtime the page happens to be executing on. Most usefully it is honest about the case people get wrong: C# marks every struct `Sequential`, but CoreCLR ignores that the moment the struct holds a GC reference, so `struct S { int Id; string Name; }` puts the pointer at offset 0 and is not the layout the source suggests
- **LINQ Visualizer** - Understand deferred execution by watching it. Build a query from a small palette and see each number travel through it: requests running backwards down the chain, one number passing through every step before the next is fetched, filtered values dropping out, and a plain-English sentence explaining each step as it happens. Shows why nothing runs until you ask, how `First()` stops after three of a thousand items, why one `OrderBy` destroys that saving, and what reusing a query variable costs. Runs on the real `System.Linq`, so the behaviour is .NET's rather than an approximation

## Support & Contributing

Thanks to all [contributors](https://github.com/BitSpireGmbH/toolbox/graphs/contributors) and people that are creating bug-reports and valuable input:

<a href="https://github.com/BitSpireGmbH/toolbox/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=BitSpireGmbH/toolbox" alt="Supporters" />
</a>

## Development

### Prerequisites

Node 22+, plus the .NET SDK pinned in `global.json` and the WebAssembly build tools:

```bash
dotnet workload install wasm-tools
```

Workloads install into the SDK directory, so if the SDK lives somewhere root-owned
(`/usr/local/share/dotnet`, the default for the macOS installer) that command needs
`sudo`. Without the workload, `npm run build:wasm` fails with `NETSDK1147`.

Some tools run the real .NET runtime in the browser rather than approximating it in
TypeScript - the Regex Tester, for instance, matches with the actual
`System.Text.RegularExpressions` so the live preview and the C# it generates are the
same engine. That runtime is built from `dotnet/` and published into the app as a
static asset.

It is downloaded lazily and only once per session, so tools that do not need it stay as
light as they were. Where an approximation would teach something false rather than merely
degraded - LINQ enumeration order, or whether a JWT signature is genuine - the tool has no
JavaScript fallback at all and says the runtime is unavailable instead of guessing.

Use the npm scripts rather than calling `ng` directly: they publish the .NET runtime
first. `ng build` on its own still succeeds without it, but the resulting app quietly
falls back to the browser's own regex engine.

Start the development server:

```bash
npm start
```

Build for production:

```bash
npm run build
```

Run tests - `npm test` covers the Angular app, `npm run test:wasm` covers the .NET
side (the latter needs no browser and is where .NET regex semantics are asserted), and
`npm run test:cli` serves a build through the shipped CLI and checks what comes back:

```bash
npm test
npm run test:wasm
npm run test:cli
```

### Releasing

`package.json` holds the version. `scripts/write-version.mjs` mirrors it into the
generated, committed `src/environments/app-version.ts`, which is what the sidebar
renders - so the version in the app, the version on npm and the git tag are the same
number by construction. `npm run build` regenerates that file, and CI fails if a bump
lands without it.

Releases go through the **Release** workflow. Either run it and pick a bump - it bumps,
commits, tags, pushes, publishes and deploys - or push a `v1.2.3` tag yourself, which
publishes whatever `package.json` already says after checking the two agree. Both paths
publish to npm with provenance and deploy the same build to the hosted site, so the two
channels cannot drift.

What ends up in the tarball is the `files` allowlist in `package.json`: the CLI plus
`dist/toolbox/browser`, minus the `.br`/`.gz` variants and `web.config`, which only the
IIS-hosted deployment can use. `npm run verify:package` asserts the app is really in
there - the build output is gitignored, so it ships only because `files` says so.
