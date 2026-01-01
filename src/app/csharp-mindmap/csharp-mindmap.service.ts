import { Injectable, inject } from '@angular/core';
import { CSHARP_VERSION_TOKEN } from './csharp-version.token';
import type { CSharpLanguageData, CSharpVersion } from './csharp-version.model';
import { ALL_CSHARP_VERSIONS, CSHARP_FOUNDATION } from './csharp-versions.data';

/**
 * Service that provides C# language version data for the mindmap.
 * 
 * This service follows the Open/Closed Principle (OCP):
 * - It's open for extension (new versions can be added via the CSHARP_VERSION_TOKEN)
 * - It's closed for modification (core logic doesn't need to change for new versions)
 * 
 * To add a new C# version:
 * 1. Create the version data following the CSharpVersion interface
 * 2. Either add it to ALL_CSHARP_VERSIONS in csharp-versions.data.ts
 * 3. Or provide it via CSHARP_VERSION_TOKEN in your app configuration
 */
@Injectable({
  providedIn: 'root'
})
export class CSharpMindmapService {
  // Injected versions from external providers (allows plugin-like extensibility)
  private readonly injectedVersions = inject(CSHARP_VERSION_TOKEN, { optional: true }) as CSharpVersion[] | null;

  /**
   * Gets the complete C# language data including all versions and foundations.
   */
  getLanguageData(): CSharpLanguageData {
    return {
      foundation: CSHARP_FOUNDATION,
      versions: this.getAllVersions()
    };
  }

  /**
   * Gets all C# versions, merging built-in versions with any injected versions.
   * Versions are sorted by version number.
   */
  getAllVersions(): readonly CSharpVersion[] {
    const allVersions = [...ALL_CSHARP_VERSIONS];

    // Merge any dynamically injected versions
    if (this.injectedVersions) {
      const injectedArray = Array.isArray(this.injectedVersions)
        ? this.injectedVersions
        : [this.injectedVersions];

      for (const version of injectedArray) {
        // Check if version already exists (avoid duplicates)
        if (!allVersions.some(v => v.version === version.version)) {
          allVersions.push(version);
        }
      }
    }

    // Sort by version number
    return allVersions.sort((a, b) => {
      const versionA = parseFloat(a.version);
      const versionB = parseFloat(b.version);
      return versionA - versionB;
    });
  }

  /**
   * Gets a specific C# version by its version string.
   */
  getVersion(version: string): CSharpVersion | undefined {
    return this.getAllVersions().find(v => v.version === version);
  }

  /**
   * Gets versions grouped by major release era for visual organization.
   */
  getVersionsByEra(): { era: string; versions: CSharpVersion[] }[] {
    const versions = this.getAllVersions();

    return [
      {
        era: 'Classic Era (2.0 - 5.0)',
        versions: versions.filter(v => {
          const num = parseFloat(v.version);
          return num >= 2 && num < 6;
        })
      },
      {
        era: 'Roslyn Era (6.0 - 7.x)',
        versions: versions.filter(v => {
          const num = parseFloat(v.version);
          return num >= 6 && num < 8;
        })
      },
      {
        era: '.NET Core Era (8.0 - 9.0)',
        versions: versions.filter(v => {
          const num = parseFloat(v.version);
          return num >= 8 && num < 10;
        })
      },
      {
        era: 'Modern .NET Era (10.0+)',
        versions: versions.filter(v => {
          const num = parseFloat(v.version);
          return num >= 10;
        })
      }
    ];
  }
}
