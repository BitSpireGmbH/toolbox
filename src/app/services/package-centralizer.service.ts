import { Injectable } from '@angular/core';

/**
 * Represents a package reference extracted from a csproj file
 */
export interface PackageReference {
  name: string;
  version: string;
  originalLine: string;
  attributes: Map<string, string>; // Non-version attributes like PrivateAssets, IncludeAssets
  childElements: Map<string, string>; // Child elements like <PrivateAssets>all</PrivateAssets>
}

/**
 * Represents a parsed csproj project
 */
export interface ParsedProject {
  name: string;
  content: string;
  packages: PackageReference[];
}

/**
 * Represents the result of centralizing packages
 */
export interface CentralizeResult {
  directoryPackagesProps: string;
  updatedProjects: ParsedProject[];
  packageVersions: Map<string, string>;
  conflicts: VersionConflict[];
}

/**
 * Represents a version conflict between projects
 */
export interface VersionConflict {
  packageName: string;
  versions: { projectName: string; version: string }[];
  resolvedVersion: string;
}

/**
 * Strategy for resolving version conflicts
 */
export type VersionResolutionStrategy = 'highest' | 'lowest' | 'first';

/**
 * Parsed semantic version for comparison
 */
interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
  build: string[];
  original: string;
}

@Injectable({
  providedIn: 'root'
})
export class PackageCentralizerService {
  /**
   * Parse a version string into a SemVer object
   */
  parseVersion(version: string): SemVer {
    const original = version.trim();
    
    // Remove version range brackets if present
    let cleanVersion = original
      .replace(/^\[/, '')
      .replace(/^\(/, '')
      .replace(/\]$/, '')
      .replace(/\)$/, '')
      .split(',')[0] // Take first version from range
      .trim();

    // Handle wildcards
    cleanVersion = cleanVersion.replace(/\*$/, '0');

    // Split build metadata
    const buildParts = cleanVersion.split('+');
    const build = buildParts.length > 1 ? buildParts[1].split('.') : [];
    cleanVersion = buildParts[0];

    // Split prerelease
    const prereleaseParts = cleanVersion.split('-');
    const prerelease = prereleaseParts.length > 1 ? prereleaseParts.slice(1).join('-').split('.') : [];
    cleanVersion = prereleaseParts[0];

    // Parse major.minor.patch
    const versionParts = cleanVersion.split('.');
    const major = parseInt(versionParts[0], 10) || 0;
    const minor = parseInt(versionParts[1], 10) || 0;
    const patch = parseInt(versionParts[2], 10) || 0;

    return { major, minor, patch, prerelease, build, original };
  }

  /**
   * Compare two prerelease arrays
   * Returns: negative if a < b, positive if a > b, 0 if equal
   */
  private comparePrereleases(a: string[], b: string[]): number {
    // No prerelease > has prerelease (1.0.0 > 1.0.0-alpha)
    if (a.length === 0 && b.length > 0) return 1;
    if (a.length > 0 && b.length === 0) return -1;

    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < maxLen; i++) {
      if (i >= a.length) return -1;
      if (i >= b.length) return 1;

      const aPart = a[i];
      const bPart = b[i];

      const aNum = parseInt(aPart, 10);
      const bNum = parseInt(bPart, 10);

      if (!isNaN(aNum) && !isNaN(bNum)) {
        if (aNum !== bNum) return aNum - bNum;
      } else if (!isNaN(aNum)) {
        return -1; // Numbers sort before strings
      } else if (!isNaN(bNum)) {
        return 1;
      } else {
        const cmp = aPart.localeCompare(bPart);
        if (cmp !== 0) return cmp;
      }
    }
    return 0;
  }

  /**
   * Check if two packages have the same attributes and child elements
   */
  private packagesAreEquivalent(pkg1: PackageReference, pkg2: PackageReference): boolean {
    if (pkg1.name !== pkg2.name || pkg1.version !== pkg2.version) {
      return false;
    }

    // Merge attributes and child elements for comparison
    const allAttrs1 = new Map<string, string>();
    for (const [key, value] of pkg1.attributes) {
      allAttrs1.set(key, value);
    }
    for (const [key, value] of pkg1.childElements) {
      allAttrs1.set(key, value);
    }

    const allAttrs2 = new Map<string, string>();
    for (const [key, value] of pkg2.attributes) {
      allAttrs2.set(key, value);
    }
    for (const [key, value] of pkg2.childElements) {
      allAttrs2.set(key, value);
    }

    // Check if both have same attributes
    if (allAttrs1.size !== allAttrs2.size) return false;
    for (const [key, value] of allAttrs1) {
      if (allAttrs2.get(key) !== value) return false;
    }

    return true;
  }

  /**
   * Identify packages that appear in ALL projects with same version and attributes.
   * These packages are candidates for GlobalPackageVersion entries.
   * 
   * @param projects - Array of parsed projects to analyze
   * @returns Set of package names that appear in all projects with identical version and attributes
   */
  identifyGlobalPackages(projects: ParsedProject[]): Set<string> {
    if (projects.length <= 1) {
      return new Set();
    }

    const globalPackages = new Set<string>();
    
    // Get packages from first project
    const firstProject = projects[0];
    
    for (const pkg of firstProject.packages) {
      // Check if this package appears in all other projects with exact same attributes
      const appearsInAll = projects.slice(1).every(project => {
        return project.packages.some(otherPkg => this.packagesAreEquivalent(pkg, otherPkg));
      });
      
      if (appearsInAll) {
        globalPackages.add(pkg.name);
      }
    }
    
    return globalPackages;
  }

  /**
   * Compare two semantic versions
   * Returns: negative if a < b, positive if a > b, 0 if equal
   */
  compareVersions(a: string, b: string): number {
    const verA = this.parseVersion(a);
    const verB = this.parseVersion(b);

    if (verA.major !== verB.major) return verA.major - verB.major;
    if (verA.minor !== verB.minor) return verA.minor - verB.minor;
    if (verA.patch !== verB.patch) return verA.patch - verB.patch;

    return this.comparePrereleases(verA.prerelease, verB.prerelease);
  }

  /**
   * Parse package references from csproj content
   */
  parsePackageReferences(content: string): PackageReference[] {
    const packages: PackageReference[] = [];
    
    // Match PackageReference elements - handles both self-closing and with closing tag
    // Supports: Include="..." Version="..." or Include='...' Version='...'
    const packageRefRegex = /<PackageReference\s+([^>]*(?:Include|Version)[^>]*)(?:\s*\/>|>([\s\S]*?)<\/PackageReference>)/gi;
    
    let match;
    while ((match = packageRefRegex.exec(content)) !== null) {
      const fullMatch = match[0];
      const attributes = match[1];
      const innerContent = match[2] || '';
      
      // Extract Include attribute
      const includeMatch = attributes.match(/Include\s*=\s*["']([^"']+)["']/i);
      // Extract Version attribute
      const versionMatch = attributes.match(/Version\s*=\s*["']([^"']+)["']/i);
      
      if (includeMatch && versionMatch) {
        const packageName = includeMatch[1].trim();
        const version = versionMatch[1].trim();
        
        // Extract all other inline attributes (not Include or Version)
        const attributeMap = new Map<string, string>();
        const attrRegex = /(\w+)\s*=\s*["']([^"']+)["']/gi;
        let attrMatch;
        while ((attrMatch = attrRegex.exec(attributes)) !== null) {
          const attrName = attrMatch[1];
          const attrValue = attrMatch[2];
          if (attrName.toLowerCase() !== 'include' && attrName.toLowerCase() !== 'version') {
            attributeMap.set(attrName, attrValue);
          }
        }
        
        // Extract child elements
        const childElements = new Map<string, string>();
        const childElemRegex = /<(\w+)>([^<]+)<\/\1>/gi;
        let childMatch;
        while ((childMatch = childElemRegex.exec(innerContent)) !== null) {
          childElements.set(childMatch[1], childMatch[2].trim());
        }
        
        packages.push({
          name: packageName,
          version: version,
          originalLine: fullMatch,
          attributes: attributeMap,
          childElements: childElements
        });
      }
    }

    return packages;
  }

  /**
   * Parse multiple projects from input text
   * Format expected:
   * --- ProjectName.csproj ---
   * <Project>...</Project>
   * --- AnotherProject.csproj ---
   * <Project>...</Project>
   */
  parseProjects(input: string): ParsedProject[] {
    const projects: ParsedProject[] = [];
    
    // Split by project delimiter
    const projectDelimiter = /^---\s*(.+\.csproj)\s*---\s*$/gim;
    const parts = input.split(projectDelimiter);
    
    // First part before any delimiter is ignored if empty
    for (let i = 1; i < parts.length; i += 2) {
      const projectName = parts[i].trim();
      const content = parts[i + 1]?.trim() || '';
      
      if (projectName && content) {
        const packages = this.parsePackageReferences(content);
        projects.push({
          name: projectName,
          content,
          packages
        });
      }
    }

    // If no delimiters found, try to parse as single project
    if (projects.length === 0 && input.trim()) {
      const packages = this.parsePackageReferences(input);
      if (packages.length > 0) {
        projects.push({
          name: 'Project.csproj',
          content: input.trim(),
          packages
        });
      }
    }

    return projects;
  }

  /**
   * Resolve version conflicts using the specified strategy
   */
  resolveVersionConflicts(
    projects: ParsedProject[],
    strategy: VersionResolutionStrategy
  ): { packageVersions: Map<string, string>; conflicts: VersionConflict[] } {
    const packageVersions = new Map<string, string>();
    const packageSources = new Map<string, { projectName: string; version: string }[]>();
    const conflicts: VersionConflict[] = [];

    // Collect all versions for each package
    for (const project of projects) {
      for (const pkg of project.packages) {
        const existing = packageSources.get(pkg.name) || [];
        existing.push({ projectName: project.name, version: pkg.version });
        packageSources.set(pkg.name, existing);
      }
    }

    // Resolve each package version
    for (const [packageName, sources] of packageSources) {
      const uniqueVersions = [...new Set(sources.map(s => s.version))];
      
      let resolvedVersion: string;
      
      if (uniqueVersions.length === 1) {
        resolvedVersion = uniqueVersions[0];
      } else {
        // Version conflict - resolve based on strategy
        switch (strategy) {
          case 'highest':
            resolvedVersion = uniqueVersions.reduce((highest, current) => 
              this.compareVersions(current, highest) > 0 ? current : highest
            );
            break;
          case 'lowest':
            resolvedVersion = uniqueVersions.reduce((lowest, current) => 
              this.compareVersions(current, lowest) < 0 ? current : lowest
            );
            break;
          case 'first':
          default:
            resolvedVersion = sources[0].version;
            break;
        }

        conflicts.push({
          packageName,
          versions: sources,
          resolvedVersion
        });
      }

      packageVersions.set(packageName, resolvedVersion);
    }

    return { packageVersions, conflicts };
  }

  /**
   * Generate Directory.Packages.props content, optionally grouped by project
   */
  generateDirectoryPackagesProps(
    packageVersions: Map<string, string>,
    projects: ParsedProject[],
    groupByProject: boolean = true
  ): string {
    let content = `<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
`;

    // Identify global packages
    const globalPackages = this.identifyGlobalPackages(projects);
    
    // Add GlobalPackageReference section if we have global packages
    if (globalPackages.size > 0) {
      const sortedGlobalPackages = Array.from(globalPackages).sort((a, b) => 
        a.toLowerCase().localeCompare(b.toLowerCase())
      );
      
      content += `  <ItemGroup Label="Global">\n`;
      
      for (const packageName of sortedGlobalPackages) {
        const version = packageVersions.get(packageName);
        if (version) {
          // Find the package to get its attributes and child elements
          const pkg = projects[0].packages.find(p => p.name === packageName);
          if (pkg) {
            const hasChildElements = pkg.childElements.size > 0;
            const allAttributes = new Map(pkg.attributes);
            
            if (hasChildElements) {
              // Use multi-line format with child elements
              content += `    <GlobalPackageVersion Include="${packageName}" Version="${version}"`;
              
              // Add inline attributes
              for (const [key, value] of pkg.attributes) {
                content += ` ${key}="${value}"`;
              }
              
              content += `>\n`;
              
              // Add child elements
              for (const [key, value] of pkg.childElements) {
                content += `      <${key}>${value}</${key}>\n`;
              }
              
              content += `    </GlobalPackageVersion>\n`;
            } else {
              // Use single-line format
              content += `    <GlobalPackageVersion Include="${packageName}" Version="${version}"`;
              
              // Add inline attributes (including those from child elements)
              for (const [key, value] of allAttributes) {
                content += ` ${key}="${value}"`;
              }
              
              content += ` />\n`;
            }
          }
        }
      }
      
      content += `  </ItemGroup>\n`;
    }

    // Get non-global packages
    const nonGlobalPackages = new Map<string, string>();
    for (const [pkgName, version] of packageVersions) {
      if (!globalPackages.has(pkgName)) {
        nonGlobalPackages.set(pkgName, version);
      }
    }

    if (groupByProject) {
      // Group packages by project, using resolved versions
      // Only include packages from first occurrence to avoid duplicates
      const packageToFirstProject = new Map<string, string>();
      
      for (const project of projects) {
        for (const pkg of project.packages) {
          if (!globalPackages.has(pkg.name) && !packageToFirstProject.has(pkg.name)) {
            packageToFirstProject.set(pkg.name, project.name);
          }
        }
      }
      
      for (const project of projects) {
        // Get unique package names for this project that appear first in this project
        const projectPackages = project.packages
          .filter(p => !globalPackages.has(p.name) && packageToFirstProject.get(p.name) === project.name)
          .map(p => p.name)
          .filter((name, index, self) => self.indexOf(name) === index)
          .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

        if (projectPackages.length === 0) continue;

        // Extract project label (remove .csproj extension)
        const label = project.name.replace(/\.csproj$/i, '');

        content += `  <ItemGroup Label="${label}">\n`;

        for (const packageName of projectPackages) {
          const version = packageVersions.get(packageName);
          if (version) {
            content += `    <PackageVersion Include="${packageName}" Version="${version}" />\n`;
          }
        }

        content += `  </ItemGroup>\n`;
      }
    } else {
      // Single ItemGroup with all non-global packages sorted alphabetically
      const allPackages = [...nonGlobalPackages.keys()]
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

      if (allPackages.length > 0) {
        content += `  <ItemGroup>\n`;

        for (const packageName of allPackages) {
          const version = nonGlobalPackages.get(packageName);
          if (version) {
            content += `    <PackageVersion Include="${packageName}" Version="${version}" />\n`;
          }
        }

        content += `  </ItemGroup>\n`;
      }
    }

    content += `</Project>`;

    return content;
  }

  /**
   * Update csproj content to remove Version attributes from PackageReference elements
   * and remove entire PackageReference elements for global packages.
   * 
   * @param content - The original csproj file content
   * @param globalPackages - Set of package names that should be completely removed (default: empty set)
   * @returns Updated csproj content with modifications applied
   */
  updateCsprojContent(content: string, globalPackages: Set<string> = new Set()): string {
    // First, remove entire PackageReference elements for global packages
    for (const packageName of globalPackages) {
      // Match both self-closing and regular closing tags
      const escapedName = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const selfClosingRegex = new RegExp(
        `<PackageReference\\s+[^>]*Include\\s*=\\s*["']${escapedName}["'][^>]*\\/>`,
        'gi'
      );
      const regularRegex = new RegExp(
        `<PackageReference\\s+[^>]*Include\\s*=\\s*["']${escapedName}["'][^>]*>[\\s\\S]*?<\\/PackageReference>`,
        'gi'
      );
      
      content = content.replace(selfClosingRegex, '');
      content = content.replace(regularRegex, '');
    }
    
    // Remove Version attribute from remaining PackageReference elements, preserving other attributes
    // Handle self-closing tags
    content = content.replace(
      /<PackageReference\s+([^>]*?)\s*\/>/gi,
      (match, attributes) => {
        // Remove Version attribute while preserving everything else
        const cleanedAttributes = attributes.replace(/\s*Version\s*=\s*["'][^"']*["']/gi, '');
        const trimmed = cleanedAttributes.trim();
        return `<PackageReference ${trimmed} />`;
      }
    );
    
    // Handle opening tags (with closing tag elsewhere)
    content = content.replace(
      /<PackageReference\s+([^>]*?)>/gi,
      (match, attributes) => {
        // Remove Version attribute while preserving everything else
        const cleanedAttributes = attributes.replace(/\s*Version\s*=\s*["'][^"']*["']/gi, '');
        const trimmed = cleanedAttributes.trim();
        return `<PackageReference ${trimmed}>`;
      }
    );
    
    return content;
  }

  /**
   * Main method to centralize packages from multiple projects.
   * 
   * @param input - Raw text input containing one or more csproj files
   * @param strategy - Strategy for resolving version conflicts (default: 'highest')
   * @param groupByProject - Whether to group packages by project in output (default: true)
   * @returns Result containing Directory.Packages.props content, updated projects, and conflict information
   */
  centralize(
    input: string,
    strategy: VersionResolutionStrategy = 'highest',
    groupByProject: boolean = true
  ): CentralizeResult {
    const projects = this.parseProjects(input);
    
    if (projects.length === 0) {
      return {
        directoryPackagesProps: '',
        updatedProjects: [],
        packageVersions: new Map(),
        conflicts: []
      };
    }

    const { packageVersions, conflicts } = this.resolveVersionConflicts(projects, strategy);
    const globalPackages = this.identifyGlobalPackages(projects);
    
    const updatedProjects = projects.map(project => ({
      ...project,
      content: this.updateCsprojContent(project.content, globalPackages)
    }));

    const directoryPackagesProps = this.generateDirectoryPackagesProps(packageVersions, projects, groupByProject);

    return {
      directoryPackagesProps,
      updatedProjects,
      packageVersions,
      conflicts
    };
  }
}
