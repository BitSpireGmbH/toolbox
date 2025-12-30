import { Injectable } from '@angular/core';

/**
 * Represents a package reference extracted from a csproj file
 */
export interface PackageReference {
  name: string;
  version: string;
  originalLine: string;
  privateAssets?: string;
  includeAssets?: string;
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
   * Check if a package is an analyzer based on its PrivateAssets and IncludeAssets
   */
  isAnalyzer(pkg: PackageReference): boolean {
    // An analyzer typically has PrivateAssets="all" and IncludeAssets containing "analyzers"
    const hasPrivateAssets = pkg.privateAssets?.toLowerCase() === 'all';
    const hasAnalyzersInIncludeAssets = pkg.includeAssets?.toLowerCase().includes('analyzers') || false;
    
    return hasPrivateAssets && hasAnalyzersInIncludeAssets;
  }

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
        const pkg: PackageReference = {
          name: includeMatch[1].trim(),
          version: versionMatch[1].trim(),
          originalLine: fullMatch
        };

        // Extract PrivateAssets from attributes or inner content
        const privateAssetsAttrMatch = attributes.match(/PrivateAssets\s*=\s*["']([^"']+)["']/i);
        const privateAssetsInnerMatch = innerContent.match(/<PrivateAssets>([^<]+)<\/PrivateAssets>/i);
        if (privateAssetsAttrMatch) {
          pkg.privateAssets = privateAssetsAttrMatch[1].trim();
        } else if (privateAssetsInnerMatch) {
          pkg.privateAssets = privateAssetsInnerMatch[1].trim();
        }

        // Extract IncludeAssets from attributes or inner content
        const includeAssetsAttrMatch = attributes.match(/IncludeAssets\s*=\s*["']([^"']+)["']/i);
        const includeAssetsInnerMatch = innerContent.match(/<IncludeAssets>([^<]+)<\/IncludeAssets>/i);
        if (includeAssetsAttrMatch) {
          pkg.includeAssets = includeAssetsAttrMatch[1].trim();
        } else if (includeAssetsInnerMatch) {
          pkg.includeAssets = includeAssetsInnerMatch[1].trim();
        }

        packages.push(pkg);
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
    groupByProject: boolean = true,
    useGlobalAnalyzers: boolean = false
  ): string {
    let content = `<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
`;

    // Build a map of package name to list of projects and their package details
    const packageToProjects = new Map<string, { project: ParsedProject; pkg: PackageReference }[]>();
    for (const project of projects) {
      for (const pkg of project.packages) {
        const existing = packageToProjects.get(pkg.name) || [];
        existing.push({ project, pkg });
        packageToProjects.set(pkg.name, existing);
      }
    }

    // If using global analyzers, identify multi-project analyzers
    const globalAnalyzers = new Set<string>();
    if (useGlobalAnalyzers) {
      for (const [packageName, projectPkgs] of packageToProjects) {
        // Check if used in multiple projects and is an analyzer
        if (projectPkgs.length > 1 && this.isAnalyzer(projectPkgs[0].pkg)) {
          globalAnalyzers.add(packageName);
        }
      }

      // Add GlobalPackageReference section if there are any
      if (globalAnalyzers.size > 0) {
        content += `  <ItemGroup Label="Global Packages">\n`;
        
        const sortedGlobalAnalyzers = [...globalAnalyzers].sort((a, b) => 
          a.toLowerCase().localeCompare(b.toLowerCase())
        );
        
        for (const packageName of sortedGlobalAnalyzers) {
          const projectPkgs = packageToProjects.get(packageName)!;
          const pkg = projectPkgs[0].pkg;
          
          // Format IncludeAssets (capitalize first letter of each part)
          const includeAssets = pkg.includeAssets
            ?.split(';')
            .map(part => {
              const trimmed = part.trim();
              return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
            })
            .join(';') || 'Runtime;Build;Native;contentFiles;Analyzers';
          
          content += `    <GlobalPackageReference Include="${packageName}" PrivateAssets="All" IncludeAssets="${includeAssets}" />\n`;
        }
        
        content += `  </ItemGroup>\n`;
      }
    }

    if (groupByProject) {
      // Group packages by project, using resolved versions
      for (const project of projects) {
        // Get unique package names for this project, sorted alphabetically
        // Exclude global analyzers from individual project groups
        const projectPackages = [...new Set(project.packages.map(p => p.name))]
          .filter(pkgName => !globalAnalyzers.has(pkgName))
          .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

        if (projectPackages.length === 0) continue;

        // Extract project label (remove .csproj extension)
        const label = project.name.replace(/\.csproj$/i, '');

        content += `  <ItemGroup Label="${label}">\n`;

        for (const packageName of projectPackages) {
          const version = packageVersions.get(packageName);
          if (version) {
            // Check if this is an analyzer used in a single project
            const projectPkgs = packageToProjects.get(packageName);
            const isSingleProjectAnalyzer = projectPkgs && projectPkgs.length === 1 && 
              this.isAnalyzer(projectPkgs[0].pkg) && useGlobalAnalyzers;
            
            if (isSingleProjectAnalyzer) {
              content += `    <PackageVersion Include="${packageName}" Version="$(GlobalAnalyzerPackageVersion)" />\n`;
            } else {
              content += `    <PackageVersion Include="${packageName}" Version="${version}" />\n`;
            }
          }
        }

        content += `  </ItemGroup>\n`;
      }
    } else {
      // Single ItemGroup with all packages sorted alphabetically
      // Exclude global analyzers
      const allPackages = [...packageVersions.keys()]
        .filter(pkgName => !globalAnalyzers.has(pkgName))
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

      if (allPackages.length > 0) {
        content += `  <ItemGroup>\n`;

        for (const packageName of allPackages) {
          const version = packageVersions.get(packageName);
          if (version) {
            // Check if this is an analyzer used in a single project
            const projectPkgs = packageToProjects.get(packageName);
            const isSingleProjectAnalyzer = projectPkgs && projectPkgs.length === 1 && 
              this.isAnalyzer(projectPkgs[0].pkg) && useGlobalAnalyzers;
            
            if (isSingleProjectAnalyzer) {
              content += `    <PackageVersion Include="${packageName}" Version="$(GlobalAnalyzerPackageVersion)" />\n`;
            } else {
              content += `    <PackageVersion Include="${packageName}" Version="${version}" />\n`;
            }
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
   */
  updateCsprojContent(content: string): string {
    // Replace PackageReference elements by removing Version attribute
    return content.replace(
      /<PackageReference\s+([^>]*?)Version\s*=\s*["'][^"']*["']\s*([^>]*?)\s*\/>/gi,
      (match, before, after) => {
        const cleanBefore = before.trim();
        const cleanAfter = after.trim();
        const attributes = [cleanBefore, cleanAfter].filter(a => a).join(' ');
        return `<PackageReference ${attributes} />`;
      }
    ).replace(
      /<PackageReference\s+([^>]*?)Version\s*=\s*["'][^"']*["']\s*([^>]*?)>/gi,
      (match, before, after) => {
        const cleanBefore = before.trim();
        const cleanAfter = after.trim();
        const attributes = [cleanBefore, cleanAfter].filter(a => a).join(' ');
        return `<PackageReference ${attributes}>`;
      }
    );
  }

  /**
   * Main method to centralize packages from multiple projects
   */
  centralize(
    input: string,
    strategy: VersionResolutionStrategy = 'highest',
    groupByProject: boolean = true,
    useGlobalAnalyzers: boolean = false
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
    
    const updatedProjects = projects.map(project => ({
      ...project,
      content: this.updateCsprojContent(project.content)
    }));

    const directoryPackagesProps = this.generateDirectoryPackagesProps(
      packageVersions, 
      projects,
      groupByProject,
      useGlobalAnalyzers
    );

    return {
      directoryPackagesProps,
      updatedProjects,
      packageVersions,
      conflicts
    };
  }
}
