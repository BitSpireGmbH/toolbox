import { describe, it, expect } from 'vitest';
import { CsharpTypescriptConverterService } from './csharp-typescript-converter.service';

describe('CsharpTypescriptConverterService', () => {
  let service: CsharpTypescriptConverterService;

  beforeEach(() => {
    service = new CsharpTypescriptConverterService();
  });

  describe('csharpToTypescript', () => {
    it('should convert simple class to interface', () => {
      const csharpCode = `
        public class Person
        {
            public string Name { get; set; }
            public int Age { get; set; }
        }
      `;
      const options = { exportType: 'interface' as const, dateTimeType: 'string' as const };

      const result = service.csharpToTypescript(csharpCode, options);

      expect(result).toContain('export interface Person');
      expect(result).toContain('name: string');
      expect(result).toContain('age: number');
    });

    it('should convert class to type', () => {
      const csharpCode = `
        public class Person
        {
            public string Name { get; set; }
        }
      `;
      const options = { exportType: 'type' as const, dateTimeType: 'string' as const };

      const result = service.csharpToTypescript(csharpCode, options);

      expect(result).toContain('export type Person = {');
      expect(result).toContain('};');
    });

    it('should handle nullable properties', () => {
      const csharpCode = `
        public class Person
        {
            public string? Name { get; set; }
            public int? Age { get; set; }
        }
      `;
      const options = { exportType: 'interface' as const, dateTimeType: 'string' as const };

      const result = service.csharpToTypescript(csharpCode, options);

      expect(result).toContain('name?: string | null');
      expect(result).toContain('age?: number | null');
    });

    it('should handle DateTime as string', () => {
      const csharpCode = `
        public class Event
        {
            public DateTime CreatedAt { get; set; }
            public DateTimeOffset UpdatedAt { get; set; }
        }
      `;
      const options = { exportType: 'interface' as const, dateTimeType: 'string' as const };

      const result = service.csharpToTypescript(csharpCode, options);

      expect(result).toContain('createdAt: string');
      expect(result).toContain('updatedAt: string');
    });

    it('should handle DateTime as Date', () => {
      const csharpCode = `
        public class Event
        {
            public DateTime CreatedAt { get; set; }
        }
      `;
      const options = { exportType: 'interface' as const, dateTimeType: 'Date' as const };

      const result = service.csharpToTypescript(csharpCode, options);

      expect(result).toContain('createdAt: Date');
    });

    it('should handle record types', () => {
      const csharpCode = `
        public record Person
        {
            public string Name { get; init; }
            public int Age { get; init; }
        }
      `;
      const options = { exportType: 'interface' as const, dateTimeType: 'string' as const };

      const result = service.csharpToTypescript(csharpCode, options);

      expect(result).toContain('export interface Person');
      expect(result).toContain('name: string');
    });

    it('should handle sealed classes', () => {
      const csharpCode = `
        public sealed class Person
        {
            public string Name { get; set; }
        }
      `;
      const options = { exportType: 'interface' as const, dateTimeType: 'string' as const };

      const result = service.csharpToTypescript(csharpCode, options);

      expect(result).toContain('export interface Person');
    });

    it('should handle readonly record struct', () => {
      const csharpCode = `
        public readonly record struct Point
        {
            public int X { get; init; }
            public int Y { get; init; }
        }
      `;
      const options = { exportType: 'interface' as const, dateTimeType: 'string' as const };

      const result = service.csharpToTypescript(csharpCode, options);

      expect(result).toContain('export interface Point');
      expect(result).toContain('x: number');
      expect(result).toContain('y: number');
    });

    it('should handle List<T>', () => {
      const csharpCode = `
        public class Team
        {
            public List<string> Members { get; set; }
        }
      `;
      const options = { exportType: 'interface' as const, dateTimeType: 'string' as const };

      const result = service.csharpToTypescript(csharpCode, options);

      expect(result).toContain('members: string[]');
    });

    it('should handle arrays', () => {
      const csharpCode = `
        public class Team
        {
            public int[] Scores { get; set; }
        }
      `;
      const options = { exportType: 'interface' as const, dateTimeType: 'string' as const };

      const result = service.csharpToTypescript(csharpCode, options);

      expect(result).toContain('scores: number[]');
    });

    it('should handle IReadOnlyCollection<T>', () => {
      const csharpCode = `
        public class Team
        {
            public IReadOnlyCollection<string> Members { get; set; }
        }
      `;
      const options = { exportType: 'interface' as const, dateTimeType: 'string' as const };

      const result = service.csharpToTypescript(csharpCode, options);

      expect(result).toContain('members: string[]');
    });

    it('should handle Dictionary', () => {
      const csharpCode = `
        public class Config
        {
            public Dictionary<string, int> Settings { get; set; }
        }
      `;
      const options = { exportType: 'interface' as const, dateTimeType: 'string' as const };

      const result = service.csharpToTypescript(csharpCode, options);

      expect(result).toContain('settings: Record<string, number>');
    });

    it('should handle Guid as string', () => {
      const csharpCode = `
        public class Entity
        {
            public Guid Id { get; set; }
        }
      `;
      const options = { exportType: 'interface' as const, dateTimeType: 'string' as const };

      const result = service.csharpToTypescript(csharpCode, options);

      expect(result).toContain('id: string');
    });

    it('should handle bool as boolean', () => {
      const csharpCode = `
        public class Status
        {
            public bool IsActive { get; set; }
        }
      `;
      const options = { exportType: 'interface' as const, dateTimeType: 'string' as const };

      const result = service.csharpToTypescript(csharpCode, options);

      expect(result).toContain('isActive: boolean');
    });

    it('should handle decimal and double as number', () => {
      const csharpCode = `
        public class Metrics
        {
            public decimal Price { get; set; }
            public double Score { get; set; }
        }
      `;
      const options = { exportType: 'interface' as const, dateTimeType: 'string' as const };

      const result = service.csharpToTypescript(csharpCode, options);

      expect(result).toContain('price: number');
      expect(result).toContain('score: number');
    });
  });

  describe('typescriptToCsharp', () => {
    it('should convert interface to class', () => {
      const tsCode = `
        export interface Person {
          name: string;
          age: number;
        }
      `;
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const
      };

      const result = service.typescriptToCsharp(tsCode, options);

      expect(result).toContain('public class Person');
      expect(result).toContain('public string Name { get; set; }');
      expect(result).toContain('public int Age { get; set; }');
    });

    it('should convert type to class', () => {
      const tsCode = `
        export type Person = {
          name: string;
          age: number;
        };
      `;
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const
      };

      const result = service.typescriptToCsharp(tsCode, options);

      expect(result).toContain('public class Person');
    });

    it('should generate record type', () => {
      const tsCode = `
        interface Person {
          name: string;
          age: number;
        }
      `;
      const options = {
        classType: 'record' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const
      };

      const result = service.typescriptToCsharp(tsCode, options);

      expect(result).toContain('public record Person');
      expect(result).toContain('{ get; init; }');
    });

    it('should generate record struct', () => {
      const tsCode = `
        interface Point {
          x: number;
          y: number;
        }
      `;
      const options = {
        classType: 'record struct' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const
      };

      const result = service.typescriptToCsharp(tsCode, options);

      expect(result).toContain('public record struct Point');
    });

    it('should generate readonly record struct', () => {
      const tsCode = `
        interface Point {
          x: number;
          y: number;
        }
      `;
      const options = {
        classType: 'readonly record struct' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const
      };

      const result = service.typescriptToCsharp(tsCode, options);

      expect(result).toContain('public readonly record struct Point');
    });

    it('should handle optional properties', () => {
      const tsCode = `
        interface Person {
          name?: string;
          age: number;
        }
      `;
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const
      };

      const result = service.typescriptToCsharp(tsCode, options);

      expect(result).toContain('string? Name');
      expect(result).toContain('int Age');
    });

    it('should handle arrays with List<T>', () => {
      const tsCode = `
        interface Team {
          members: string[];
        }
      `;
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const
      };

      const result = service.typescriptToCsharp(tsCode, options);

      expect(result).toContain('List<string> Members');
    });

    it('should handle arrays with T[]', () => {
      const tsCode = `
        interface Team {
          scores: number[];
        }
      `;
      const options = {
        classType: 'class' as const,
        enumerationType: 'T[]' as const,
        serializer: 'System.Text.Json' as const
      };

      const result = service.typescriptToCsharp(tsCode, options);

      expect(result).toContain('int[] Scores');
    });

    it('should handle arrays with IReadOnlyCollection<T>', () => {
      const tsCode = `
        interface Team {
          members: string[];
        }
      `;
      const options = {
        classType: 'class' as const,
        enumerationType: 'IReadOnlyCollection<T>' as const,
        serializer: 'System.Text.Json' as const
      };

      const result = service.typescriptToCsharp(tsCode, options);

      expect(result).toContain('IReadOnlyCollection<string> Members');
    });

    it('should handle Array<T> syntax', () => {
      const tsCode = `
        interface Container {
          items: Array<string>;
        }
      `;
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const
      };

      const result = service.typescriptToCsharp(tsCode, options);

      expect(result).toContain('List<string> Items');
    });

    it('should handle Record type', () => {
      const tsCode = `
        interface Config {
          settings: Record<string, number>;
        }
      `;
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const
      };

      const result = service.typescriptToCsharp(tsCode, options);

      expect(result).toContain('Dictionary<string, int> Settings');
    });

    it('should handle Date type', () => {
      const tsCode = `
        interface Event {
          createdAt: Date;
        }
      `;
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const
      };

      const result = service.typescriptToCsharp(tsCode, options);

      expect(result).toContain('DateTime CreatedAt');
    });

    it('should handle boolean type', () => {
      const tsCode = `
        interface Status {
          isActive: boolean;
        }
      `;
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const
      };

      const result = service.typescriptToCsharp(tsCode, options);

      expect(result).toContain('bool IsActive');
    });

    it('should use Newtonsoft.Json attributes', () => {
      const tsCode = `
        interface Person {
          name: string;
        }
      `;
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'Newtonsoft.Json' as const
      };

      const result = service.typescriptToCsharp(tsCode, options);

      expect(result).toContain('using Newtonsoft.Json;');
      expect(result).toContain('[JsonProperty("name")]');
    });

    it('should add namespace when provided', () => {
      const tsCode = `
        interface Person {
          name: string;
        }
      `;
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const,
        namespace: 'MyApp.Models'
      };

      const result = service.typescriptToCsharp(tsCode, options);

      expect(result).toContain('namespace MyApp.Models;');
    });

    it('should handle null union types', () => {
      const tsCode = `
        interface Person {
          name: string | null;
        }
      `;
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const
      };

      const result = service.typescriptToCsharp(tsCode, options);

      expect(result).toContain('string? Name');
    });

    it('should handle undefined union types', () => {
      const tsCode = `
        interface Person {
          age: number | undefined;
        }
      `;
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const
      };

      const result = service.typescriptToCsharp(tsCode, options);

      expect(result).toContain('int? Age');
    });

    it('should handle struct type', () => {
      const tsCode = `
        interface Point {
          x: number;
          y: number;
        }
      `;
      const options = {
        classType: 'struct' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const
      };

      const result = service.typescriptToCsharp(tsCode, options);

      expect(result).toContain('public struct Point');
      expect(result).toContain('{ get; set; }');
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid C# code', () => {
      const options = { exportType: 'interface' as const, dateTimeType: 'string' as const };

      expect(() => {
        service.csharpToTypescript('invalid code', options);
      }).toThrow();
    });

    it('should throw error for invalid TypeScript code', () => {
      const options = {
        classType: 'class' as const,
        enumerationType: 'List<T>' as const,
        serializer: 'System.Text.Json' as const
      };

      expect(() => {
        service.typescriptToCsharp('invalid code', options);
      }).toThrow();
    });
  });
});
