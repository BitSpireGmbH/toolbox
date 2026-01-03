import { Injectable } from '@angular/core';

export interface CsharpToTypescriptOptions {
  exportType: 'interface' | 'type';
  dateTimeType: 'string' | 'Date';
  enumMode?: 'numeric' | 'string' | 'union' | 'const';
  nullableStrategy?: 'strict' | 'optional' | 'lenient';
}

export interface TypescriptToCsharpOptions {
  classType: 'class' | 'record' | 'struct' | 'record struct' | 'readonly record struct';
  enumerationType: 'List<T>' | 'IReadOnlyCollection<T>' | 'T[]';
  serializer: 'System.Text.Json' | 'Newtonsoft.Json';
  namespace?: string;
  convertSnakeCase?: boolean;
  generateSerializerContext?: boolean;
  nullableStrategy?: 'strict' | 'optional' | 'lenient';
  enumMode?: 'numeric' | 'string' | 'union' | 'const';
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
  isEnum?: boolean;
  enumMembers?: ParsedEnumMember[];
  baseClass?: string;
}

interface ParsedTypeScript {
  name: string;
  properties: ParsedProperty[];
  isInterface: boolean;
  isEnum?: boolean;
  enumMembers?: ParsedEnumMember[];
  isUnion?: boolean;
  unionTypes?: string[];
  discriminator?: string;
}

interface ParsedEnumMember {
  name: string;
  value?: string | number;
}

@Injectable({
  providedIn: 'root'
})
export class CsharpTypescriptConverterService {
  private static readonly PRIMITIVE_TYPES = ['string', 'number', 'boolean', 'any', 'unknown', 'void', 'null', 'undefined', 'object'];

  /**
   * Convert C# class to TypeScript interface/type
   */
  csharpToTypescript(csharpCode: string, options: CsharpToTypescriptOptions): string {
    try {
      const parsedClass = this.parseCsharpClass(csharpCode);
      
      // Handle enum conversion
      if (parsedClass.isEnum) {
        return this.generateTypescriptEnum(parsedClass, options);
      }
      
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
      
      // Handle enum conversion
      if (parsed.isEnum) {
        return this.generateCsharpEnum(parsed, options);
      }
      
      // Handle union type conversion
      if (parsed.isUnion) {
        return this.generateCsharpFromUnion(parsed, options);
      }
      
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

    // Check if it's an enum
    const enumMatch = cleanCode.match(/(?:public|internal|private|protected)?\s*enum\s+(\w+)/);
    if (enumMatch) {
      return this.parseCsharpEnum(cleanCode, enumMatch[1]);
    }

    // Extract class declaration
    const classMatch = cleanCode.match(/(?:public|internal|private|protected)?\s*(sealed|abstract)?\s*(class|record(?:\s+class)?|struct|record\s+struct|readonly\s+record\s+struct)\s+(\w+)(?:\s*:\s*(\w+))?/);
    if (!classMatch) {
      throw new Error('Could not find class declaration');
    }

    const modifiers = [classMatch[1], classMatch[2]].filter(Boolean);
    const className = classMatch[3];
    const baseClass = classMatch[4];

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

    return { name: className, properties, modifiers, baseClass };
  }

  /**
   * Parse TypeScript interface/type
   */
  private parseTypescript(code: string): ParsedTypeScript {
    // Remove comments
    const cleanCode = code
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');

    // Check for enum
    const enumMatch = cleanCode.match(/(?:export\s+)?(?:(const)\s+)?enum\s+(\w+)/);
    if (enumMatch) {
      const isConst = !!enumMatch[1];
      const enumName = enumMatch[2];
      return this.parseTypescriptEnum(cleanCode, enumName, isConst);
    }

    // Extract interface or type declaration
    const interfaceMatch = cleanCode.match(/(?:export\s+)?interface\s+(\w+)/);
    const typeMatch = cleanCode.match(/(?:export\s+)?type\s+(\w+)\s*=/);

    if (!interfaceMatch && !typeMatch) {
      throw new Error('Could not find interface or type declaration');
    }

    const isInterface = !!interfaceMatch;
    const match = interfaceMatch || typeMatch;
    if (!match) {
      throw new Error('Could not find interface or type declaration');
    }
    const name = match[1];

    // Check for union type
    if (typeMatch) {
      const unionMatch = cleanCode.match(/type\s+\w+\s*=\s*([^{;]+);/);
      if (unionMatch) {
        const unionContent = unionMatch[1].trim();
        // Check if it's a union type (contains |)
        if (unionContent.includes('|')) {
          // Check if it's a string literal union
          if (unionContent.includes('"') || unionContent.includes("'")) {
            const unionTypes = unionContent
              .split('|')
              .map(t => t.trim())
              .filter(t => t.startsWith('"') || t.startsWith("'"))
              .map(t => t.replace(/["']/g, ''));
            
            if (unionTypes.length > 0) {
              return {
                name,
                properties: [],
                isInterface: false,
                isUnion: true,
                unionTypes
              };
            }
          } else {
            // Mixed type union (e.g., string | number)
            const unionTypes = unionContent
              .split('|')
              .map(t => t.trim());
            
            return {
              name,
              properties: [],
              isInterface: false,
              isUnion: true,
              unionTypes
            };
          }
        }
      }
    }

    // Extract properties
    const propertyRegex = /(\w+)(\?)?:\s*((?:Record<[^>]+>|Array<[^>]+>|[^;,\n]+))/g;
    const properties: ParsedProperty[] = [];
    let match;

    while ((match = propertyRegex.exec(cleanCode)) !== null) {
      const name = match[1];
      const isOptional = !!match[2];
      let type = match[3].trim();

      // Remove trailing semicolon or comma if it's not part of Record/Array
      if (!type.includes('<')) {
        type = type.replace(/[;,]$/, '').trim();
      } else {
        // More robust trailing character removal for generic types
        type = type.replace(/[;,]\s*$/, '').trim();
      }

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
      const nullableStrategy = options.nullableStrategy || 'strict';
      
      let optional = '';
      let nullableType = '';
      
      if (prop.isNullable) {
        switch (nullableStrategy) {
          case 'strict':
            // Preserve null exactly: name: string | null
            nullableType = ' | null';
            break;
          case 'optional':
            // Convert to optional: name?: string | null | undefined
            optional = '?';
            nullableType = ' | null | undefined';
            break;
          case 'lenient':
            // Ignore nullability: name: string
            break;
        }
      }

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
    const nullableStrategy = options.nullableStrategy || 'strict';
    
    for (const prop of parsed.properties) {
      const propertyName = this.toPascalCase(prop.name);
      const csharpType = this.typescriptTypeToCsharp(prop.type, options);
      
      let nullable = '';
      const shouldBeNullable = prop.isNullable || prop.isOptional;
      
      if (shouldBeNullable) {
        switch (nullableStrategy) {
          case 'strict':
            // Preserve nullability
            nullable = '?';
            break;
          case 'optional':
            // Treat optional as nullable
            nullable = '?';
            break;
          case 'lenient':
            // Ignore nullability
            break;
        }
      }

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
    const baseType = tsType.replace(/\s*\|\s*null/g, '').replace(/\s*\|\s*undefined/g, '').trim();

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
  private generateJsonSerializerContext(className: string, _options: TypescriptToCsharpOptions): string {
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

  /**
   * Parse C# enum
   */
  private parseCsharpEnum(code: string, enumName: string): ParsedClass {
    const members: ParsedEnumMember[] = [];
    
    // Extract enum body
    const enumBodyMatch = code.match(/enum\s+\w+\s*\{([^}]+)\}/);
    if (!enumBodyMatch) {
      throw new Error('Could not parse enum body');
    }
    
    const body = enumBodyMatch[1];
    const memberLines = body.split(',').map(l => l.trim()).filter(l => l.length > 0);
    
    for (let i = 0; i < memberLines.length; i++) {
      const line = memberLines[i];
      const assignmentMatch = line.match(/(\w+)\s*=\s*(.+)/);
      
      if (assignmentMatch) {
        const name = assignmentMatch[1];
        const value = assignmentMatch[2].trim();
        // Try to parse as number, otherwise keep as string
        const numValue = Number.parseInt(value, 10);
        members.push({
          name,
          value: isNaN(numValue) ? value.replace(/['"]/g, '') : numValue
        });
      } else {
        // No explicit value, use auto-increment
        members.push({
          name: line,
          value: i
        });
      }
    }
    
    return {
      name: enumName,
      properties: [],
      modifiers: [],
      isEnum: true,
      enumMembers: members
    };
  }

  /**
   * Parse TypeScript enum
   */
  private parseTypescriptEnum(code: string, enumName: string, _isConst: boolean): ParsedTypeScript {
    const members: ParsedEnumMember[] = [];
    
    // Extract enum body
    const enumBodyMatch = code.match(/enum\s+\w+\s*\{([^}]+)\}/);
    if (!enumBodyMatch) {
      throw new Error('Could not parse enum body');
    }
    
    const body = enumBodyMatch[1];
    const memberLines = body.split(',').map(l => l.trim()).filter(l => l.length > 0);
    
    for (const line of memberLines) {
      const assignmentMatch = line.match(/(\w+)\s*=\s*(.+)/);
      
      if (assignmentMatch) {
        const name = assignmentMatch[1];
        const value = assignmentMatch[2].trim();
        // Remove quotes if string, otherwise parse as number
        if (value.startsWith('"') || value.startsWith("'")) {
          members.push({
            name,
            value: value.replace(/['"]/g, '')
          });
        } else {
          const numValue = Number.parseInt(value, 10);
          members.push({
            name,
            value: isNaN(numValue) ? value : numValue
          });
        }
      } else {
        // No explicit value
        members.push({ name: line });
      }
    }
    
    return {
      name: enumName,
      properties: [],
      isInterface: false,
      isEnum: true,
      enumMembers: members
    };
  }

  /**
   * Generate TypeScript enum from C# enum
   */
  private generateTypescriptEnum(parsedClass: ParsedClass, options: CsharpToTypescriptOptions): string {
    const enumMode = options.enumMode || 'numeric';
    const lines: string[] = [];
    
    if (!parsedClass.enumMembers || parsedClass.enumMembers.length === 0) {
      throw new Error('No enum members found');
    }
    
    switch (enumMode) {
      case 'numeric':
        lines.push(`export enum ${parsedClass.name} {`);
        for (const member of parsedClass.enumMembers) {
          const value = typeof member.value === 'number' ? member.value : parsedClass.enumMembers.indexOf(member);
          lines.push(`  ${member.name} = ${value},`);
        }
        lines.push('}');
        break;
        
      case 'string':
        lines.push(`export enum ${parsedClass.name} {`);
        for (const member of parsedClass.enumMembers) {
          lines.push(`  ${member.name} = "${member.name}",`);
        }
        lines.push('}');
        break;
        
      case 'union': {
        const unionMembers = parsedClass.enumMembers.map(m => `"${m.name}"`).join(' | ');
        lines.push(`export type ${parsedClass.name} = ${unionMembers};`);
        break;
      }
        
      case 'const':
        lines.push(`export const enum ${parsedClass.name} {`);
        for (const member of parsedClass.enumMembers) {
          lines.push(`  ${member.name} = "${member.name}",`);
        }
        lines.push('}');
        break;
    }
    
    return lines.join('\n');
  }

  /**
   * Generate C# enum from TypeScript enum or union
   */
  private generateCsharpEnum(parsed: ParsedTypeScript, options: TypescriptToCsharpOptions): string {
    const lines: string[] = [];
    
    // Add namespace if provided
    if (options.namespace) {
      lines.push(`namespace ${options.namespace};`);
      lines.push('');
    }
    
    if (!parsed.enumMembers || parsed.enumMembers.length === 0) {
      throw new Error('No enum members found');
    }
    
    // Determine if it's a string or numeric enum
    const hasStringValues = parsed.enumMembers.some(m => typeof m.value === 'string');
    
    if (hasStringValues) {
      // String enum - need to use System.Text.Json or Newtonsoft attributes
      if (options.serializer === 'System.Text.Json') {
        lines.push('using System.Text.Json.Serialization;');
        lines.push('');
        lines.push(`[JsonConverter(typeof(JsonStringEnumConverter))]`);
      } else {
        lines.push('using Newtonsoft.Json;');
        lines.push('using Newtonsoft.Json.Converters;');
        lines.push('');
        lines.push(`[JsonConverter(typeof(StringEnumConverter))]`);
      }
    }
    
    lines.push(`public enum ${parsed.name}`);
    lines.push('{');
    
    for (const member of parsed.enumMembers) {
      if (member.value !== undefined && typeof member.value === 'number') {
        lines.push(`    ${member.name} = ${member.value},`);
      } else {
        lines.push(`    ${member.name},`);
      }
    }
    
    lines.push('}');
    
    return lines.join('\n');
  }

  /**
   * Generate C# from TypeScript union type
   */
  private generateCsharpFromUnion(parsed: ParsedTypeScript, options: TypescriptToCsharpOptions): string {
    if (!parsed.unionTypes || parsed.unionTypes.length === 0) {
      throw new Error('No union types found');
    }
    
    const lines: string[] = [];
    
    // Add namespace if provided
    if (options.namespace) {
      lines.push(`namespace ${options.namespace};`);
      lines.push('');
    }
    
    // Check if all union members are string literals (identifiers without primitives)
    const hasPrimitives = parsed.unionTypes.some(t => CsharpTypescriptConverterService.PRIMITIVE_TYPES.includes(t.toLowerCase()));
    
    if (hasPrimitives) {
      // Mixed types - return object with warning comment
      lines.push('// WARNING: Lossy conversion - TypeScript union type cannot be fully represented in C#');
      lines.push('// Consider using a discriminated union pattern or separate types');
      lines.push(`// Original TypeScript: type ${parsed.name} = ${parsed.unionTypes.join(' | ')}`);
      lines.push('');
      lines.push(`public class ${parsed.name}`);
      lines.push('{');
      lines.push('    // Union type represented as object - implement custom converter as needed');
      lines.push('}');
    } else {
      // All identifiers - convert to enum
      if (options.serializer === 'System.Text.Json') {
        lines.push('using System.Text.Json.Serialization;');
        lines.push('');
        lines.push(`[JsonConverter(typeof(JsonStringEnumConverter))]`);
      } else {
        lines.push('using Newtonsoft.Json;');
        lines.push('using Newtonsoft.Json.Converters;');
        lines.push('');
        lines.push(`[JsonConverter(typeof(StringEnumConverter))]`);
      }
      
      lines.push(`public enum ${parsed.name}`);
      lines.push('{');
      
      for (const type of parsed.unionTypes) {
        lines.push(`    ${type},`);
      }
      
      lines.push('}');
    }
    
    return lines.join('\n');
  }
}
