import { describe, it, expect, beforeEach } from 'vitest';
import { CsharpJsonConverterService } from './csharp-json-converter.service';

describe('CsharpJsonConverterService', () => {
  let service: CsharpJsonConverterService;

  beforeEach(() => {
    service = new CsharpJsonConverterService();
  });

  describe('csharpToJson', () => {
    it('should convert simple class to JSON', () => {
      const csharpCode = `
        public class Person
        {
            public string Name { get; set; }
            public int Age { get; set; }
        }
      `;

      const result = service.csharpToJson(csharpCode);
      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty('name');
      expect(parsed).toHaveProperty('age');
      expect(typeof parsed.name).toBe('string');
      expect(typeof parsed.age).toBe('number');
    });

    it('should handle nullable properties', () => {
      const csharpCode = `
        public class Person
        {
            public string? Name { get; set; }
            public int? Age { get; set; }
        }
      `;

      const result = service.csharpToJson(csharpCode);
      const parsed = JSON.parse(result);

      expect(parsed.name).toBeNull();
      expect(parsed.age).toBeNull();
    });

    it('should handle record types', () => {
      const csharpCode = `
        public record Person(string Name, int Age);
      `;

      const result = service.csharpToJson(csharpCode);
      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty('name');
      expect(parsed).toHaveProperty('age');
    });

    it('should handle sealed classes', () => {
      const csharpCode = `
        public sealed class Person
        {
            public string Name { get; set; }
        }
      `;

      const result = service.csharpToJson(csharpCode);
      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty('name');
    });

    it('should handle readonly record struct', () => {
      const csharpCode = `
        public readonly record struct Point
        {
            public int X { get; init; }
            public int Y { get; init; }
        }
      `;

      const result = service.csharpToJson(csharpCode);
      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty('x');
      expect(parsed).toHaveProperty('y');
    });

    it('should handle DateTime properties', () => {
      const csharpCode = `
        public class Event
        {
            public DateTime CreatedAt { get; set; }
            public DateTimeOffset UpdatedAt { get; set; }
        }
      `;

      const result = service.csharpToJson(csharpCode);
      const parsed = JSON.parse(result);

      expect(parsed.createdAt).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(parsed.updatedAt).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should handle collections', () => {
      const csharpCode = `
        public class Team
        {
            public List<string> Members { get; set; }
            public int[] Scores { get; set; }
        }
      `;

      const result = service.csharpToJson(csharpCode);
      const parsed = JSON.parse(result);

      expect(Array.isArray(parsed.members)).toBe(true);
      expect(Array.isArray(parsed.scores)).toBe(true);
    });

    it('should handle Guid properties', () => {
      const csharpCode = `
        public class Entity
        {
            public Guid Id { get; set; }
        }
      `;

      const result = service.csharpToJson(csharpCode);
      const parsed = JSON.parse(result);

      expect(parsed.id).toBe('00000000-0000-0000-0000-000000000000');
    });
  });

  describe('jsonToCsharp', () => {
    it('should convert simple JSON to class', () => {
      const json = JSON.stringify({ name: 'John', age: 30 });
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const
      };

      const result = service.jsonToCsharp(json, options, 'Person');

      expect(result).toContain('public class Person');
      expect(result).toContain('public string Name { get; set; }');
      expect(result).toContain('public int Age { get; set; }');
      expect(result).toContain('[JsonPropertyName("name")]');
    });

    it('should generate record type', () => {
      const json = JSON.stringify({ name: 'John', age: 30 });
      const options = {
        classType: 'record' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const
      };

      const result = service.jsonToCsharp(json, options, 'Person');

      expect(result).toContain('public record Person');
      expect(result).toContain('{ get; init; }');
    });

    it('should generate record struct', () => {
      const json = JSON.stringify({ x: 10, y: 20 });
      const options = {
        classType: 'record struct' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const
      };

      const result = service.jsonToCsharp(json, options, 'Point');

      expect(result).toContain('public record struct Point');
      expect(result).toContain('{ get; init; }');
    });

    it('should generate readonly record struct', () => {
      const json = JSON.stringify({ x: 10, y: 20 });
      const options = {
        classType: 'readonly record struct' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const
      };

      const result = service.jsonToCsharp(json, options, 'Point');

      expect(result).toContain('public readonly record struct Point');
    });

    it('should use Newtonsoft.Json attributes', () => {
      const json = JSON.stringify({ name: 'John' });
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'Newtonsoft.Json' as const
      };

      const result = service.jsonToCsharp(json, options, 'Person');

      expect(result).toContain('using Newtonsoft.Json;');
      expect(result).toContain('[JsonProperty("name")]');
    });

    it('should handle arrays with List<T>', () => {
      const json = JSON.stringify({ items: ['a', 'b', 'c'] });
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const
      };

      const result = service.jsonToCsharp(json, options, 'Container');

      expect(result).toContain('List<string>');
    });

    it('should handle arrays with IReadOnlyCollection<T>', () => {
      const json = JSON.stringify({ items: [1, 2, 3] });
      const options = {
        classType: 'class' as const,
        enumerationType: 'IReadOnlyCollection<T>' as const,
        serializer: 'System.Text.Json' as const
      };

      const result = service.jsonToCsharp(json, options, 'Container');

      expect(result).toContain('IReadOnlyCollection<int>');
    });

    it('should handle arrays with IReadOnlyList<T>', () => {
      const json = JSON.stringify({ items: [1, 2, 3] });
      const options = {
        classType: 'class' as const,
        enumerationType: 'IReadOnlyList<T>' as const,
        serializer: 'System.Text.Json' as const
      };

      const result = service.jsonToCsharp(json, options, 'Container');

      expect(result).toContain('IReadOnlyList<int>');
    });

    it('should handle arrays with T[]', () => {
      const json = JSON.stringify({ items: [1.5, 2.5] });
      const options = {
        classType: 'class' as const,
        enumerationType: 'T[]' as const,
        serializer: 'System.Text.Json' as const
      };

      const result = service.jsonToCsharp(json, options, 'Container');

      expect(result).toContain('double[]');
    });

    it('should detect DateTime from ISO string', () => {
      const json = JSON.stringify({ created: '2025-12-29T10:30:00Z' });
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const
      };

      const result = service.jsonToCsharp(json, options, 'Event');

      expect(result).toContain('DateTime Created');
    });

    it('should detect Guid from string', () => {
      const json = JSON.stringify({ id: '550e8400-e29b-41d4-a716-446655440000' });
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const
      };

      const result = service.jsonToCsharp(json, options, 'Entity');

      expect(result).toContain('Guid Id');
    });

    it('should handle boolean values', () => {
      const json = JSON.stringify({ isActive: true });
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const
      };

      const result = service.jsonToCsharp(json, options, 'Status');

      expect(result).toContain('bool IsActive');
    });

    it('should add namespace when provided', () => {
      const json = JSON.stringify({ name: 'John' });
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const,
        namespace: 'MyApp.Models'
      };

      const result = service.jsonToCsharp(json, options, 'Person');

      expect(result).toContain('namespace MyApp.Models;');
    });

    it('should handle null values', () => {
      const json = JSON.stringify({ name: null, age: null });
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const
      };

      const result = service.jsonToCsharp(json, options, 'Person');

      expect(result).toContain('object?');
    });

    it('should handle empty arrays', () => {
      const json = JSON.stringify({ items: [] });
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const
      };

      const result = service.jsonToCsharp(json, options, 'Container');

      expect(result).toContain('List<string>');
    });

    it('should handle struct type', () => {
      const json = JSON.stringify({ x: 1, y: 2 });
      const options = {
        classType: 'struct' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const
      };

      const result = service.jsonToCsharp(json, options, 'Point');

      expect(result).toContain('public struct Point');
      expect(result).toContain('{ get; set; }');
    });

    it('should handle root-level array without wrapping', () => {
      const json = JSON.stringify([{ test: 'value' }]);
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const,
        wrapRootArray: false
      };

      const result = service.jsonToCsharp(json, options);

      expect(result).toContain('public class RootArrayItem');
      expect(result).toContain('public required string Test { get; set; }');
      expect(result).toContain('// Root is an array');
    });

    it('should handle root-level array with wrapping', () => {
      const json = JSON.stringify([{ test: 'value' }]);
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const,
        wrapRootArray: true
      };

      const result = service.jsonToCsharp(json, options);

      expect(result).toContain('public class RootArray');
      expect(result).toContain('[JsonPropertyName("items")]');
      expect(result).toContain('List<');
    });

    it('should detect nullable properties from array context', () => {
      const json = JSON.stringify([
        { test: 'value' },
        { test: null }
      ]);
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const,
        wrapRootArray: false
      };

      const result = service.jsonToCsharp(json, options);

      expect(result).toContain('public required string? Test { get; set; }');
    });

    it('should detect required properties', () => {
      const json = JSON.stringify([
        { foo: 'test', bar: 'test' },
        { foo: null }
      ]);
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const,
        wrapRootArray: false
      };

      const result = service.jsonToCsharp(json, options);

      expect(result).toContain('public required string? Foo { get; set; }');
      expect(result).toContain('public string Bar { get; set; }');
      expect(result).not.toContain('public required string Bar');
    });

    it('should skip JsonPropertyName with useWebDefaults for camelCase properties', () => {
      const json = JSON.stringify({ property: 'foo' });
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const,
        useWebDefaults: true
      };

      const result = service.jsonToCsharp(json, options);

      expect(result).not.toContain('[JsonPropertyName("property")]');
      expect(result).toContain('public string Property { get; set; }');
    });

    it('should include JsonPropertyName with useWebDefaults false', () => {
      const json = JSON.stringify({ property: 'foo' });
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const,
        useWebDefaults: false
      };

      const result = service.jsonToCsharp(json, options);

      expect(result).toContain('[JsonPropertyName("property")]');
      expect(result).toContain('public string Property { get; set; }');
    });

    it('should keep required keyword with useWebDefaults', () => {
      const json = JSON.stringify([
        { foo: 'test', bar: 'test' },
        { foo: null }
      ]);
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const,
        wrapRootArray: false,
        useWebDefaults: true
      };

      const result = service.jsonToCsharp(json, options);

      expect(result).toContain('public required string? Foo { get; set; }');
      expect(result).not.toContain('[JsonPropertyName("foo")]');
      expect(result).not.toContain('[JsonPropertyName("bar")]');
    });

    it('should use custom root class name', () => {
      const json = JSON.stringify({ name: 'John' });
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const,
        rootClassName: 'CustomRoot'
      };

      const result = service.jsonToCsharp(json, options);

      expect(result).toContain('public class CustomRoot');
    });

    it('should use custom root class name for arrays', () => {
      const json = JSON.stringify([{ test: 'value' }]);
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const,
        wrapRootArray: false,
        rootClassName: 'MyArray'
      };

      const result = service.jsonToCsharp(json, options);

      expect(result).toContain('MyArrayItem');
    });

    it('should handle nullable int types', () => {
      const json = JSON.stringify([
        { count: 5 },
        { count: null }
      ]);
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const,
        wrapRootArray: false
      };

      const result = service.jsonToCsharp(json, options);

      expect(result).toContain('public required int? Count { get; set; }');
    });

    it('should handle nullable bool types', () => {
      const json = JSON.stringify([
        { active: true },
        { active: null }
      ]);
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const,
        wrapRootArray: false
      };

      const result = service.jsonToCsharp(json, options);

      expect(result).toContain('public required bool? Active { get; set; }');
    });

    it('should handle nullable DateTime types', () => {
      const json = JSON.stringify([
        { created: '2025-12-29T10:30:00Z' },
        { created: null }
      ]);
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const,
        wrapRootArray: false
      };

      const result = service.jsonToCsharp(json, options);

      expect(result).toContain('public required DateTime? Created { get; set; }');
    });

    it('should handle nullable Guid types', () => {
      const json = JSON.stringify([
        { id: '550e8400-e29b-41d4-a716-446655440000' },
        { id: null }
      ]);
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const,
        wrapRootArray: false
      };

      const result = service.jsonToCsharp(json, options);

      expect(result).toContain('public required Guid? Id { get; set; }');
    });

    it('should handle empty root array', () => {
      const json = JSON.stringify([]);
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const,
        wrapRootArray: false
      };

      const result = service.jsonToCsharp(json, options);

      expect(result).toContain('// Root is an empty array');
    });
  });

  describe('naming policy', () => {
    const BASE = {
      classType: 'class' as const,
      enumerationType: 'List<T>' as const,
      serializer: 'System.Text.Json' as const,
    };

    it('trusts the runtime map over its own approximation', () => {
      // The whole point of involving .NET: real camelCase turns IPAddress into
      // ipAddress, so the payload key matches and no attribute is needed. The local
      // approximation says iPAddress and would wrongly emit one.
      const json = JSON.stringify({ ipAddress: '10.0.0.1' });
      const naming = new Map([['IpAddress', 'ipAddress']]);

      const result = service.jsonToCsharp(json, { ...BASE, useWebDefaults: true }, undefined, naming);

      expect(result).not.toContain('[JsonPropertyName');
    });

    it('emits the attribute when the real policy disagrees with the payload', () => {
      const json = JSON.stringify({ IPAddress: '10.0.0.1' });
      const naming = new Map([['IPAddress', 'ipAddress']]);

      const result = service.jsonToCsharp(json, { ...BASE, useWebDefaults: true }, undefined, naming);

      expect(result).toContain('[JsonPropertyName("IPAddress")]');
    });

    it('applies snake_case names from the runtime', () => {
      const json = JSON.stringify({ first_name: 'John' });
      const naming = new Map([['FirstName', 'first_name']]);

      const result = service.jsonToCsharp(
        json,
        { ...BASE, namingPolicy: 'SnakeCaseLower' },
        undefined,
        naming
      );

      expect(result).not.toContain('[JsonPropertyName');
      expect(result).toContain('public string FirstName { get; set; }');
    });

    it('writes the chosen policy into the generated serializer context', () => {
      const json = JSON.stringify({ first_name: 'John' });

      const result = service.jsonToCsharp(json, {
        ...BASE,
        namingPolicy: 'SnakeCaseLower',
        generateSerializerContext: true,
      });

      expect(result).toContain('PropertyNamingPolicy = JsonKnownNamingPolicy.SnakeCaseLower');
    });

    it('maps the verbatim policy onto JsonKnownNamingPolicy.Unspecified', () => {
      const json = JSON.stringify({ Name: 'John' });

      const result = service.jsonToCsharp(json, {
        ...BASE,
        namingPolicy: 'None',
        generateSerializerContext: true,
      });

      expect(result).toContain('PropertyNamingPolicy = JsonKnownNamingPolicy.Unspecified');
    });

    describe('effectiveNamingPolicy', () => {
      it('is camelCase under JsonSerializerOptions.Web', () => {
        expect(service.effectiveNamingPolicy({ ...BASE, useWebDefaults: true })).toBe('CamelCase');
      });

      it('is verbatim for Newtonsoft, which this tool does not resolve', () => {
        expect(
          service.effectiveNamingPolicy({
            ...BASE,
            serializer: 'Newtonsoft.Json',
            namingPolicy: 'CamelCase',
          })
        ).toBe('None');
      });
    });

    describe('unresolvableNames', () => {
      it('asks for nothing when no policy is in force', () => {
        expect(service.unresolvableNames(['IPAddress', 'Name'], 'None')).toEqual([]);
      });

      it('asks only about names the local camelCase rule gets wrong', () => {
        // Single leading capital: "Name" -> "name" either way, so .NET adds nothing.
        expect(service.unresolvableNames(['Name', 'FirstName', 'IPAddress', 'ID'], 'CamelCase'))
          .toEqual(['IPAddress', 'ID']);
      });

      it('asks about every name for policies it cannot approximate at all', () => {
        expect(service.unresolvableNames(['Name', 'ID'], 'SnakeCaseLower')).toEqual(['Name', 'ID']);
      });
    });

    describe('propertyNamesFor', () => {
      it('collects keys from nested objects and arrays', () => {
        const json = JSON.stringify({ ipAddress: '1', child: { deepKey: [{ leaf: 1 }] } });

        const names = service.propertyNamesFor(json);

        expect(names).toContain('IpAddress');
        expect(names).toContain('DeepKey');
        expect(names).toContain('Leaf');
      });

      it('includes the name wrapRootArray invents', () => {
        expect(service.propertyNamesFor('[]')).toContain('Items');
      });

      it('returns nothing for unparseable JSON rather than throwing', () => {
        expect(service.propertyNamesFor('not json')).toEqual([]);
      });
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid C# code', () => {
      expect(() => {
        service.csharpToJson('invalid code');
      }).toThrow();
    });

    it('should throw error for invalid JSON', () => {
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const
      };

      expect(() => {
        service.jsonToCsharp('invalid json', options);
      }).toThrow();
    });
  });
});
