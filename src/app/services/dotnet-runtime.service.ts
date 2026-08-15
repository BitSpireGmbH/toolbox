import { DOCUMENT, Injectable, inject, signal } from '@angular/core';

/**
 * `idle` before anything asks for the runtime, `failed` if it could not be
 * downloaded or started. Tools use this to decide between the real .NET engine and
 * their JavaScript fallback, and to tell the user which one they are looking at.
 */
export type DotnetRuntimeStatus = 'idle' | 'loading' | 'ready' | 'failed';

/**
 * The methods `[JSExport]` publishes, reached by namespace and class name. Mirrors
 * `dotnet/Toolbox.Wasm/RegexInterop.cs`, `LinqInterop.cs` and `CryptoInterop.cs` - every
 * value is a JSON string, because JSImport/JSExport cannot marshal complex objects.
 *
 * Hand-maintained, so it has to be updated in lockstep with the C# side: a method
 * declared here but missing there fails at the call, not at build time.
 */
export interface ToolboxWasmExports {
  readonly Toolbox: {
    readonly Wasm: {
      readonly RegexInterop: {
        Evaluate(pattern: string, testInput: string, optionsJson: string): string;
        Replace(
          pattern: string,
          testInput: string,
          replacement: string,
          optionsJson: string
        ): string;
      };
      readonly LinqInterop: {
        Run(specJson: string): string;
        GetCatalog(): string;
      };
      readonly CryptoInterop: {
        VerifyJwt(requestJson: string): string;
      };
      readonly DiagnosticsInterop: {
        MeasureSlice(requestJson: string): string;
      };
      readonly RuntimeInterop: {
        GetFrameworkDescription(): string;
      };
    };
  };
}

/**
 * The part of {@link DotnetRuntimeService} that {@link invokeWasm} needs. Structural on
 * purpose: the tool specs fake the runtime with a plain object, and widening this to the
 * whole class would force every one of them to grow a stub for machinery they do not use.
 */
export interface WasmRuntimeLoader {
  load(): Promise<ToolboxWasmExports>;
}

/**
 * Every .NET-backed tool does the same three things: wait for the runtime, call one
 * `[JSExport]`, and parse the JSON that comes back - because JSImport/JSExport cannot
 * marshal complex objects, so the boundary is always string-shaped.
 *
 * Taking a callback over the `Wasm` namespace rather than a method name keeps that fully
 * typed: calling an export that is not declared in {@link ToolboxWasmExports} fails to
 * compile here, rather than failing at the call the way a string lookup would.
 *
 * A free function rather than a method on the service, so that a spec faking `load()`
 * still runs this real marshalling. Stubbing it per-service would leave the
 * `JSON.stringify`/`JSON.parse` round trip - the only thing these thin services actually
 * do - untested.
 *
 * Errors are deliberately not caught. A throw means the runtime itself is unavailable,
 * and each tool decides for itself whether that means a fallback or refusing to answer;
 * swallowing it here would take that choice away.
 */
export async function invokeWasm<T>(
  runtime: WasmRuntimeLoader,
  call: (wasm: ToolboxWasmExports['Toolbox']['Wasm']) => string
): Promise<T> {
  const exports = await runtime.load();
  return JSON.parse(call(exports.Toolbox.Wasm)) as T;
}

interface DotnetRuntimeApi {
  getAssemblyExports(assemblyName: string): Promise<ToolboxWasmExports>;
  getConfig(): { mainAssemblyName?: string };
}

interface DotnetHostBuilder {
  create(): Promise<DotnetRuntimeApi>;
}

/** Where `npm run build:wasm` publishes, relative to the app's base href. */
const RUNTIME_PATH = 'dotnet/_framework/dotnet.js';

/**
 * Loads the .NET WebAssembly runtime on demand, exactly once per session.
 *
 * The runtime is multiple megabytes, so nothing here runs until a tool actually
 * asks for it - which is why the landing page and every non-.NET tool stay as light
 * as they were before.
 */
@Injectable({ providedIn: 'root' })
export class DotnetRuntimeService {
  private readonly document = inject(DOCUMENT);

  private readonly currentStatus = signal<DotnetRuntimeStatus>('idle');
  readonly status = this.currentStatus.asReadonly();

  /**
   * Retained so a failed load can be reported rather than just silently downgrading
   * the user to the approximate engine.
   */
  private readonly currentFailure = signal<string | null>(null);
  readonly failure = this.currentFailure.asReadonly();

  /**
   * What the runtime says about itself once it is up, e.g. `.NET 10.0.3`. Reported
   * by the runtime rather than baked in at build time, so it cannot claim a version
   * that is not actually executing.
   */
  private readonly currentFramework = signal<string | null>(null);
  readonly frameworkDescription = this.currentFramework.asReadonly();

  /**
   * Cached so that concurrent callers - and every later keystroke - share one
   * download. A rejected promise is discarded so a transient network failure can be
   * retried rather than poisoning the session.
   */
  private pending: Promise<ToolboxWasmExports> | null = null;

  load(): Promise<ToolboxWasmExports> {
    this.pending ??= this.start().catch((error: unknown) => {
      this.pending = null;
      throw error;
    });
    return this.pending;
  }

  private async start(): Promise<ToolboxWasmExports> {
    this.currentStatus.set('loading');
    this.currentFailure.set(null);

    try {
      // Resolved at runtime on purpose. A literal specifier would be rewritten by
      // the bundler, which would try to inline a file that is only ever a copied
      // build artifact; going through baseURI also keeps this correct under a
      // non-root base href.
      const runtimeUrl = new URL(RUNTIME_PATH, this.document.baseURI).href;
      const module = (await import(/* @vite-ignore */ runtimeUrl)) as {
        dotnet: DotnetHostBuilder;
      };

      const runtime = await module.dotnet.create();
      const mainAssemblyName = runtime.getConfig().mainAssemblyName;
      if (!mainAssemblyName) {
        throw new Error('The .NET runtime started but reported no main assembly.');
      }

      // Program.Main is deliberately not run: the tools only need the [JSExport]
      // surface, and skipping it saves a round trip through the runtime.
      const exports = await runtime.getAssemblyExports(mainAssemblyName);

      this.currentFramework.set(exports.Toolbox.Wasm.RuntimeInterop.GetFrameworkDescription());
      this.currentStatus.set('ready');
      return exports;
    } catch (error) {
      this.currentStatus.set('failed');
      this.currentFailure.set(
        error instanceof Error ? error.message : 'The .NET runtime could not be loaded.'
      );
      throw error;
    }
  }
}
