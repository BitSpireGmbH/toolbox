import { TestBed } from '@angular/core/testing';
import { StrongTyperConverterService, StrongTyperOptions } from './strong-typer-converter.service';

describe('StrongTyperConverterService', () => {
  let service: StrongTyperConverterService;

  const defaultOptions: StrongTyperOptions = {
    useAddOptions: true,
    validateDataAnnotations: false,
    validateOnStart: false,
    propertyInitialization: 'init',
    visibility: 'public',
    sealed: false
  };

  const sampleJson = JSON.stringify({
    "Database": {
      "ConnectionString": "Server=localhost;",
      "Timeout": 30
    }
  });

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StrongTyperConverterService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('discoverNodes', () => {
    it('should discover nodes from valid JSON', () => {
      const nodes = service.discoverNodes(sampleJson);
      expect(nodes.length).toBeGreaterThan(0);
      expect(nodes[0].key).toBe('Database');
      expect(nodes[0].className).toBe('DatabaseOptions');
    });

    it('should return empty array for invalid JSON', () => {
      const nodes = service.discoverNodes('{ invalid json }');
      expect(nodes).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      const nodes = service.discoverNodes('');
      expect(nodes).toEqual([]);
    });

    it('should parse nested objects correctly', () => {
      const json = JSON.stringify({
        "Outer": {
          "Inner": {
            "Value": "test"
          }
        }
      });
      const nodes = service.discoverNodes(json);
      expect(nodes[0].children.length).toBeGreaterThan(0);
      expect(nodes[0].children[0].key).toBe('Inner');
    });
  });

  describe('property initialization - default (init)', () => {
    it('should generate properties with get; init; by default', () => {
      const nodes = service.discoverNodes(sampleJson);
      const result = service.generate(nodes, defaultOptions);
      expect(result).toContain('{ get; init; }');
    });

    it('should not contain get; set; when init is default', () => {
      const nodes = service.discoverNodes(sampleJson);
      const result = service.generate(nodes, defaultOptions);
      expect(result).not.toContain('{ get; set; }');
    });
  });

  describe('property initialization - set (mutable)', () => {
    it('should generate properties with get; set; when configured', () => {
      const nodes = service.discoverNodes(sampleJson);
      const options: StrongTyperOptions = { ...defaultOptions, propertyInitialization: 'set' };
      const result = service.generate(nodes, options);
      expect(result).toContain('{ get; set; }');
    });

    it('should not contain get; init; when set is configured', () => {
      const nodes = service.discoverNodes(sampleJson);
      const options: StrongTyperOptions = { ...defaultOptions, propertyInitialization: 'set' };
      const result = service.generate(nodes, options);
      expect(result).not.toContain('{ get; init; }');
    });
  });

  describe('class visibility', () => {
    it('should generate public classes by default', () => {
      const nodes = service.discoverNodes(sampleJson);
      const result = service.generate(nodes, defaultOptions);
      expect(result).toMatch(/public class DatabaseOptions/);
    });

    it('should generate internal classes when visibility is internal', () => {
      const nodes = service.discoverNodes(sampleJson);
      const options: StrongTyperOptions = { ...defaultOptions, visibility: 'internal' };
      const result = service.generate(nodes, options);
      expect(result).toMatch(/internal class DatabaseOptions/);
    });

    it('should not contain internal when visibility is public', () => {
      const nodes = service.discoverNodes(sampleJson);
      const options: StrongTyperOptions = { ...defaultOptions, visibility: 'public' };
      const result = service.generate(nodes, options);
      expect(result).toMatch(/^public class/m);
    });
  });

  describe('sealed classes', () => {
    it('should generate sealed classes when sealed is true', () => {
      const nodes = service.discoverNodes(sampleJson);
      const options: StrongTyperOptions = { ...defaultOptions, sealed: true };
      const result = service.generate(nodes, options);
      expect(result).toContain('public sealed class DatabaseOptions');
    });

    it('should not generate sealed classes when sealed is false', () => {
      const nodes = service.discoverNodes(sampleJson);
      const options: StrongTyperOptions = { ...defaultOptions, sealed: false };
      const result = service.generate(nodes, options);
      expect(result).not.toContain('sealed class');
    });

    it('should combine visibility and sealed modifiers', () => {
      const nodes = service.discoverNodes(sampleJson);
      const options: StrongTyperOptions = { ...defaultOptions, visibility: 'internal', sealed: true };
      const result = service.generate(nodes, options);
      expect(result).toContain('internal sealed class DatabaseOptions');
    });
  });

  describe('configuration combinations', () => {
    it('should support init + internal + sealed', () => {
      const nodes = service.discoverNodes(sampleJson);
      const options: StrongTyperOptions = {
        useAddOptions: true,
        validateDataAnnotations: false,
        validateOnStart: false,
        propertyInitialization: 'init',
        visibility: 'internal',
        sealed: true
      };
      const result = service.generate(nodes, options);
      expect(result).toContain('internal sealed class DatabaseOptions');
      expect(result).toContain('{ get; init; }');
    });

    it('should support set + public + not sealed', () => {
      const nodes = service.discoverNodes(sampleJson);
      const options: StrongTyperOptions = {
        useAddOptions: true,
        validateDataAnnotations: false,
        validateOnStart: false,
        propertyInitialization: 'set',
        visibility: 'public',
        sealed: false
      };
      const result = service.generate(nodes, options);
      expect(result).toContain('public class DatabaseOptions');
      expect(result).not.toContain('sealed');
      expect(result).toContain('{ get; set; }');
    });

    it('should support init + public + sealed', () => {
      const nodes = service.discoverNodes(sampleJson);
      const options: StrongTyperOptions = {
        useAddOptions: true,
        validateDataAnnotations: false,
        validateOnStart: false,
        propertyInitialization: 'init',
        visibility: 'public',
        sealed: true
      };
      const result = service.generate(nodes, options);
      expect(result).toContain('public sealed class DatabaseOptions');
      expect(result).toContain('{ get; init; }');
    });
  });

  describe('integration with other options', () => {
    it('should work with AddOptions fluent API', () => {
      const nodes = service.discoverNodes(sampleJson);
      const options: StrongTyperOptions = {
        useAddOptions: true,
        validateDataAnnotations: true,
        validateOnStart: true,
        propertyInitialization: 'init',
        visibility: 'public',
        sealed: false
      };
      const result = service.generate(nodes, options);
      expect(result).toContain('AddOptions');
      expect(result).toContain('Bind');
      expect(result).toContain('ValidateDataAnnotations');
      expect(result).toContain('ValidateOnStart');
      expect(result).toContain('{ get; init; }');
    });

    it('should work with Configure method (non-fluent)', () => {
      const nodes = service.discoverNodes(sampleJson);
      const options: StrongTyperOptions = {
        useAddOptions: false,
        validateDataAnnotations: false,
        validateOnStart: false,
        propertyInitialization: 'init',
        visibility: 'internal',
        sealed: true
      };
      const result = service.generate(nodes, options);
      expect(result).toContain('Configure');
      expect(result).not.toContain('AddOptions');
      expect(result).toContain('internal sealed class');
      expect(result).toContain('{ get; init; }');
    });
  });

  describe('multiple properties', () => {
    it('should apply configuration to all properties in a class', () => {
      const json = JSON.stringify({
        "Settings": {
          "String": "value",
          "Number": 42,
          "Boolean": true
        }
      });
      const nodes = service.discoverNodes(json);
      const options: StrongTyperOptions = { ...defaultOptions, propertyInitialization: 'set' };
      const result = service.generate(nodes, options);
      const matches = (result.match(/{ get; set; }/g) || []).length;
      expect(matches).toBeGreaterThanOrEqual(3);
    });
  });

  describe('backward compatibility', () => {
    it('should provide sensible defaults for new options', () => {
      const nodes = service.discoverNodes(sampleJson);
      const options: StrongTyperOptions = {
        useAddOptions: true,
        validateDataAnnotations: false,
        validateOnStart: false,
        propertyInitialization: 'init',
        visibility: 'public',
        sealed: false
      };
      const result = service.generate(nodes, options);
      expect(result).toBeTruthy();
      expect(result).toContain('public class');
      expect(result).toContain('{ get; init; }');
      expect(result).not.toContain('sealed');
    });
  });

  describe('code generation', () => {
    it('should include SectionName constant in generated class', () => {
      const nodes = service.discoverNodes(sampleJson);
      const result = service.generate(nodes, defaultOptions);
      expect(result).toContain('public const string SectionName = "Database"');
    });

    it('should include usage example', () => {
      const nodes = service.discoverNodes(sampleJson);
      const result = service.generate(nodes, defaultOptions);
      expect(result).toContain('Usage Example');
      expect(result).toContain('MyService');
      expect(result).toContain('IOptions<DatabaseOptions>');
    });

    it('should return error message for no selected nodes', () => {
      const json = JSON.stringify({
        "SimpleValue": "not-an-object"
      });
      const nodes = service.discoverNodes(json);
      const result = service.generate(nodes, defaultOptions);
      expect(result).toContain('No objects selected');
    });
  });

  describe('Pascal case conversion', () => {
    it('should convert property names to Pascal case', () => {
      const json = JSON.stringify({
        "Settings": {
          "connection_string": "value",
          "maxPoolSize": 10
        }
      });
      const nodes = service.discoverNodes(json);
      const result = service.generate(nodes, defaultOptions);
      expect(result).toContain('ConnectionString');
      expect(result).toContain('MaxPoolSize');
    });
  });
});
