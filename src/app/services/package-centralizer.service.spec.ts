import { describe, it, expect, beforeEach } from 'vitest';
import { PackageCentralizerService } from './package-centralizer.service';

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
      expect(result[0].attributes.size).toBe(0);
      expect(result[0].childElements.size).toBe(0);
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
      expect(result[0].childElements.get('PrivateAssets')).toBe('all');
    });

    it('should parse inline attributes like PrivateAssets', () => {
      const content = `
        <PackageReference Include="TestPackage" Version="1.0.0" PrivateAssets="all" IncludeAssets="runtime; build; native; contentfiles; analyzers; buildtransitive" />
      `;
      const result = service.parsePackageReferences(content);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('TestPackage');
      expect(result[0].version).toBe('1.0.0');
      expect(result[0].attributes.get('PrivateAssets')).toBe('all');
      expect(result[0].attributes.get('IncludeAssets')).toBe('runtime; build; native; contentfiles; analyzers; buildtransitive');
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
          packages: [{ name: 'TestPackage', version: '1.0.0', originalLine: '', attributes: new Map(), childElements: new Map() }]
        },
        {
          name: 'Project2.csproj',
          content: '',
          packages: [{ name: 'TestPackage', version: '2.0.0', originalLine: '', attributes: new Map(), childElements: new Map() }]
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
          packages: [{ name: 'TestPackage', version: '3.0.0', originalLine: '', attributes: new Map(), childElements: new Map() }]
        },
        {
          name: 'Project2.csproj',
          content: '',
          packages: [{ name: 'TestPackage', version: '1.0.0', originalLine: '', attributes: new Map(), childElements: new Map() }]
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
          packages: [{ name: 'TestPackage', version: '2.5.0', originalLine: '', attributes: new Map(), childElements: new Map() }]
        },
        {
          name: 'Project2.csproj',
          content: '',
          packages: [{ name: 'TestPackage', version: '3.0.0', originalLine: '', attributes: new Map(), childElements: new Map() }]
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
          packages: [{ name: 'TestPackage', version: '1.0.0', originalLine: '', attributes: new Map(), childElements: new Map() }]
        },
        {
          name: 'Project2.csproj',
          content: '',
          packages: [{ name: 'TestPackage', version: '1.0.0', originalLine: '', attributes: new Map(), childElements: new Map() }]
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
          packages: [{ name: 'PackageA', version: '1.0.0', originalLine: '', attributes: new Map(), childElements: new Map() }]
        },
        {
          name: 'Project2.csproj',
          content: '',
          packages: [{ name: 'PackageB', version: '2.0.0', originalLine: '', attributes: new Map(), childElements: new Map() }]
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
          packages: [{ name: 'TestPackage', version: '1.0.0-alpha', originalLine: '', attributes: new Map(), childElements: new Map() }]
        },
        {
          name: 'Project2.csproj',
          content: '',
          packages: [{ name: 'TestPackage', version: '1.0.0', originalLine: '', attributes: new Map(), childElements: new Map() }]
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
            { name: 'PackageA', version: '1.0.0', originalLine: '', attributes: new Map(), childElements: new Map() },
            { name: 'PackageB', version: '2.0.0', originalLine: '', attributes: new Map(), childElements: new Map() }
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
            { name: 'Zebra', version: '1.0.0', originalLine: '', attributes: new Map(), childElements: new Map() },
            { name: 'Alpha', version: '2.0.0', originalLine: '', attributes: new Map(), childElements: new Map() },
            { name: 'Middle', version: '3.0.0', originalLine: '', attributes: new Map(), childElements: new Map() }
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

    it('should group packages by project with Label attribute', () => {
      const packageVersions = new Map([['SharedPackage', '1.0.0']]);
      const projects = [
        {
          name: 'Project1.csproj',
          content: '',
          packages: [{ name: 'SharedPackage', version: '1.0.0', originalLine: '', attributes: new Map(), childElements: new Map() }]
        },
        {
          name: 'Project2.csproj',
          content: '',
          packages: [{ name: 'SharedPackage', version: '1.0.0', originalLine: '', attributes: new Map(), childElements: new Map() }]
        }
      ];

      const result = service.generateDirectoryPackagesProps(packageVersions, projects);
      // With global packages, SharedPackage should be in Global section
      expect(result).toContain('<ItemGroup Label="Global">');
      expect(result).toContain('<GlobalPackageVersion Include="SharedPackage" Version="1.0.0" />');
    });

    it('should remove .csproj extension from Label', () => {
      const packageVersions = new Map([['TestPackage', '1.0.0']]);
      const projects = [
        {
          name: 'MyProject.csproj',
          content: '',
          packages: [{ name: 'TestPackage', version: '1.0.0', originalLine: '', attributes: new Map(), childElements: new Map() }]
        }
      ];

      const result = service.generateDirectoryPackagesProps(packageVersions, projects);
      // Single project with single package - no Global section, but project label
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
          packages: [{ name: 'PackageA', version: '1.0.0', originalLine: '', attributes: new Map(), childElements: new Map() }]
        },
        {
          name: 'Project2.csproj',
          content: '',
          packages: [{ name: 'PackageB', version: '2.0.0', originalLine: '', attributes: new Map(), childElements: new Map() }]
        }
      ];

      const result = service.generateDirectoryPackagesProps(packageVersions, projects, false);
      expect(result).not.toContain('Label="Project1"');
      expect(result).not.toContain('Label="Project2"');
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
            { name: 'Zebra', version: '1.0.0', originalLine: '', attributes: new Map(), childElements: new Map() },
            { name: 'Alpha', version: '2.0.0', originalLine: '', attributes: new Map(), childElements: new Map() },
            { name: 'Middle', version: '3.0.0', originalLine: '', attributes: new Map(), childElements: new Map() }
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
          packages: [{ name: 'TestPackage', version: '1.0.0', originalLine: '', attributes: new Map(), childElements: new Map() }]
        }
      ];

      const result = service.generateDirectoryPackagesProps(packageVersions, projects);
      // Single project, single package - should have label
      expect(result).toContain('Label="MyProject"');
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

    it('should remove global packages entirely', () => {
      const content = `<ItemGroup>
  <PackageReference Include="GlobalPkg" Version="1.0.0" />
  <PackageReference Include="LocalPkg" Version="2.0.0" />
</ItemGroup>`;
      const globalPackages = new Set(['GlobalPkg']);
      const result = service.updateCsprojContent(content, globalPackages);
      expect(result).not.toContain('GlobalPkg');
      expect(result).toContain('<PackageReference Include="LocalPkg" />');
    });

    it('should remove global packages with attributes', () => {
      const content = `<ItemGroup>
  <PackageReference Include="GlobalPkg" Version="1.0.0" PrivateAssets="all" />
  <PackageReference Include="LocalPkg" Version="2.0.0" />
</ItemGroup>`;
      const globalPackages = new Set(['GlobalPkg']);
      const result = service.updateCsprojContent(content, globalPackages);
      expect(result).not.toContain('GlobalPkg');
      expect(result).toContain('<PackageReference Include="LocalPkg" />');
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

  describe('GlobalPackageVersion scenarios', () => {
    it('should fix duplicate entries bug in groupByProject mode', () => {
      const input = `--- ProjectA.csproj ---
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFrameworks>net8.0</TargetFrameworks>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="B" Version="1.0.0" />
    <PackageReference Include="C" Version="1.0.0" />
  </ItemGroup>
</Project>

--- ProjectB.csproj ---
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFrameworks>net8.0</TargetFrameworks>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="B" Version="1.0.0" />
    <PackageReference Include="C" Version="1.0.0" />
  </ItemGroup>
</Project>`;

      const result = service.centralize(input, 'highest', true);
      
      // Should have Global section with both packages
      expect(result.directoryPackagesProps).toContain('<ItemGroup Label="Global">');
      expect(result.directoryPackagesProps).toContain('<GlobalPackageVersion Include="B" Version="1.0.0" />');
      expect(result.directoryPackagesProps).toContain('<GlobalPackageVersion Include="C" Version="1.0.0" />');
      
      // Should not duplicate entries
      const bCount = (result.directoryPackagesProps.match(/Include="B"/g) || []).length;
      const cCount = (result.directoryPackagesProps.match(/Include="C"/g) || []).length;
      expect(bCount).toBe(1);
      expect(cCount).toBe(1);
      
      // Projects should not have these packages
      result.updatedProjects.forEach(project => {
        expect(project.content).not.toContain('Include="B"');
        expect(project.content).not.toContain('Include="C"');
      });
    });

    it('should create GlobalPackageVersion for common packages - no grouping', () => {
      const input = `--- ProjectA.csproj ---
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFrameworks>net8.0</TargetFrameworks>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="B" Version="1.0.0" />
    <PackageReference Include="C" Version="1.0.0" />
  </ItemGroup>
</Project>

--- ProjectB.csproj ---
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFrameworks>net8.0</TargetFrameworks>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="B" Version="1.0.0" />
    <PackageReference Include="D" Version="1.0.0" />
  </ItemGroup>
</Project>`;

      const result = service.centralize(input, 'highest', false);
      
      // Should have Global section with B
      expect(result.directoryPackagesProps).toContain('<ItemGroup Label="Global">');
      expect(result.directoryPackagesProps).toContain('<GlobalPackageVersion Include="B" Version="1.0.0" />');
      
      // Should have non-global packages
      expect(result.directoryPackagesProps).toContain('<PackageVersion Include="C" Version="1.0.0" />');
      expect(result.directoryPackagesProps).toContain('<PackageVersion Include="D" Version="1.0.0" />');
      
      // ProjectA should have C but not B
      const projectA = result.updatedProjects.find(p => p.name === 'ProjectA.csproj');
      expect(projectA?.content).toContain('Include="C"');
      expect(projectA?.content).not.toContain('Include="B"');
      
      // ProjectB should have D but not B
      const projectB = result.updatedProjects.find(p => p.name === 'ProjectB.csproj');
      expect(projectB?.content).toContain('Include="D"');
      expect(projectB?.content).not.toContain('Include="B"');
    });

    it('should create GlobalPackageVersion for common packages - with grouping', () => {
      const input = `--- ProjectA.csproj ---
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFrameworks>net8.0</TargetFrameworks>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="B" Version="1.0.0" />
    <PackageReference Include="C" Version="1.0.0" />
  </ItemGroup>
</Project>

--- ProjectB.csproj ---
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFrameworks>net8.0</TargetFrameworks>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="B" Version="1.0.0" />
    <PackageReference Include="D" Version="1.0.0" />
  </ItemGroup>
</Project>`;

      const result = service.centralize(input, 'highest', true);
      
      // Should have Global section with B
      expect(result.directoryPackagesProps).toContain('<ItemGroup Label="Global">');
      expect(result.directoryPackagesProps).toContain('<GlobalPackageVersion Include="B" Version="1.0.0" />');
      
      // Should have project-specific sections
      expect(result.directoryPackagesProps).toContain('<ItemGroup Label="ProjectA">');
      expect(result.directoryPackagesProps).toContain('<PackageVersion Include="C" Version="1.0.0" />');
      
      expect(result.directoryPackagesProps).toContain('<ItemGroup Label="ProjectB">');
      expect(result.directoryPackagesProps).toContain('<PackageVersion Include="D" Version="1.0.0" />');
    });

    it('should handle packages with child elements as GlobalPackageVersion', () => {
      const input = `--- ProjectA.csproj ---
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFrameworks>net8.0</TargetFrameworks>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="B" Version="1.0.0">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>
    <PackageReference Include="C" Version="1.0.0" />
  </ItemGroup>
</Project>

--- ProjectB.csproj ---
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFrameworks>net8.0</TargetFrameworks>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="B" Version="1.0.0">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>
    <PackageReference Include="D" Version="1.0.0" />
  </ItemGroup>
</Project>`;

      const result = service.centralize(input, 'highest', false);
      
      // Should have Global section with B including child elements
      expect(result.directoryPackagesProps).toContain('<GlobalPackageVersion Include="B" Version="1.0.0">');
      expect(result.directoryPackagesProps).toContain('<PrivateAssets>all</PrivateAssets>');
      expect(result.directoryPackagesProps).toContain('<IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>');
      
      // Projects should not have B
      result.updatedProjects.forEach(project => {
        expect(project.content).not.toContain('Include="B"');
      });
    });

    it('should handle packages with inline attributes as GlobalPackageVersion', () => {
      const input = `--- ProjectA.csproj ---
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFrameworks>net8.0</TargetFrameworks>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="B" Version="1.0.0" PrivateAssets="all" IncludeAssets="runtime; build; native; contentfiles; analyzers; buildtransitive" />
    <PackageReference Include="C" Version="1.0.0" />
  </ItemGroup>
</Project>

--- ProjectB.csproj ---
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFrameworks>net8.0</TargetFrameworks>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="B" Version="1.0.0">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>
  </ItemGroup>
</Project>`;

      const result = service.centralize(input, 'highest', false);
      
      // Should have Global section with B as both projects have same attributes
      expect(result.directoryPackagesProps).toContain('<GlobalPackageVersion Include="B" Version="1.0.0"');
      expect(result.directoryPackagesProps).toContain('PrivateAssets="all"');
      expect(result.directoryPackagesProps).toContain('IncludeAssets="runtime; build; native; contentfiles; analyzers; buildtransitive"');
      
      // Should have C
      expect(result.directoryPackagesProps).toContain('<PackageVersion Include="C" Version="1.0.0" />');
    });

    it('should handle 3 projects with one common package', () => {
      const input = `--- ProjectA.csproj ---
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFrameworks>net8.0</TargetFrameworks>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="B" Version="1.0.0" />
    <PackageReference Include="C" Version="1.0.0" />
  </ItemGroup>
</Project>

--- ProjectB.csproj ---
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFrameworks>net8.0</TargetFrameworks>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="B" Version="1.0.0" />
    <PackageReference Include="D" Version="1.0.0" />
  </ItemGroup>
</Project>

--- ProjectC.csproj ---
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFrameworks>net8.0</TargetFrameworks>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="C" Version="1.0.0" />
    <PackageReference Include="D" Version="1.0.0" />
  </ItemGroup>
</Project>`;

      const result = service.centralize(input, 'highest', false);
      
      // B appears in ProjectA and ProjectB only, so no GlobalPackageVersion for B
      expect(result.directoryPackagesProps).not.toContain('GlobalPackageVersion');
      
      // All packages should be in regular section
      expect(result.directoryPackagesProps).toContain('<PackageVersion Include="B" Version="1.0.0" />');
      expect(result.directoryPackagesProps).toContain('<PackageVersion Include="C" Version="1.0.0" />');
      expect(result.directoryPackagesProps).toContain('<PackageVersion Include="D" Version="1.0.0" />');
    });

    it('should handle 3 projects with no common packages', () => {
      const input = `--- ProjectA.csproj ---
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFrameworks>net8.0</TargetFrameworks>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="B" Version="1.0.0" />
    <PackageReference Include="C" Version="1.0.0" />
  </ItemGroup>
</Project>

--- ProjectB.csproj ---
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFrameworks>net8.0</TargetFrameworks>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="C" Version="1.0.0" />
    <PackageReference Include="D" Version="1.0.0" />
  </ItemGroup>
</Project>

--- ProjectC.csproj ---
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFrameworks>net8.0</TargetFrameworks>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="B" Version="1.0.0" />
    <PackageReference Include="D" Version="1.0.0" />
  </ItemGroup>
</Project>`;

      const result = service.centralize(input, 'highest', false);
      
      // No package appears in all projects
      expect(result.directoryPackagesProps).not.toContain('GlobalPackageVersion');
      
      // All packages should be in regular section
      expect(result.directoryPackagesProps).toContain('<PackageVersion Include="B" Version="1.0.0" />');
      expect(result.directoryPackagesProps).toContain('<PackageVersion Include="C" Version="1.0.0" />');
      expect(result.directoryPackagesProps).toContain('<PackageVersion Include="D" Version="1.0.0" />');
      
      // Projects should still have their packages (minus version)
      result.updatedProjects.forEach(project => {
        expect(project.content).not.toContain('Version=');
      });
    });

    it('should preserve non-version attributes in projects for non-global packages', () => {
      const input = `--- ProjectA.csproj ---
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFrameworks>net8.0</TargetFrameworks>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="B" Version="1.0.0" PrivateAssets="all" IncludeAssets="runtime; build; native; contentfiles; analyzers; buildtransitive" />
  </ItemGroup>
</Project>`;

      const result = service.centralize(input, 'highest', false);
      
      // Directory.Packages.props should have B without attributes
      expect(result.directoryPackagesProps).toContain('<PackageVersion Include="B" Version="1.0.0" />');
      expect(result.directoryPackagesProps).not.toContain('PrivateAssets');
      
      // Project should preserve attributes but not version
      const projectA = result.updatedProjects[0];
      expect(projectA.content).toContain('PrivateAssets="all"');
      expect(projectA.content).toContain('IncludeAssets="runtime; build; native; contentfiles; analyzers; buildtransitive"');
      expect(projectA.content).not.toContain('Version=');
    });
  });
});
