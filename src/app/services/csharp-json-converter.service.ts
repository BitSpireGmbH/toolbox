import { Injectable } from '@angular/core';

export interface CsharpToJsonOptions {
  indentation?: number;
}

export interface JsonToCsharpOptions {
  classType: 'class' | 'record' | 'struct' | 'record struct' | 'readonly record struct';
  enumerationType: 'List<T>' | 'IReadOnlyCollection<T>' | 'T[]';
  serializer: 'System.Text.Json' | 'Newtonsoft.Json';
  namespace?: string;
  convertSnakeCase?: boolean;
  generateSerializerContext?: boolean;
}

interface ParsedProperty {
  name: string;
  type: string;
  isNullable: boolean;
}

interface ParsedClass {
  name: string;
  properties: ParsedProperty[];
  modifiers: string[];
}

@Injectable({
  providedIn: 'root'
})
export class CsharpJsonConverterService {
  /**
   * Convert C# class definition to JSON
   */
  csharpToJson(csharpCode: string, options: CsharpToJsonOptions = {}): string {
    const indentation = options.indentation ?? 2;
    
    try {
      const parsedClass = this.parseCsharpClass(csharpCode);
      const jsonObject = this.createJsonFromClass(parsedClass);
      return JSON.stringify(jsonObject, null, indentation);
    } catch (error) {
      throw new Error(`Failed to convert C# to JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert JSON to C# class definition
   */
  jsonToCsharp(json: string, options: JsonToCsharpOptions, className: string = 'RootObject'): string {
    try {
      const jsonObject = JSON.parse(json);
      let result = this.generateCsharpClass(jsonObject, className, options);
      
      // Add JsonSerializerContext if requested
      if (options.generateSerializerContext && options.serializer === 'System.Text.Json') {
        result += '\n\n' + this.generateJsonSerializerContext(className, options);
      }
      
      return result;
    } catch (error) {
      throw new Error(`Failed to convert JSON to C#: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse C# class code into a structured format
   */
  private parseCsharpClass(code: string): ParsedClass {
    // Remove comments
    const cleanCode = code
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');

    // Extract class declaration
    const classMatch = cleanCode.match(/(?:public|internal|private|protected)?\s*(sealed|abstract)?\s*(class|record(?:\s+class)?|struct|record\s+struct|readonly\s+record\s+struct)\s+(\w+)/);
    if (!classMatch) {
      throw new Error('Could not find class declaration');
    }

    const modifiers = [classMatch[1], classMatch[2]].filter(Boolean);
    const className = classMatch[3];

    const properties: ParsedProperty[] = [];

    // Check for primary constructor (record with parameters)
    const primaryCtorMatch = cleanCode.match(/(?:record(?:\s+class)?|readonly\s+record\s+struct|record\s+struct)\s+\w+\s*\(([^)]+)\)/);
    if (primaryCtorMatch) {
      // Parse primary constructor parameters
      const params = primaryCtorMatch[1].split(',').map(p => p.trim());
      for (const param of params) {
        const paramMatch = param.match(/(\w+(?:<[^>]+>)?(?:\[\])?)\??\s+(\w+)/);
        if (paramMatch) {
          const type = paramMatch[1];
          const name = paramMatch[2];
          const isNullable = param.includes('?');
          properties.push({ name, type, isNullable });
        }
      }
    } else {
      // Extract regular properties
      const propertyRegex = /(?:public|internal|private|protected)?\s*(virtual|override|sealed|abstract)?\s*(\w+(?:<[^>]+>)?(?:\[\])?)\??\s+(\w+)\s*\{\s*get;(?:\s*(?:set|init);?)?\s*\}/g;
      
      let match;
      while ((match = propertyRegex.exec(cleanCode)) !== null) {
        const type = match[2];
        const name = match[3];
        const isNullable = cleanCode.includes(`${type}? ${name}`) || cleanCode.includes(`${type}?${name}`);
        
        properties.push({ name, type, isNullable });
      }
    }

    return { name: className, properties, modifiers };
  }

  /**
   * Create a sample JSON object from parsed C# class
   */
  private createJsonFromClass(parsedClass: ParsedClass): Record<string, unknown> {
    const obj: Record<string, unknown> = {};

    for (const prop of parsedClass.properties) {
      obj[this.toCamelCase(prop.name)] = this.getDefaultValueForType(prop.type, prop.isNullable);
    }

    return obj;
  }

  /**
   * Get default value for a C# type
   */
  private getDefaultValueForType(type: string, isNullable: boolean): unknown {
    if (isNullable) {
      return null;
    }

    // Handle arrays
    if (type.endsWith('[]')) {
      return [];
    }

    // Handle generic collections
    if (type.startsWith('List<') || type.startsWith('IEnumerable<') || type.startsWith('ICollection<') || type.startsWith('IReadOnlyCollection<')) {
      return [];
    }

    // Handle common types
    switch (type) {
      case 'string':
        return '';
      case 'int':
      case 'long':
      case 'short':
      case 'byte':
      case 'decimal':
      case 'double':
      case 'float':
        return 0;
      case 'bool':
        return false;
      case 'DateTime':
      case 'DateTimeOffset':
        return new Date().toISOString();
      case 'Guid':
        return '00000000-0000-0000-0000-000000000000';
      default:
        return {};
    }
  }

  /**
   * Generate C# class from JSON object
   */
  private generateCsharpClass(obj: unknown, className: string, options: JsonToCsharpOptions, indent: number = 0): string {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      throw new Error('Root JSON must be an object');
    }

    const indentStr = '    '.repeat(indent);
    const lines: string[] = [];

    // Add namespace if provided
    if (indent === 0 && options.namespace) {
      lines.push(`namespace ${options.namespace};`);
      lines.push('');
    }

    // Add using statements for serializer
    if (indent === 0) {
      if (options.serializer === 'System.Text.Json') {
        lines.push('using System.Text.Json.Serialization;');
      } else {
        lines.push('using Newtonsoft.Json;');
      }
      lines.push('');
    }

    // Class declaration
    const classKeyword = this.getClassKeyword(options.classType);
    lines.push(`${indentStr}public ${classKeyword} ${className}`);
    lines.push(`${indentStr}{`);

    // Properties
    const entries = Object.entries(obj as Record<string, unknown>);
    for (const [key, value] of entries) {
      const propertyName = options.convertSnakeCase && this.isSnakeCase(key) 
        ? this.toPascalCase(key) 
        : this.toPascalCase(key);
      const propertyType = this.inferCsharpType(value, propertyName, options);
      
      // Add serialization attribute if name differs or snake_case conversion
      const needsAttribute = key !== propertyName || (options.convertSnakeCase && this.isSnakeCase(key));
      if (needsAttribute) {
        const attributeName = options.serializer === 'System.Text.Json' ? 'JsonPropertyName' : 'JsonProperty';
        lines.push(`${indentStr}    [${attributeName}("${key}")]`);
      }

      // Add property
      if (options.classType === 'class') {
        lines.push(`${indentStr}    public ${propertyType} ${propertyName} { get; set; }`);
      } else if (options.classType === 'record' || options.classType === 'record struct' || options.classType === 'readonly record struct') {
        lines.push(`${indentStr}    public ${propertyType} ${propertyName} { get; init; }`);
      } else {
        lines.push(`${indentStr}    public ${propertyType} ${propertyName} { get; set; }`);
      }
    }

    lines.push(`${indentStr}}`);

    return lines.join('\n');
  }

  /**
   * Get class keyword based on type
   */
  private getClassKeyword(classType: string): string {
    switch (classType) {
      case 'class':
        return 'class';
      case 'record':
        return 'record';
      case 'struct':
        return 'struct';
      case 'record struct':
        return 'record struct';
      case 'readonly record struct':
        return 'readonly record struct';
      default:
        return 'class';
    }
  }

  /**
   * Infer C# type from JSON value
   */
  private inferCsharpType(value: unknown, propertyName: string, options: JsonToCsharpOptions): string {
    if (value === null || value === undefined) {
      return 'object?';
    }

    if (typeof value === 'string') {
      // Check if it's a date string
      if (this.isIsoDateString(value)) {
        return 'DateTime';
      }
      // Check if it's a GUID
      if (this.isGuid(value)) {
        return 'Guid';
      }
      return 'string';
    }

    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'int' : 'double';
    }

    if (typeof value === 'boolean') {
      return 'bool';
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        // Default to string array if empty
        return this.getCollectionType('string', options.enumerationType);
      }
      
      const firstItem = value[0];
      const itemType = this.inferCsharpType(firstItem, propertyName, options);
      return this.getCollectionType(itemType, options.enumerationType);
    }

    if (typeof value === 'object') {
      // Nested object - would need recursive class generation
      return this.toPascalCase(propertyName);
    }

    return 'object';
  }

  /**
   * Get collection type syntax
   */
  private getCollectionType(itemType: string, enumerationType: string): string {
    switch (enumerationType) {
      case 'List<T>':
        return `List<${itemType}>`;
      case 'IReadOnlyCollection<T>':
        return `IReadOnlyCollection<${itemType}>`;
      case 'T[]':
        return `${itemType}[]`;
      default:
        return `List<${itemType}>`;
    }
  }

  /**
   * Check if string is ISO date format
   */
  private isIsoDateString(value: string): boolean {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    return isoDateRegex.test(value);
  }

  /**
   * Check if string is GUID format
   */
  private isGuid(value: string): boolean {
    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return guidRegex.test(value);
  }

  /**
   * Convert to camelCase
   */
  private toCamelCase(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }

  /**
   * Convert to PascalCase
   */
  private toPascalCase(str: string): string {
    return str
      .split(/[-_\s]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  /**
   * Check if string is in snake_case format
   */
  private isSnakeCase(str: string): boolean {
    return /^[a-z]+(_[a-z0-9]+)*$/.test(str);
  }

  /**
   * Generate JsonSerializerContext for System.Text.Json source generators
   */
  private generateJsonSerializerContext(className: string, options: JsonToCsharpOptions): string {
    const lines: string[] = [];
    const contextName = `${className}JsonContext`;
    
    lines.push('[JsonSourceGenerationOptions(');
    lines.push('    PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase,');
    lines.push('    GenerationMode = JsonSourceGenerationMode.Metadata)]');
    lines.push(`[JsonSerializable(typeof(${className}))]`);
    lines.push(`public partial class ${contextName} : JsonSerializerContext`);
    lines.push('{');
    lines.push('}');
    
    return lines.join('\n');
  }
}
