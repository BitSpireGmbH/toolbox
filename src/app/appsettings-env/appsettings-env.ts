import { Component, signal, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AppsettingsEnvConverterService,
  ENV_FORMATS,
  EnvFormat,
  EnvFormatDescriptor,
  FlattenOptions,
  KeyCasing,
  KeySeparator,
  UnflattenOptions,
} from '../services/appsettings-env-converter.service';

type Direction = 'to-env' | 'to-json';

const SAMPLE_APPSETTINGS = `{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "ConnectionStrings": {
    "Default": "Server=db;Database=App;User Id=sa;Password=P@ssw0rd!"
  },
  "AllowedHosts": "*",
  "Serilog": {
    "Using": [ "Serilog.Sinks.Console", "Serilog.Sinks.Seq" ]
  },
  "Feature": {
    "Enabled": true,
    "Retries": 3,
    "Timeout": 2.5
  }
}`;

const SAMPLE_ENV = `Logging__LogLevel__Default=Information
Logging__LogLevel__Microsoft.AspNetCore=Warning
ConnectionStrings__Default=Server=db;Database=App
AllowedHosts=*
Serilog__Using__0=Serilog.Sinks.Console
Serilog__Using__1=Serilog.Sinks.Seq
Feature__Enabled=true
Feature__Retries=3`;

@Component({
  selector: 'app-appsettings-env',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-7xl mx-auto p-6">
      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 mb-1">appsettings.json &harr; Environment Variables</h1>
        <p class="text-sm text-gray-600">
          Flatten a .NET configuration file into environment variables - <code class="font-mono text-gray-800">Foo:Bar</code>
          becomes <code class="font-mono text-gray-800">Foo__Bar</code> - and turn a pasted environment block back into
          nested JSON. Every shell quotes differently, so pick the platform you are actually pasting into.
        </p>
      </div>

      <!-- Direction -->
      <div class="flex flex-wrap items-center gap-2 mb-5">
        <button
          (click)="direction.set('to-env')"
          [class]="direction() === 'to-env' ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'"
          class="px-4 py-2 rounded-lg border font-medium text-sm transition-all cursor-pointer">
          appsettings.json &rarr; Env Vars
        </button>
        <button
          (click)="direction.set('to-json')"
          [class]="direction() === 'to-json' ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'"
          class="px-4 py-2 rounded-lg border font-medium text-sm transition-all cursor-pointer">
          Env Vars &rarr; appsettings.json
        </button>
        <button
          (click)="loadExample()"
          class="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-medium text-sm transition-all cursor-pointer">
          Load example
        </button>
      </div>

      <!-- Options -->
      <div class="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg border border-gray-200 p-5 mb-6">
        <div class="flex flex-wrap items-center gap-x-6 gap-y-4">
          @if (direction() === 'to-env') {
            <div class="flex items-center gap-2">
              <span class="text-xs font-medium text-gray-700">Separator</span>
              <div class="flex rounded-lg border border-gray-300 overflow-hidden">
                <button
                  (click)="separator.set('__')"
                  [class]="separator() === '__' ? 'bg-brand-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
                  class="px-3 py-1.5 text-xs font-mono font-semibold transition-all cursor-pointer">
                  __
                </button>
                <button
                  (click)="separator.set(':')"
                  [class]="separator() === ':' ? 'bg-brand-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
                  class="px-3 py-1.5 text-xs font-mono font-semibold border-l border-gray-300 transition-all cursor-pointer">
                  :
                </button>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <span class="text-xs font-medium text-gray-700">Key casing</span>
              <div class="flex rounded-lg border border-gray-300 overflow-hidden">
                <button
                  (click)="casing.set('preserve')"
                  [class]="casing() === 'preserve' ? 'bg-brand-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
                  class="px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer">
                  Preserve
                </button>
                <button
                  (click)="casing.set('upper')"
                  [class]="casing() === 'upper' ? 'bg-brand-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
                  class="px-3 py-1.5 text-xs font-semibold border-l border-gray-300 transition-all cursor-pointer">
                  UPPERCASE
                </button>
              </div>
            </div>
          }

          <label class="flex items-center gap-2">
            <span class="text-xs font-medium text-gray-700">Prefix</span>
            <input
              [(ngModel)]="prefix"
              type="text"
              spellcheck="false"
              placeholder="MyApp_"
              class="w-28 px-2 py-1.5 text-xs font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary">
          </label>

          @if (direction() === 'to-json') {
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                [checked]="inferTypes()"
                (change)="inferTypes.set($any($event.target).checked)"
                class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-2 focus:ring-brand-primary">
              <span class="text-xs font-medium text-gray-700">Infer numbers, booleans, and null</span>
            </label>

            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                [checked]="mapAzureConnectionStrings()"
                (change)="mapAzureConnectionStrings.set($any($event.target).checked)"
                class="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-2 focus:ring-brand-primary">
              <span class="text-xs font-medium text-gray-700">Map Azure connection-string prefixes</span>
            </label>
          }
        </div>
      </div>

      <!-- Format tabs -->
      @if (direction() === 'to-env') {
        <div class="flex flex-wrap items-center gap-x-5 gap-y-3 mb-5">
          @for (group of formatGroups; track group.name) {
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold uppercase tracking-wide text-gray-400">{{ group.name }}</span>
              <div class="flex flex-wrap gap-1.5">
                @for (option of group.formats; track option.id) {
                  <button
                    (click)="format.set(option.id)"
                    [class]="format() === option.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'"
                    class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer">
                    {{ option.label }}
                  </button>
                }
              </div>
            </div>
          }
        </div>
      }

      <!-- Errors + warnings -->
      @for (error of result().errors; track error) {
        <div class="mb-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {{ error }}
        </div>
      }
      @for (warning of result().warnings; track warning) {
        <div class="mb-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          {{ warning }}
        </div>
      }

      <!-- Input + Output -->
      <div class="grid md:grid-cols-2 gap-5 mb-6">
        <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div class="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
            <h3 class="font-semibold text-sm text-gray-700">
              {{ direction() === 'to-env' ? 'appsettings.json' : 'Environment variables' }}
            </h3>
            <span class="text-xs text-gray-500">
              {{ direction() === 'to-env' ? 'JSON' : 'export / set / setx / $env: / .env / compose' }}
            </span>
          </div>
          @if (direction() === 'to-env') {
            <textarea
              [(ngModel)]="jsonInput"
              spellcheck="false"
              class="w-full h-96 p-4 font-mono text-sm focus:outline-none resize-none bg-gray-50/50"
              placeholder="Paste your appsettings.json here..."
            ></textarea>
          } @else {
            <textarea
              [(ngModel)]="envInput"
              spellcheck="false"
              class="w-full h-96 p-4 font-mono text-sm focus:outline-none resize-none bg-gray-50/50"
              placeholder="Paste an environment block here..."
            ></textarea>
          }
        </div>

        <div class="bg-gray-900 rounded-xl shadow-md border border-gray-700 overflow-hidden">
          <div class="bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-2.5 border-b border-gray-700 flex justify-between items-center">
            <div class="flex items-center gap-2">
              <div class="w-1.5 h-1.5 rounded-full bg-green-500"></div>
              <h3 class="font-semibold text-sm text-gray-200">
                {{ direction() === 'to-env' ? selectedFormat().label : 'appsettings.json' }}
              </h3>
            </div>
            <button
              (click)="copyToClipboard()"
              class="px-3 py-1 rounded-md text-xs font-semibold transition-all text-green-400 hover:bg-green-400/10 cursor-pointer">
              <span class="flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                Copy
              </span>
            </button>
          </div>
          <textarea
            [value]="result().output"
            class="w-full h-96 p-4 font-mono text-sm text-green-400 focus:outline-none resize-none bg-gray-900"
            readonly
          ></textarea>
          @if (direction() === 'to-env') {
            <div class="px-4 py-2.5 border-t border-gray-700 text-xs text-gray-400 leading-relaxed">
              {{ selectedFormat().note }}
            </div>
          }
        </div>
      </div>

      <!-- Platform notes -->
      <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div class="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2.5 border-b border-gray-200">
          <h2 class="font-semibold text-sm text-gray-700">Windows vs. Linux, macOS, and containers</h2>
        </div>
        <div class="p-5 text-sm text-gray-700 leading-relaxed space-y-3">
          <p>
            .NET addresses nested configuration with a colon:
            <code class="font-mono text-gray-900">Logging:LogLevel:Default</code>. That works as an environment
            variable name on Windows only. POSIX shells cannot declare an identifier containing a colon at all -
            <code class="font-mono text-gray-900">export Logging:LogLevel:Default=Trace</code> is a syntax error,
            not a configuration bug. .NET therefore accepts a double underscore everywhere and translates
            <code class="font-mono text-gray-900">Logging__LogLevel__Default</code> back into the colon form, which
            is why <code class="font-mono text-gray-900">__</code> is the default here.
          </p>
          <p>
            Arrays use their index as a segment, so
            <code class="font-mono text-gray-900">Serilog:Using:0</code> becomes
            <code class="font-mono text-gray-900">Serilog__Using__0</code>. Indexes have to start at 0 and stay
            consecutive, otherwise the configuration binder treats the section as an object instead of a list.
          </p>
          <p>
            Variable <em>names</em> are case-insensitive on Windows and case-sensitive to the OS on Linux and macOS.
            .NET's own configuration lookup is case-insensitive once the values are loaded, so
            <code class="font-mono text-gray-900">FEATURE__ENABLED</code> and
            <code class="font-mono text-gray-900">Feature__Enabled</code> both bind - but two variables that differ
            only in case will collide on Windows.
          </p>
          <p>
            Persistence differs per shell. <code class="font-mono text-gray-900">export</code> and
            <code class="font-mono text-gray-900">$env:</code> last for the current session;
            <code class="font-mono text-gray-900">set</code> lasts for the current console window;
            <code class="font-mono text-gray-900">setx</code> is permanent but silently truncates values at 1024
            characters and does not affect the window you run it in. A <code class="font-mono text-gray-900">.env</code>
            file is read by Docker Compose rather than a shell, so nothing in it is expanded or word-split.
          </p>
          <p>
            Azure App Service prefixes connection strings with
            <code class="font-mono text-gray-900">SQLCONNSTR_</code>,
            <code class="font-mono text-gray-900">MYSQLCONNSTR_</code>,
            <code class="font-mono text-gray-900">SQLAZURECONNSTR_</code>, or
            <code class="font-mono text-gray-900">CUSTOMCONNSTR_</code>, and surfaces them to .NET under
            <code class="font-mono text-gray-900">ConnectionStrings:</code>. Turn on the Azure mapping when importing
            a block copied out of the portal.
          </p>
          <p>
            Everything runs in your browser - no configuration value, connection string, or password ever leaves
            this page.
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [],
})
export class AppsettingsEnvComponent {
  private readonly converter = inject(AppsettingsEnvConverterService);

  protected readonly direction = signal<Direction>('to-env');
  protected readonly jsonInput = signal<string>(SAMPLE_APPSETTINGS);
  protected readonly envInput = signal<string>(SAMPLE_ENV);

  protected readonly format = signal<EnvFormat>('bash');
  protected readonly separator = signal<KeySeparator>('__');
  protected readonly casing = signal<KeyCasing>('preserve');
  protected readonly prefix = signal<string>('');
  protected readonly inferTypes = signal<boolean>(true);
  protected readonly mapAzureConnectionStrings = signal<boolean>(false);

  protected readonly formatGroups = this.groupFormats();

  private readonly flattenOptions = computed<FlattenOptions>(() => ({
    separator: this.separator(),
    casing: this.casing(),
    prefix: this.prefix(),
  }));

  private readonly unflattenOptions = computed<UnflattenOptions>(() => ({
    prefix: this.prefix(),
    inferTypes: this.inferTypes(),
    mapAzureConnectionStrings: this.mapAzureConnectionStrings(),
  }));

  protected readonly result = computed(() =>
    this.direction() === 'to-env'
      ? this.converter.toEnvironmentVariables(this.jsonInput(), this.format(), this.flattenOptions())
      : this.converter.toAppSettings(this.envInput(), this.unflattenOptions())
  );

  protected readonly selectedFormat = computed<EnvFormatDescriptor>(
    () => ENV_FORMATS.find(entry => entry.id === this.format()) ?? ENV_FORMATS[0]
  );

  protected loadExample(): void {
    if (this.direction() === 'to-env') {
      this.jsonInput.set(SAMPLE_APPSETTINGS);
    } else {
      this.envInput.set(SAMPLE_ENV);
    }
  }

  protected async copyToClipboard(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.result().output);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }

  private groupFormats(): { name: string; formats: EnvFormatDescriptor[] }[] {
    const groups: { name: string; formats: EnvFormatDescriptor[] }[] = [];
    for (const descriptor of ENV_FORMATS) {
      const existing = groups.find(group => group.name === descriptor.group);
      if (existing) {
        existing.formats.push(descriptor);
      } else {
        groups.push({ name: descriptor.group, formats: [descriptor] });
      }
    }
    return groups;
  }
}
