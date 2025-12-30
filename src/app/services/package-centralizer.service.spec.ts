import { describe, it, expect, beforeEach } from 'vitest';
import { PackageCentralizerService, PackageReference } from './package-centralizer.service';

describe('PackageCentralizerService', () => {
  let service: PackageCentralizerService;

  beforeEach(() => {
    service = new PackageCentralizerService();
  });

  describe('parseVersion', () => {
    it('should parse simple version', () => {
      const result = service.parseVersion('1.2.3');
      expect(result.major).toBe(1);
      expect(result.minor).toBe(2);
      expect(result.patch).toBe(3);
      expect(result.prerelease).toEqual([]);
      expect(result.build).toEqual([]);
    });

    it('should parse version with prerelease', () => {
      const result = service.parseVersion('1.0.0-alpha.1');
      expect(result.major).toBe(1);
      expect(result.minor).toBe(0);
      expect(result.patch).toBe(0);
      expect(result.prerelease).toEqual(['alpha', '1']);
    });

    it('should parse version with build metadata', () => {
      const result = service.parseVersion('1.0.0+build.123');
      expect(result.major).toBe(1);
      expect(result.build).toEqual(['build', '123']);
    });

    it('should parse version with both prerelease and build', () => {
      const result = service.parseVersion('2.0.0-beta.2+build.456');
      expect(result.major).toBe(2);
      expect(result.prerelease).toEqual(['beta', '2']);
      expect(result.build).toEqual(['build', '456']);
    });

    it('should handle version ranges by taking first version', () => {
      const result = service.parseVersion('[1.0.0, 2.0.0)');
      expect(result.major).toBe(1);
      expect(result.minor).toBe(0);
      expect(result.patch).toBe(0);
    });

    it('should handle two-part versions', () => {
      const result = service.parseVersion('1.5');
      expect(result.major).toBe(1);
      expect(result.minor).toBe(5);
      expect(result.patch).toBe(0);
    });

    it('should handle wildcards', () => {
      const result = service.parseVersion('1.0.*');
      expect(result.major).toBe(1);
      expect(result.minor).toBe(0);
      expect(result.patch).toBe(0);
    });
  });

  describe('compareVersions', () => {
    it('should return positive when first version is higher (major)', () => {
      expect(service.compareVersions('2.0.0', '1.0.0')).toBeGreaterThan(0);
    });

    it('should return negative when first version is lower (major)', () => {
      expect(service.compareVersions('1.0.0', '2.0.0')).toBeLessThan(0);
    });

    it('should return positive when first version is higher (minor)', () => {
      expect(service.compareVersions('1.2.0', '1.1.0')).toBeGreaterThan(0);
    });

    it('should return positive when first version is higher (patch)', () => {
      expect(service.compareVersions('1.0.2', '1.0.1')).toBeGreaterThan(0);
    });

    it('should return 0 for equal versions', () => {
      expect(service.compareVersions('1.2.3', '1.2.3')).toBe(0);
    });

    it('should handle prerelease versions (stable > prerelease)', () => {
      expect(service.compareVersions('1.0.0', '1.0.0-alpha')).toBeGreaterThan(0);
    });

    it('should compare prerelease versions correctly', () => {
      expect(service.compareVersions('1.0.0-beta', '1.0.0-alpha')).toBeGreaterThan(0);
    });

    it('should compare numeric prerelease identifiers', () => {
      expect(service.compareVersions('1.0.0-alpha.2', '1.0.0-alpha.1')).toBeGreaterThan(0);
    });

    it('should compare prerelease with different lengths', () => {
      expect(service.compareVersions('1.0.0-alpha.1', '1.0.0-alpha')).toBeGreaterThan(0);
    });
  });

  describe('parsePackageReferences', () => {
    it('should parse self-closing PackageReference elements', () => {
      const content = `
        <ItemGroup>
          <PackageReference Include="Newtonsoft.Json" Version="13.0.1" />
        </ItemGroup>
      `;
      const result = service.parsePackageReferences(content);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Newtonsoft.Json');
      expect(result[0].version).toBe('13.0.1');
    });

    it('should parse multiple PackageReference elements', () => {
      const content = `
        <ItemGroup>
          <PackageReference Include="PackageA" Version="1.0.0" />
          <PackageReference Include="PackageB" Version="2.0.0" />
          <PackageReference Include="PackageC" Version="3.0.0" />
        </ItemGroup>
      `;
      const result = service.parsePackageReferences(content);
      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('PackageA');
      expect(result[1].name).toBe('PackageB');
      expect(result[2].name).toBe('PackageC');
    });

    it('should handle Version before Include attribute', () => {
      const content = `<PackageReference Version="1.0.0" Include="MyPackage" />`;
      const result = service.parsePackageReferences(content);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('MyPackage');
      expect(result[0].version).toBe('1.0.0');
    });

    it('should handle single quotes in attributes', () => {
      const content = `<PackageReference Include='TestPackage' Version='2.5.0' />`;
      const result = service.parsePackageReferences(content);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('TestPackage');
      expect(result[0].version).toBe('2.5.0');
    });

    it('should ignore PackageReference without Version attribute', () => {
      const content = `
        <PackageReference Include="WithVersion" Version="1.0.0" />
        <PackageReference Include="WithoutVersion" />
      `;
      const result = service.parsePackageReferences(content);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('WithVersion');
    });

    it('should handle PackageReference with closing tag', () => {
      const content = `
        <PackageReference Include="PackageWithBody" Version="1.0.0">
          <PrivateAssets>all</PrivateAssets>
        </PackageReference>
      `;
      const result = service.parsePackageReferences(content);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('PackageWithBody');
      expect(result[0].version).toBe('1.0.0');
    });

    it('should return empty array for content without packages', () => {
      const content = `
        <Project Sdk="Microsoft.NET.Sdk">
          <PropertyGroup>
            <TargetFramework>net8.0</TargetFramework>
          </PropertyGroup>
        </Project>
      `;
      const result = service.parsePackageReferences(content);
      expect(result).toHaveLength(0);
    });
  });

  describe('parseProjects', () => {
    it('should parse single project with delimiter', () => {
      const input = `--- MyProject.csproj ---
<Project>
  <ItemGroup>
    <PackageReference Include="TestPackage" Version="1.0.0" />
  </ItemGroup>
</Project>`;
      const result = service.parseProjects(input);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('MyProject.csproj');
      expect(result[0].packages).toHaveLength(1);
    });

    it('should parse multiple projects', () => {
      const input = `--- Project1.csproj ---
<Project>
  <ItemGroup>
    <PackageReference Include="Package1" Version="1.0.0" />
  </ItemGroup>
</Project>

--- Project2.csproj ---
<Project>
  <ItemGroup>
    <PackageReference Include="Package2" Version="2.0.0" />
  </ItemGroup>
</Project>`;
      const result = service.parseProjects(input);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Project1.csproj');
      expect(result[1].name).toBe('Project2.csproj');
    });

    it('should handle input without delimiters as single project', () => {
      const input = `<Project>
  <ItemGroup>
    <PackageReference Include="SomePackage" Version="1.0.0" />
  </ItemGroup>
</Project>`;
      const result = service.parseProjects(input);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Project.csproj');
      expect(result[0].packages).toHaveLength(1);
    });

    it('should return empty array for empty input', () => {
      const result = service.parseProjects('');
      expect(result).toHaveLength(0);
    });

    it('should parse project with no packages', () => {
      const input = `--- EmptyProject.csproj ---
<Project>
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
</Project>`;
      const result = service.parseProjects(input);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('EmptyProject.csproj');
      expect(result[0].packages).toHaveLength(0);
    });
  });

  describe('resolveVersionConflicts', () => {
    it('should use highest version strategy by default', () => {
      const projects = [
        {
          name: 'Project1.csproj',
          content: '',
          packages: [{ name: 'TestPackage', version: '1.0.0', originalLine: '' }]
        },
        {
          name: 'Project2.csproj',
          content: '',
          packages: [{ name: 'TestPackage', version: '2.0.0', originalLine: '' }]
        }
      ];

      const result = service.resolveVersionConflicts(projects, 'highest');
      expect(result.packageVersions.get('TestPackage')).toBe('2.0.0');
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].resolvedVersion).toBe('2.0.0');
    });

    it('should use lowest version strategy when specified', () => {
      const projects = [
        {
          name: 'Project1.csproj',
          content: '',
          packages: [{ name: 'TestPackage', version: '3.0.0', originalLine: '' }]
        },
        {
          name: 'Project2.csproj',
          content: '',
          packages: [{ name: 'TestPackage', version: '1.0.0', originalLine: '' }]
        }
      ];

      const result = service.resolveVersionConflicts(projects, 'lowest');
      expect(result.packageVersions.get('TestPackage')).toBe('1.0.0');
    });

    it('should use first occurrence strategy when specified', () => {
      const projects = [
        {
          name: 'Project1.csproj',
          content: '',
          packages: [{ name: 'TestPackage', version: '2.5.0', originalLine: '' }]
        },
        {
          name: 'Project2.csproj',
          content: '',
          packages: [{ name: 'TestPackage', version: '3.0.0', originalLine: '' }]
        }
      ];

      const result = service.resolveVersionConflicts(projects, 'first');
      expect(result.packageVersions.get('TestPackage')).toBe('2.5.0');
    });

    it('should not report conflicts when versions are the same', () => {
      const projects = [
        {
          name: 'Project1.csproj',
          content: '',
          packages: [{ name: 'TestPackage', version: '1.0.0', originalLine: '' }]
        },
        {
          name: 'Project2.csproj',
          content: '',
          packages: [{ name: 'TestPackage', version: '1.0.0', originalLine: '' }]
        }
      ];

      const result = service.resolveVersionConflicts(projects, 'highest');
      expect(result.conflicts).toHaveLength(0);
    });

    it('should handle packages appearing in only one project', () => {
      const projects = [
        {
          name: 'Project1.csproj',
          content: '',
          packages: [{ name: 'PackageA', version: '1.0.0', originalLine: '' }]
        },
        {
          name: 'Project2.csproj',
          content: '',
          packages: [{ name: 'PackageB', version: '2.0.0', originalLine: '' }]
        }
      ];

      const result = service.resolveVersionConflicts(projects, 'highest');
      expect(result.packageVersions.size).toBe(2);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should correctly compare prerelease versions with highest strategy', () => {
      const projects = [
        {
          name: 'Project1.csproj',
          content: '',
          packages: [{ name: 'TestPackage', version: '1.0.0-alpha', originalLine: '' }]
        },
        {
          name: 'Project2.csproj',
          content: '',
          packages: [{ name: 'TestPackage', version: '1.0.0', originalLine: '' }]
        }
      ];

      const result = service.resolveVersionConflicts(projects, 'highest');
      expect(result.packageVersions.get('TestPackage')).toBe('1.0.0');
    });
  });

  describe('generateDirectoryPackagesProps', () => {
    it('should generate valid Directory.Packages.props', () => {
      const packageVersions = new Map([
        ['PackageA', '1.0.0'],
        ['PackageB', '2.0.0']
      ]);
      const projects = [
        {
          name: 'Project1.csproj',
          content: '',
          packages: [
            { name: 'PackageA', version: '1.0.0', originalLine: '' },
            { name: 'PackageB', version: '2.0.0', originalLine: '' }
          ]
        }
      ];

      const result = service.generateDirectoryPackagesProps(packageVersions, projects);

      expect(result).toContain('<ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>');
      expect(result).toContain('<PackageVersion Include="PackageA" Version="1.0.0" />');
      expect(result).toContain('<PackageVersion Include="PackageB" Version="2.0.0" />');
    });

    it('should sort packages alphabetically', () => {
      const packageVersions = new Map([
        ['Zebra', '1.0.0'],
        ['Alpha', '2.0.0'],
        ['Middle', '3.0.0']
      ]);
      const projects = [
        {
          name: 'Project.csproj',
          content: '',
          packages: [
            { name: 'Zebra', version: '1.0.0', originalLine: '' },
            { name: 'Alpha', version: '2.0.0', originalLine: '' },
            { name: 'Middle', version: '3.0.0', originalLine: '' }
          ]
        }
      ];

      const result = service.generateDirectoryPackagesProps(packageVersions, projects);
      const alphaIndex = result.indexOf('Alpha');
      const middleIndex = result.indexOf('Middle');
      const zebraIndex = result.indexOf('Zebra');

      expect(alphaIndex).toBeLessThan(middleIndex);
      expect(middleIndex).toBeLessThan(zebraIndex);
    });

    it('should group packages by project with Label attribute - no duplicates for shared packages', () => {
      const packageVersions = new Map([['SharedPackage', '1.0.0']]);
      const projects = [
        {
          name: 'Project1.csproj',
          content: '',
          packages: [{ name: 'SharedPackage', version: '1.0.0', originalLine: '' }]
        },
        {
          name: 'Project2.csproj',
          content: '',
          packages: [{ name: 'SharedPackage', version: '1.0.0', originalLine: '' }]
        }
      ];

      const result = service.generateDirectoryPackagesProps(packageVersions, projects);
      // Shared package should only appear once (in the first project that uses it)
      expect(result).toContain('<ItemGroup Label="Project1">');
      expect(result).toContain('SharedPackage');
      // SharedPackage should appear exactly once
      const matches = result.match(/SharedPackage/g);
      expect(matches?.length).toBe(1);
    });

    it('should remove .csproj extension from Label', () => {
      const packageVersions = new Map([['TestPackage', '1.0.0']]);
      const projects = [
        {
          name: 'MyProject.csproj',
          content: '',
          packages: [{ name: 'TestPackage', version: '1.0.0', originalLine: '' }]
        }
      ];

      const result = service.generateDirectoryPackagesProps(packageVersions, projects);
      expect(result).toContain('<ItemGroup Label="MyProject">');
      expect(result).not.toContain('Label="MyProject.csproj"');
    });

    it('should generate single ItemGroup when groupByProject is false', () => {
      const packageVersions = new Map([
        ['PackageA', '1.0.0'],
        ['PackageB', '2.0.0']
      ]);
      const projects = [
        {
          name: 'Project1.csproj',
          content: '',
          packages: [{ name: 'PackageA', version: '1.0.0', originalLine: '' }]
        },
        {
          name: 'Project2.csproj',
          content: '',
          packages: [{ name: 'PackageB', version: '2.0.0', originalLine: '' }]
        }
      ];

      const result = service.generateDirectoryPackagesProps(packageVersions, projects, false);
      expect(result).not.toContain('Label=');
      expect(result).toContain('<ItemGroup>');
      expect(result).toContain('<PackageVersion Include="PackageA" Version="1.0.0" />');
      expect(result).toContain('<PackageVersion Include="PackageB" Version="2.0.0" />');
    });

    it('should sort packages alphabetically when groupByProject is false', () => {
      const packageVersions = new Map([
        ['Zebra', '1.0.0'],
        ['Alpha', '2.0.0'],
        ['Middle', '3.0.0']
      ]);
      const projects = [
        {
          name: 'Project.csproj',
          content: '',
          packages: [
            { name: 'Zebra', version: '1.0.0', originalLine: '' },
            { name: 'Alpha', version: '2.0.0', originalLine: '' },
            { name: 'Middle', version: '3.0.0', originalLine: '' }
          ]
        }
      ];

      const result = service.generateDirectoryPackagesProps(packageVersions, projects, false);
      const alphaIndex = result.indexOf('Alpha');
      const middleIndex = result.indexOf('Middle');
      const zebraIndex = result.indexOf('Zebra');

      expect(alphaIndex).toBeLessThan(middleIndex);
      expect(middleIndex).toBeLessThan(zebraIndex);
    });

    it('should default to groupByProject true when not specified', () => {
      const packageVersions = new Map([['TestPackage', '1.0.0']]);
      const projects = [
        {
          name: 'MyProject.csproj',
          content: '',
          packages: [{ name: 'TestPackage', version: '1.0.0', originalLine: '' }]
        }
      ];

      const result = service.generateDirectoryPackagesProps(packageVersions, projects);
      expect(result).toContain('<ItemGroup Label="MyProject">');
    });
  });

  describe('updateCsprojContent', () => {
    it('should remove Version attribute from self-closing PackageReference', () => {
      const content = `<PackageReference Include="TestPackage" Version="1.0.0" />`;
      const result = service.updateCsprojContent(content);
      expect(result).toBe(`<PackageReference Include="TestPackage" />`);
    });

    it('should remove Version attribute when it comes before Include', () => {
      const content = `<PackageReference Version="1.0.0" Include="TestPackage" />`;
      const result = service.updateCsprojContent(content);
      expect(result).toBe(`<PackageReference Include="TestPackage" />`);
    });

    it('should preserve other attributes', () => {
      const content = `<PackageReference Include="TestPackage" Version="1.0.0" PrivateAssets="all" />`;
      const result = service.updateCsprojContent(content);
      expect(result).toContain('Include="TestPackage"');
      expect(result).toContain('PrivateAssets="all"');
      expect(result).not.toContain('Version=');
    });

    it('should handle PackageReference with closing tag', () => {
      const content = `<PackageReference Include="TestPackage" Version="1.0.0">
  <PrivateAssets>all</PrivateAssets>
</PackageReference>`;
      const result = service.updateCsprojContent(content);
      expect(result).toContain('<PackageReference Include="TestPackage">');
      expect(result).not.toContain('Version=');
    });

    it('should handle multiple PackageReference elements', () => {
      const content = `<ItemGroup>
  <PackageReference Include="Package1" Version="1.0.0" />
  <PackageReference Include="Package2" Version="2.0.0" />
</ItemGroup>`;
      const result = service.updateCsprojContent(content);
      expect(result).toContain('<PackageReference Include="Package1" />');
      expect(result).toContain('<PackageReference Include="Package2" />');
    });

    it('should preserve project structure', () => {
      const content = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="TestPackage" Version="1.0.0" />
  </ItemGroup>
</Project>`;
      const result = service.updateCsprojContent(content);
      expect(result).toContain('<TargetFramework>net8.0</TargetFramework>');
      expect(result).toContain('Sdk="Microsoft.NET.Sdk"');
    });
  });

  describe('centralize', () => {
    it('should return empty result for empty input', () => {
      const result = service.centralize('');
      expect(result.directoryPackagesProps).toBe('');
      expect(result.updatedProjects).toHaveLength(0);
      expect(result.packageVersions.size).toBe(0);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should process single project correctly', () => {
      const input = `--- MyProject.csproj ---
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="Newtonsoft.Json" Version="13.0.1" />
  </ItemGroup>
</Project>`;

      const result = service.centralize(input);

      expect(result.updatedProjects).toHaveLength(1);
      expect(result.packageVersions.get('Newtonsoft.Json')).toBe('13.0.1');
      expect(result.directoryPackagesProps).toContain('Newtonsoft.Json');
      expect(result.updatedProjects[0].content).not.toContain('Version=');
    });

    it('should handle version conflicts with highest strategy', () => {
      const input = `--- Project1.csproj ---
<Project>
  <ItemGroup>
    <PackageReference Include="SharedPackage" Version="1.0.0" />
  </ItemGroup>
</Project>

--- Project2.csproj ---
<Project>
  <ItemGroup>
    <PackageReference Include="SharedPackage" Version="2.0.0" />
  </ItemGroup>
</Project>`;

      const result = service.centralize(input, 'highest');

      expect(result.packageVersions.get('SharedPackage')).toBe('2.0.0');
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].packageName).toBe('SharedPackage');
      expect(result.conflicts[0].resolvedVersion).toBe('2.0.0');
    });

    it('should handle version conflicts with lowest strategy', () => {
      const input = `--- Project1.csproj ---
<Project>
  <ItemGroup>
    <PackageReference Include="SharedPackage" Version="3.0.0" />
  </ItemGroup>
</Project>

--- Project2.csproj ---
<Project>
  <ItemGroup>
    <PackageReference Include="SharedPackage" Version="1.0.0" />
  </ItemGroup>
</Project>`;

      const result = service.centralize(input, 'lowest');

      expect(result.packageVersions.get('SharedPackage')).toBe('1.0.0');
    });

    it('should handle complex real-world scenario', () => {
      const input = `--- WebApi.csproj ---
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.OpenApi" Version="8.0.0" />
    <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
  </ItemGroup>
</Project>

--- Core.csproj ---
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="FluentValidation" Version="11.8.0" />
    <PackageReference Include="Newtonsoft.Json" Version="13.0.1" />
  </ItemGroup>
</Project>`;

      const result = service.centralize(input, 'highest');

      // Should have 3 unique packages
      expect(result.packageVersions.size).toBe(3);

      // Newtonsoft.Json should use highest version
      expect(result.packageVersions.get('Newtonsoft.Json')).toBe('13.0.3');

      // Should report conflict for Newtonsoft.Json
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].packageName).toBe('Newtonsoft.Json');

      // Updated projects should not have Version attributes
      result.updatedProjects.forEach(project => {
        expect(project.content).not.toMatch(/Version\s*=\s*["'][^"']+["']/);
      });

      // Directory.Packages.props should be valid
      expect(result.directoryPackagesProps).toContain('<ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>');
      expect(result.directoryPackagesProps).toContain('FluentValidation');
      expect(result.directoryPackagesProps).toContain('Microsoft.AspNetCore.OpenApi');
    });
  });

  describe('isAnalyzer', () => {
    it('should return true for packages with PrivateAssets="all" and analyzers in IncludeAssets', () => {
      const pkg: PackageReference = {
        name: 'Meziantou.Analyzer',
        version: '2.0.239',
        originalLine: '',
        privateAssets: 'all',
        includeAssets: 'runtime; build; native; contentfiles; analyzers; buildtransitive'
      };
      expect(service.isAnalyzer(pkg)).toBe(true);
    });

    it('should return true for packages with case-insensitive PrivateAssets and analyzers', () => {
      const pkg: PackageReference = {
        name: 'Analyzer.Package',
        version: '1.0.0',
        originalLine: '',
        privateAssets: 'All',
        includeAssets: 'Runtime;Build;Analyzers'
      };
      expect(service.isAnalyzer(pkg)).toBe(true);
    });

    it('should return false for packages without PrivateAssets', () => {
      const pkg: PackageReference = {
        name: 'NormalPackage',
        version: '1.0.0',
        originalLine: '',
        includeAssets: 'analyzers'
      };
      expect(service.isAnalyzer(pkg)).toBe(false);
    });

    it('should return false for packages without analyzers in IncludeAssets', () => {
      const pkg: PackageReference = {
        name: 'SourceLink',
        version: '8.0.0',
        originalLine: '',
        privateAssets: 'all',
        includeAssets: 'runtime; build; native'
      };
      expect(service.isAnalyzer(pkg)).toBe(false);
    });

    it('should return false for packages without both PrivateAssets and IncludeAssets', () => {
      const pkg: PackageReference = {
        name: 'RegularPackage',
        version: '1.0.0',
        originalLine: ''
      };
      expect(service.isAnalyzer(pkg)).toBe(false);
    });
  });

  describe('parsePackageReferences with PrivateAssets and IncludeAssets', () => {
    it('should parse PrivateAssets and IncludeAssets from attributes', () => {
      const content = `
        <PackageReference Include="Meziantou.Analyzer" Version="2.0.239" PrivateAssets="all" IncludeAssets="runtime; build; analyzers" />
      `;
      const result = service.parsePackageReferences(content);
      expect(result).toHaveLength(1);
      expect(result[0].privateAssets).toBe('all');
      expect(result[0].includeAssets).toBe('runtime; build; analyzers');
    });

    it('should parse PrivateAssets and IncludeAssets from inner elements', () => {
      const content = `
        <PackageReference Include="Meziantou.Analyzer" Version="2.0.239">
          <PrivateAssets>all</PrivateAssets>
          <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
        </PackageReference>
      `;
      const result = service.parsePackageReferences(content);
      expect(result).toHaveLength(1);
      expect(result[0].privateAssets).toBe('all');
      expect(result[0].includeAssets).toBe('runtime; build; native; contentfiles; analyzers; buildtransitive');
    });

    it('should handle packages without PrivateAssets and IncludeAssets', () => {
      const content = `
        <PackageReference Include="Newtonsoft.Json" Version="13.0.1" />
      `;
      const result = service.parsePackageReferences(content);
      expect(result).toHaveLength(1);
      expect(result[0].privateAssets).toBeUndefined();
      expect(result[0].includeAssets).toBeUndefined();
    });
  });

  describe('generateDirectoryPackagesProps with GlobalPackageReference', () => {
    it('should generate GlobalPackageReference for analyzers used in multiple projects', () => {
      const packageVersions = new Map([
        ['Meziantou.Analyzer', '2.0.239'],
        ['Microsoft.SourceLink.GitHub', '8.0.0']
      ]);
      const projects = [
        {
          name: 'Project1.csproj',
          content: '',
          packages: [
            {
              name: 'Meziantou.Analyzer',
              version: '2.0.239',
              originalLine: '',
              privateAssets: 'all',
              includeAssets: 'runtime; build; native; contentfiles; analyzers; buildtransitive'
            }
          ]
        },
        {
          name: 'Project2.csproj',
          content: '',
          packages: [
            {
              name: 'Meziantou.Analyzer',
              version: '2.0.239',
              originalLine: '',
              privateAssets: 'all',
              includeAssets: 'runtime; build; native; contentfiles; analyzers; buildtransitive'
            }
          ]
        }
      ];

      const result = service.generateDirectoryPackagesProps(packageVersions, projects, true, true);

      expect(result).toContain('<ItemGroup Label="Global Packages">');
      expect(result).toContain('<GlobalPackageReference Include="Meziantou.Analyzer"');
      expect(result).toContain('PrivateAssets="All"');
      expect(result).toContain('IncludeAssets="Runtime;Build;Native;Contentfiles;Analyzers;Buildtransitive"');
    });

    it('should NOT use GlobalPackageReference for single-project analyzers', () => {
      const packageVersions = new Map([
        ['Microsoft.SourceLink.GitHub', '8.0.0']
      ]);
      const projects = [
        {
          name: 'Project1.csproj',
          content: '',
          packages: [
            {
              name: 'Microsoft.SourceLink.GitHub',
              version: '8.0.0',
              originalLine: '',
              privateAssets: 'all',
              includeAssets: 'runtime; build; native; contentfiles; analyzers; buildtransitive'
            }
          ]
        }
      ];

      const result = service.generateDirectoryPackagesProps(packageVersions, projects, true, true);

      // Single-project analyzers should remain as regular PackageVersion
      expect(result).toContain('<PackageVersion Include="Microsoft.SourceLink.GitHub" Version="8.0.0" />');
      expect(result).not.toContain('GlobalPackageReference');
      expect(result).not.toContain('Label="Global Packages"');
    });

    it('should not create GlobalPackageReference when useGlobalAnalyzers is false', () => {
      const packageVersions = new Map([
        ['Meziantou.Analyzer', '2.0.239']
      ]);
      const projects = [
        {
          name: 'Project1.csproj',
          content: '',
          packages: [
            {
              name: 'Meziantou.Analyzer',
              version: '2.0.239',
              originalLine: '',
              privateAssets: 'all',
              includeAssets: 'runtime; build; native; contentfiles; analyzers; buildtransitive'
            }
          ]
        },
        {
          name: 'Project2.csproj',
          content: '',
          packages: [
            {
              name: 'Meziantou.Analyzer',
              version: '2.0.239',
              originalLine: '',
              privateAssets: 'all',
              includeAssets: 'runtime; build; native; contentfiles; analyzers; buildtransitive'
            }
          ]
        }
      ];

      const result = service.generateDirectoryPackagesProps(packageVersions, projects, true, false);

      expect(result).not.toContain('GlobalPackageReference');
      expect(result).toContain('<PackageVersion Include="Meziantou.Analyzer" Version="2.0.239" />');
    });

    it('should handle complex scenario with both global and single-project analyzers', () => {
      const packageVersions = new Map([
        ['Meziantou.Analyzer', '2.0.239'],
        ['Microsoft.SourceLink.GitHub', '8.0.0'],
        ['Newtonsoft.Json', '13.0.1']
      ]);
      const projects = [
        {
          name: 'Project1.csproj',
          content: '',
          packages: [
            {
              name: 'Meziantou.Analyzer',
              version: '2.0.239',
              originalLine: '',
              privateAssets: 'all',
              includeAssets: 'runtime; build; native; contentfiles; analyzers; buildtransitive'
            },
            {
              name: 'Microsoft.SourceLink.GitHub',
              version: '8.0.0',
              originalLine: '',
              privateAssets: 'all',
              includeAssets: 'runtime; build; native; contentfiles; analyzers; buildtransitive'
            },
            {
              name: 'Newtonsoft.Json',
              version: '13.0.1',
              originalLine: ''
            }
          ]
        },
        {
          name: 'Project2.csproj',
          content: '',
          packages: [
            {
              name: 'Meziantou.Analyzer',
              version: '2.0.239',
              originalLine: '',
              privateAssets: 'all',
              includeAssets: 'runtime; build; native; contentfiles; analyzers; buildtransitive'
            }
          ]
        }
      ];

      const result = service.generateDirectoryPackagesProps(packageVersions, projects, true, true);

      // Should have GlobalPackageReference for multi-project analyzer only
      expect(result).toContain('<GlobalPackageReference Include="Meziantou.Analyzer"');
      
      // Single-project analyzer should remain as regular PackageVersion in Project1
      expect(result).toContain('<PackageVersion Include="Microsoft.SourceLink.GitHub" Version="8.0.0" />');
      expect(result).not.toContain('<GlobalPackageReference Include="Microsoft.SourceLink.GitHub"');
      
      // Should have regular version for non-analyzer
      expect(result).toContain('<PackageVersion Include="Newtonsoft.Json" Version="13.0.1" />');
      
      // GlobalPackageReference should not appear in individual project groups
      expect(result).not.toMatch(/<ItemGroup Label="Project\d+">[^<]*<PackageVersion Include="Meziantou\.Analyzer"/);
    });

    it('should not treat non-analyzers as analyzers even if in multiple projects', () => {
      const packageVersions = new Map([
        ['Newtonsoft.Json', '13.0.1']
      ]);
      const projects = [
        {
          name: 'Project1.csproj',
          content: '',
          packages: [
            {
              name: 'Newtonsoft.Json',
              version: '13.0.1',
              originalLine: ''
            }
          ]
        },
        {
          name: 'Project2.csproj',
          content: '',
          packages: [
            {
              name: 'Newtonsoft.Json',
              version: '13.0.1',
              originalLine: ''
            }
          ]
        }
      ];

      const result = service.generateDirectoryPackagesProps(packageVersions, projects, true, true);

      expect(result).not.toContain('GlobalPackageReference');
      expect(result).toContain('<PackageVersion Include="Newtonsoft.Json" Version="13.0.1" />');
    });
  });

  describe('centralize with useGlobalAnalyzers', () => {
    it('should handle global analyzers when enabled', () => {
      const input = `--- Project1.csproj ---
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="Meziantou.Analyzer" Version="2.0.239">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>
  </ItemGroup>
</Project>

--- Project2.csproj ---
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="Meziantou.Analyzer" Version="2.0.239">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>
  </ItemGroup>
</Project>`;

      const result = service.centralize(input, 'highest', true, true);

      expect(result.directoryPackagesProps).toContain('GlobalPackageReference');
      expect(result.directoryPackagesProps).toContain('Meziantou.Analyzer');
    });

    it('should not create global analyzers when disabled', () => {
      const input = `--- Project1.csproj ---
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="Meziantou.Analyzer" Version="2.0.239">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>
  </ItemGroup>
</Project>

--- Project2.csproj ---
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="Meziantou.Analyzer" Version="2.0.239">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>
  </ItemGroup>
</Project>`;

      const result = service.centralize(input, 'highest', true, false);

      expect(result.directoryPackagesProps).not.toContain('GlobalPackageReference');
      expect(result.directoryPackagesProps).toContain('<PackageVersion Include="Meziantou.Analyzer" Version="2.0.239" />');
    });

    it('should handle the user example: ProjectA with 2 analyzers, ProjectB with 1 shared analyzer', () => {
      const input = `--- ProjectA.csproj ---
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="Meziantou.Analyzer" Version="2.0.239">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>
    <PackageReference Include="Microsoft.SourceLink.GitHub" Version="8.0.0">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>
  </ItemGroup>
</Project>

--- ProjectB.csproj ---
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="Meziantou.Analyzer" Version="2.0.239">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>
  </ItemGroup>
</Project>`;

      const result = service.centralize(input, 'highest', true, true);

      // Should have GlobalPackageReference for Meziantou.Analyzer (used in both projects)
      expect(result.directoryPackagesProps).toContain('<ItemGroup Label="Global Packages">');
      expect(result.directoryPackagesProps).toContain('<GlobalPackageReference Include="Meziantou.Analyzer" Version="2.0.239"');
      
      // Should NOT have GlobalPackageReference for Microsoft.SourceLink.GitHub (used in one project)
      expect(result.directoryPackagesProps).not.toContain('<GlobalPackageReference Include="Microsoft.SourceLink.GitHub"');
      
      // Microsoft.SourceLink.GitHub should remain in ProjectA as regular PackageVersion
      expect(result.directoryPackagesProps).toContain('<ItemGroup Label="ProjectA">');
      expect(result.directoryPackagesProps).toContain('<PackageVersion Include="Microsoft.SourceLink.GitHub" Version="8.0.0" />');
      
      // Meziantou.Analyzer should NOT appear in individual project groups
      const projectASection = result.directoryPackagesProps.match(/<ItemGroup Label="ProjectA">[\s\S]*?<\/ItemGroup>/);
      if (projectASection) {
        expect(projectASection[0]).not.toContain('Meziantou.Analyzer');
      }
      
      // IMPORTANT: Meziantou.Analyzer should be COMPLETELY REMOVED from transformed .csproj files
      const projectAContent = result.updatedProjects.find(p => p.name === 'ProjectA.csproj')?.content;
      const projectBContent = result.updatedProjects.find(p => p.name === 'ProjectB.csproj')?.content;
      
      expect(projectAContent).toBeDefined();
      expect(projectBContent).toBeDefined();
      
      // Meziantou.Analyzer should not appear in either project's csproj
      expect(projectAContent).not.toContain('Meziantou.Analyzer');
      expect(projectBContent).not.toContain('Meziantou.Analyzer');
      
      // Microsoft.SourceLink.GitHub should still be in ProjectA but without Version attribute
      expect(projectAContent).toContain('Microsoft.SourceLink.GitHub');
      expect(projectAContent).not.toMatch(/Microsoft\.SourceLink\.GitHub[^>]*Version\s*=/);
    });

    it('should not create duplicates when useGlobalAnalyzers is false', () => {
      const input = `--- ProjectA.csproj ---
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="Meziantou.Analyzer" Version="2.0.239">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>
    <PackageReference Include="Microsoft.SourceLink.GitHub" Version="8.0.0">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>
  </ItemGroup>
</Project>

--- ProjectB.csproj ---
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="Meziantou.Analyzer" Version="2.0.239">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>
  </ItemGroup>
</Project>`;

      const result = service.centralize(input, 'highest', true, false);

      // Should not have GlobalPackageReference
      expect(result.directoryPackagesProps).not.toContain('GlobalPackageReference');
      expect(result.directoryPackagesProps).not.toContain('Label="Global Packages"');
      
      // Should have packages in project groups
      expect(result.directoryPackagesProps).toContain('<ItemGroup Label="ProjectA">');
      
      // Shared packages should only appear once (no duplicates)
      const meziantouMatches = result.directoryPackagesProps.match(/Meziantou\.Analyzer/g);
      const sourcelinkMatches = result.directoryPackagesProps.match(/Microsoft\.SourceLink\.GitHub/g);
      
      // Each package should appear exactly once in Directory.Packages.props
      expect(meziantouMatches?.length).toBe(1);
      expect(sourcelinkMatches?.length).toBe(1);
    });
  });
});
