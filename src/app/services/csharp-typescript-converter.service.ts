import { Injectable } from '@angular/core';

export interface CsharpToTypescriptOptions {
  exportType: 'interface' | 'type';
  dateTimeType: 'string' | 'Date';
}

export interface TypescriptToCsharpOptions {
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
  isOptional: boolean;
}

interface ParsedClass {
  name: string;
  properties: ParsedProperty[];
  modifiers: string[];
}

interface ParsedTypeScript {
  name: string;
  properties: ParsedProperty[];
  isInterface: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CsharpTypescriptConverterService {
  /**
   * Convert C# class to TypeScript interface/type
   */
  csharpToTypescript(csharpCode: string, options: CsharpToTypescriptOptions): string {
    try {
      const parsedClass = this.parseCsharpClass(csharpCode);
      return this.generateTypescriptDefinition(parsedClass, options);
    } catch (error) {
      throw new Error(`Failed to convert C# to TypeScript: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert TypeScript interface/type to C# class
   */
  typescriptToCsharp(typescriptCode: string, options: TypescriptToCsharpOptions): string {
    try {
      const parsed = this.parseTypescript(typescriptCode);
      let result = this.generateCsharpClass(parsed, options);
      
      // Add JsonSerializerContext if requested
      if (options.generateSerializerContext && options.serializer === 'System.Text.Json') {
        result += '\n\n' + this.generateJsonSerializerContext(parsed.name, options);
      }
      
      return result;
    } catch (error) {
      throw new Error(`Failed to convert TypeScript to C#: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse C# class code
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
          const fullType = paramMatch[1];
          const name = paramMatch[2];
          const isNullable = param.includes('?');
          properties.push({ 
            name, 
            type: fullType, 
            isNullable,
            isOptional: false 
          });
        }
      }
    } else {
      // Extract properties - improved regex to handle more cases
      const propertyRegex = /(?:public|internal|private|protected)?\s*(?:virtual|override|sealed|abstract|required)?\s*(\w+(?:<[^>]+>)?(?:\[\])?)\??\s+(\w+)\s*\{\s*get;(?:\s*(?:set|init);?)?\s*\}/g;
      
      let match;
      
      while ((match = propertyRegex.exec(cleanCode)) !== null) {
        const fullType = match[1];
        const name = match[2];
        
        // Check if nullable
        const propertyLine = cleanCode.substring(match.index, match.index + match[0].length);
        const isNullable = propertyLine.includes(`${fullType}?`) || propertyLine.includes('?');
        
        properties.push({ 
          name, 
          type: fullType, 
          isNullable,
          isOptional: false 
        });
      }
    }

    return { name: className, properties, modifiers };
  }

  /**
   * Parse TypeScript interface/type
   */
  private parseTypescript(code: string): ParsedTypeScript {
    // Remove comments
    const cleanCode = code
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');

    // Extract interface or type declaration
    const interfaceMatch = cleanCode.match(/(?:export\s+)?interface\s+(\w+)/);
    const typeMatch = cleanCode.match(/(?:export\s+)?type\s+(\w+)\s*=/);
    
    if (!interfaceMatch && !typeMatch) {
      throw new Error('Could not find interface or type declaration');
    }

    const isInterface = !!interfaceMatch;
    const name = (interfaceMatch || typeMatch)![1];

    // Extract properties
    const propertyRegex = /(\w+)(\?)?:\s*([^;,\n]+)/g;
    const properties: ParsedProperty[] = [];
    let match;
    
    while ((match = propertyRegex.exec(cleanCode)) !== null) {
      const name = match[1];
      const isOptional = !!match[2];
      let type = match[3].trim();
      
      // Remove trailing semicolon or comma
      type = type.replace(/[;,]$/, '').trim();
      
      properties.push({ 
        name, 
        type, 
        isNullable: type.includes('null') || type.includes('undefined'),
        isOptional 
      });
    }

    return { name, properties, isInterface };
  }

  /**
   * Generate TypeScript interface or type
   */
  private generateTypescriptDefinition(parsedClass: ParsedClass, options: CsharpToTypescriptOptions): string {
    const lines: string[] = [];
    
    if (options.exportType === 'interface') {
      lines.push(`export interface ${parsedClass.name} {`);
    } else {
      lines.push(`export type ${parsedClass.name} = {`);
    }

    for (const prop of parsedClass.properties) {
      const tsType = this.csharpTypeToTypescript(prop.type, options);
      const optional = prop.isNullable ? '?' : '';
      const nullableType = prop.isNullable ? ` | null` : '';
      
      lines.push(`  ${this.toCamelCase(prop.name)}${optional}: ${tsType}${nullableType};`);
    }

    if (options.exportType === 'interface') {
      lines.push('}');
    } else {
      lines.push('};');
    }

    return lines.join('\n');
  }

  /**
   * Generate C# class from TypeScript
   */
  private generateCsharpClass(parsed: ParsedTypeScript, options: TypescriptToCsharpOptions): string {
    const lines: string[] = [];

    // Add namespace if provided
    if (options.namespace) {
      lines.push(`namespace ${options.namespace};`);
      lines.push('');
    }

    // Add using statements
    if (options.serializer === 'System.Text.Json') {
      lines.push('using System.Text.Json.Serialization;');
    } else {
      lines.push('using Newtonsoft.Json;');
    }
    lines.push('');

    // Class declaration
    const classKeyword = this.getClassKeyword(options.classType);
    lines.push(`public ${classKeyword} ${parsed.name}`);
    lines.push('{');

    // Properties
    for (const prop of parsed.properties) {
      const propertyName = this.toPascalCase(prop.name);
      const csharpType = this.typescriptTypeToCsharp(prop.type, options);
      const nullable = (prop.isNullable || prop.isOptional) ? '?' : '';
      
      // Add serialization attribute if names differ or snake_case conversion
      const needsAttribute = prop.name !== propertyName || (options.convertSnakeCase && this.isSnakeCase(prop.name));
      if (needsAttribute) {
        const attributeName = options.serializer === 'System.Text.Json' ? 'JsonPropertyName' : 'JsonProperty';
        lines.push(`    [${attributeName}("${prop.name}")]`);
      }

      // Add property with appropriate accessor
      if (options.classType === 'class') {
        lines.push(`    public ${csharpType}${nullable} ${propertyName} { get; set; }`);
      } else if (options.classType.includes('record')) {
        lines.push(`    public ${csharpType}${nullable} ${propertyName} { get; init; }`);
      } else {
        lines.push(`    public ${csharpType}${nullable} ${propertyName} { get; set; }`);
      }
    }

    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Convert C# type to TypeScript type
   */
  private csharpTypeToTypescript(csharpType: string, options: CsharpToTypescriptOptions): string {
    // Handle nullable
    const isNullable = csharpType.endsWith('?');
    const baseType = isNullable ? csharpType.slice(0, -1) : csharpType;

    // Handle arrays
    if (baseType.endsWith('[]')) {
      const elementType = baseType.slice(0, -2);
      return `${this.csharpTypeToTypescript(elementType, options)}[]`;
    }

    // Handle generic collections
    const listMatch = baseType.match(/(?:List|IEnumerable|ICollection|IReadOnlyCollection|IReadOnlyList)<(.+)>/);
    if (listMatch) {
      const elementType = listMatch[1];
      return `${this.csharpTypeToTypescript(elementType, options)}[]`;
    }

    // Handle Dictionary
    const dictMatch = baseType.match(/(?:Dictionary|IDictionary)<(.+),\s*(.+)>/);
    if (dictMatch) {
      const keyType = this.csharpTypeToTypescript(dictMatch[1], options);
      const valueType = this.csharpTypeToTypescript(dictMatch[2], options);
      return `Record<${keyType}, ${valueType}>`;
    }

    // Basic type mappings
    switch (baseType) {
      case 'string':
        return 'string';
      case 'int':
      case 'long':
      case 'short':
      case 'byte':
      case 'decimal':
      case 'double':
      case 'float':
        return 'number';
      case 'bool':
        return 'boolean';
      case 'DateTime':
      case 'DateTimeOffset':
        return options.dateTimeType === 'Date' ? 'Date' : 'string';
      case 'Guid':
        return 'string';
      case 'object':
        return 'any';
      case 'void':
        return 'void';
      default:
        // Assume it's a custom type
        return baseType;
    }
  }

  /**
   * Convert TypeScript type to C# type
   */
  private typescriptTypeToCsharp(tsType: string, options: TypescriptToCsharpOptions): string {
    // Remove null/undefined from union types
    let baseType = tsType.replace(/\s*\|\s*null/g, '').replace(/\s*\|\s*undefined/g, '').trim();

    // Handle arrays
    if (baseType.endsWith('[]')) {
      const elementType = baseType.slice(0, -2);
      const csharpElementType = this.typescriptTypeToCsharp(elementType, options);
      return this.getCollectionType(csharpElementType, options.enumerationType);
    }

    // Handle Array<T>
    const arrayMatch = baseType.match(/Array<(.+)>/);
    if (arrayMatch) {
      const elementType = arrayMatch[1];
      const csharpElementType = this.typescriptTypeToCsharp(elementType, options);
      return this.getCollectionType(csharpElementType, options.enumerationType);
    }

    // Handle Record<K, V>
    const recordMatch = baseType.match(/Record<(.+),\s*(.+)>/);
    if (recordMatch) {
      const keyType = this.typescriptTypeToCsharp(recordMatch[1], options);
      const valueType = this.typescriptTypeToCsharp(recordMatch[2], options);
      return `Dictionary<${keyType}, ${valueType}>`;
    }

    // Basic type mappings
    switch (baseType) {
      case 'string':
        return 'string';
      case 'number':
        return 'int';
      case 'boolean':
        return 'bool';
      case 'Date':
        return 'DateTime';
      case 'any':
      case 'unknown':
        return 'object';
      case 'void':
        return 'void';
      default:
        // Assume it's a custom type
        return this.toPascalCase(baseType);
    }
  }

  /**
   * Get class keyword based on type
   */
  private getClassKeyword(classType: string): string {
    return classType;
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
   * Convert to camelCase
   */
  private toCamelCase(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }

  /**
   * Convert to PascalCase
   */
  private toPascalCase(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
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
  private generateJsonSerializerContext(className: string, options: TypescriptToCsharpOptions): string {
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
