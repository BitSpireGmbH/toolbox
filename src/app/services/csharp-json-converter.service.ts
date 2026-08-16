import { Injectable } from '@angular/core';
import type { JsonNamingPolicyId, NamingMap } from './json-naming.service';

export interface CsharpToJsonOptions {
  indentation?: number;
}

export interface JsonToCsharpOptions {
  classType: 'class' | 'record' | 'struct' | 'record struct' | 'readonly record struct';
  enumerationType: 'List<T>' | 'IReadOnlyCollection<T>' | 'IReadOnlyList<T>' | 'T[]';
  serializer: 'System.Text.Json' | 'Newtonsoft.Json';
  namespace?: string;
  convertSnakeCase?: boolean;
  generateSerializerContext?: boolean;
  wrapRootArray?: boolean;
  useWebDefaults?: boolean;
  rootClassName?: string;
  /**
   * Which `System.Text.Json` naming policy the consuming app configures. Defaults to
   * `CamelCase` under {@link useWebDefaults} - that is exactly what
   * `JsonSerializerOptions.Web` sets - and to `None` otherwise, which is what the tool
   * assumed before the policy became selectable.
   */
  namingPolicy?: JsonNamingPolicyId;
}

interface ParsedProperty {
  name: string;
  type: string;
  isNullable: boolean;
  isRequired?: boolean;
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
      throw new Error(`Failed to convert C# to JSON: ${error instanceof Error ? error.message : 'Unknown error'}`, { cause: error });
    }
  }

  /**
   * The C# property names this JSON would generate, in the form a naming policy is
   * applied to. Handed to {@link JsonNamingService} so the whole payload is resolved in
   * one interop call rather than one per property.
   *
   * Deliberately collects every key anywhere in the document rather than mirroring which
   * of them {@link generateCsharpClass} actually emits. Over-asking costs nothing on a
   * batched call, and it keeps this immune to the generator's shape rules changing.
   */
  propertyNamesFor(json: string): string[] {
    const names = new Set<string>();

    const walk = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      if (typeof value !== 'object' || value === null) {
        return;
      }
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        names.add(this.toPascalCase(key));
        walk(child);
      }
    };

    try {
      walk(JSON.parse(json));
    } catch {
      // An unparseable payload has no properties to resolve yet; the conversion itself
      // reports the syntax error.
      return [];
    }

    // `wrapRootArray` invents this one rather than reading it from the payload.
    names.add('Items');
    return [...names];
  }

  /**
   * Which naming policy the generated model will be read under. `JsonSerializerOptions.Web`
   * is camelCase by definition; Newtonsoft is out of scope for policy resolution, so it
   * keeps the verbatim behaviour the tool has always had.
   */
  effectiveNamingPolicy(options: JsonToCsharpOptions): JsonNamingPolicyId {
    if (options.serializer !== 'System.Text.Json') {
      return 'None';
    }
    return options.namingPolicy ?? (options.useWebDefaults ? 'CamelCase' : 'None');
  }

  /**
   * Of `names`, the ones {@link serializedName}'s fallback cannot work out on its own -
   * in other words, the only ones worth downloading the .NET runtime for.
   *
   * This tool has never needed the runtime, and most payloads still do not: under
   * camelCase the naive rule and the real policy agree on every name except those
   * starting with a run of two or more capitals, which is precisely where `IPAddress`
   * becomes `iPAddress` instead of `ipAddress`. So the runtime is fetched when it changes
   * the output and skipped when it would only confirm it.
   *
   * Kept next to {@link serializedName} on purpose: the two encode the same rule from
   * opposite sides and have to move together.
   */
  unresolvableNames(names: readonly string[], policy: JsonNamingPolicyId): string[] {
    if (policy === 'None') {
      return [];
    }

    if (policy !== 'CamelCase') {
      // snake_case and kebab-case have no local approximation at all.
      return [...names];
    }

    return names.filter(name => /^\p{Lu}\p{Lu}/u.test(name));
  }

  /**
   * Convert JSON to C# class definition
   *
   * @param naming C# property name → serialized name, from the real .NET naming policy.
   *   Optional: without it the generator falls back to its own approximation, which is
   *   wrong for names starting with a run of capitals (`IPAddress`). Callers that can
   *   reach the runtime should pass it and say so in the UI.
   */
  jsonToCsharp(json: string, options: JsonToCsharpOptions, className?: string, naming?: NamingMap): string {
    try {
      const jsonObject = JSON.parse(json);

      // Determine the class name to use
      const rootClassName = options.rootClassName || className || (Array.isArray(jsonObject) ? 'RootArray' : 'RootObject');

      // Handle arrays at root level
      if (Array.isArray(jsonObject)) {
        if (options.wrapRootArray) {
          // Wrap array in a root object with single property
          const wrappedObject = { items: jsonObject };
          return this.generateCsharpClass(wrappedObject, rootClassName, options, 0, undefined, naming);
        } else {
          // Generate just the array type alias or collection
          return this.generateArrayRootClass(jsonObject, rootClassName, options, naming);
        }
      }

      let result = this.generateCsharpClass(jsonObject, rootClassName, options, 0, undefined, naming);

      // Add JsonSerializerContext if requested
      if (options.generateSerializerContext && options.serializer === 'System.Text.Json') {
        result += '\n\n' + this.generateJsonSerializerContext(rootClassName, options);
      }

      return result;
    } catch (error) {
      throw new Error(`Failed to convert JSON to C#: ${error instanceof Error ? error.message : 'Unknown error'}`, { cause: error });
    }
  }

  /**
   * Generate C# representation for root-level array
   */
  private generateArrayRootClass(array: unknown[], className: string, options: JsonToCsharpOptions, naming?: NamingMap): string {
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

    if (array.length === 0) {
      // Empty array - default to object array
      // Note: This generates a type hint, not a full class definition
      const collectionType = this.getCollectionType('object', options.enumerationType);
      lines.push(`// Root is an empty array`);
      lines.push(`// Recommended type: ${collectionType}`);
      return lines.join('\n');
    }

    // Analyze the array to determine item type and generate item class
    const mergedObject = this.mergeArrayObjects(array);
    const itemClassName = `${className}Item`;
    
    // Generate the item class
    const itemClass = this.generateCsharpClass(mergedObject, itemClassName, options, 0, array, naming);
    
    lines.push(itemClass);
    lines.push('');
    lines.push(`// Root is an array of ${itemClassName}`);
    lines.push(`// Use: ${this.getCollectionType(itemClassName, options.enumerationType)}`);
    
    return lines.join('\n');
  }

  /**
   * Merge multiple objects from an array to detect nullable and required properties
   */
  private mergeArrayObjects(array: unknown[]): Record<string, unknown> {
    if (array.length === 0) {
      return {};
    }

    // Collect all properties from all objects
    const allProperties = new Map<string, { values: unknown[], count: number }>();
    
    for (const item of array) {
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        const obj = item as Record<string, unknown>;
        for (const [key, value] of Object.entries(obj)) {
          if (!allProperties.has(key)) {
            allProperties.set(key, { values: [], count: 0 });
          }
          const prop = allProperties.get(key);
          if (prop) {
            prop.values.push(value);
            prop.count++;
          }
        }
      }
    }

    // Build merged object with representative values
    const merged: Record<string, unknown> = {};
    for (const [key, { values }] of allProperties.entries()) {
      // Use first non-null value if available, otherwise null
      const nonNullValue = values.find(v => v !== null && v !== undefined);
      merged[key] = nonNullValue !== undefined ? nonNullValue : null;
    }

    return merged;
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
  private generateCsharpClass(obj: unknown, className: string, options: JsonToCsharpOptions, indent = 0, contextArray?: unknown[], naming?: NamingMap): string {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      throw new Error('Object JSON must be an object for class generation');
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

    // Analyze properties for nullable and required detection
    const propertyInfo = this.analyzeProperties(obj as Record<string, unknown>, contextArray);

    // Properties
    const entries = Object.entries(obj as Record<string, unknown>);
    for (const [key, value] of entries) {
      const propertyName = options.convertSnakeCase && this.isSnakeCase(key)
        ? this.toPascalCase(key)
        : this.toPascalCase(key);
      
      const info = propertyInfo.get(key);
      if (!info) continue;

      const propertyType = this.inferCsharpType(value, propertyName, options, info.isNullable);

      // Determine if we need JsonPropertyName attribute
      const needsAttribute = this.shouldAddPropertyNameAttribute(key, propertyName, options, naming);
      
      if (needsAttribute) {
        const attributeName = options.serializer === 'System.Text.Json' ? 'JsonPropertyName' : 'JsonProperty';
        lines.push(`${indentStr}    [${attributeName}("${key}")]`);
      }

      // Build property declaration with required modifier if needed
      const requiredModifier = info.isRequired ? 'required ' : '';
      
      // Add property
      if (options.classType === 'class') {
        lines.push(`${indentStr}    public ${requiredModifier}${propertyType} ${propertyName} { get; set; }`);
      } else if (options.classType === 'record' || options.classType === 'record struct' || options.classType === 'readonly record struct') {
        lines.push(`${indentStr}    public ${requiredModifier}${propertyType} ${propertyName} { get; init; }`);
      } else {
        lines.push(`${indentStr}    public ${requiredModifier}${propertyType} ${propertyName} { get; set; }`);
      }
    }

    lines.push(`${indentStr}}`);

    return lines.join('\n');
  }

  /**
   * Analyze properties to determine nullable and required status
   */
  private analyzeProperties(obj: Record<string, unknown>, contextArray?: unknown[]): Map<string, { isNullable: boolean, isRequired: boolean }> {
    const result = new Map<string, { isNullable: boolean, isRequired: boolean }>();
    
    if (!contextArray || contextArray.length === 0) {
      // No array context, analyze single object
      // Note: Single objects don't use 'required' modifier because there's no way to determine
      // which properties are truly required vs optional from a single example
      for (const [key, value] of Object.entries(obj)) {
        result.set(key, {
          isNullable: value === null || value === undefined,
          isRequired: false // Single object, properties are NOT marked as required
        });
      }
      return result;
    }

    // Analyze across array items
    const totalItems = contextArray.length;
    const propertyStats = new Map<string, { nullCount: number, undefinedCount: number, presentCount: number }>();
    
    // Initialize stats for all properties in the merged object
    for (const key of Object.keys(obj)) {
      propertyStats.set(key, { nullCount: 0, undefinedCount: 0, presentCount: 0 });
    }

    // Count occurrences across array
    for (const item of contextArray) {
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        const itemObj = item as Record<string, unknown>;
        
        for (const key of Object.keys(obj)) {
          const stats = propertyStats.get(key);
          if (!stats) continue;
          
          if (key in itemObj) {
            stats.presentCount++;
            if (itemObj[key] === null) {
              stats.nullCount++;
            }
          } else {
            stats.undefinedCount++;
          }
        }
      }
    }

    // Determine nullable and required for each property
    for (const [key, stats] of propertyStats.entries()) {
      const isNullable = stats.nullCount > 0;
      const isRequired = this.isPropertyRequired(stats, totalItems);
      result.set(key, { isNullable, isRequired });
    }

    return result;
  }

  /**
   * Determine if a property should be marked as required based on its presence in array items
   */
  private isPropertyRequired(stats: { presentCount: number }, totalItems: number): boolean {
    // A property is required if it's present in ALL items of the array
    return stats.presentCount === totalItems;
  }

  /**
   * Determine if JsonPropertyName attribute should be added.
   *
   * The attribute is needed exactly when the configured naming policy would *not* produce
   * the key that is actually in the payload - there is no second condition. With no
   * policy the serialized name is the property name, which reduces to the old
   * `originalKey !== propertyName` rule.
   */
  private shouldAddPropertyNameAttribute(
    originalKey: string,
    propertyName: string,
    options: JsonToCsharpOptions,
    naming?: NamingMap
  ): boolean {
    return this.serializedName(propertyName, options, naming) !== originalKey;
  }

  /**
   * What the serializer will call `propertyName` on the wire.
   *
   * Prefers the real `JsonNamingPolicy` result when the runtime supplied one. The
   * fallback is only reached when the .NET runtime could not be loaded, and it is
   * knowingly approximate: `toCamelCase` disagrees with .NET on every name beginning with
   * a run of capitals (`IPAddress` → `iPAddress` rather than `ipAddress`). The tool says
   * so in that state rather than presenting the guess as verified.
   *
   * The snake/kebab policies have no approximation at all and fall through to the
   * property name, which makes every key look like a mismatch. That is the safe
   * direction: a redundant `[JsonPropertyName]` still serializes correctly, whereas a
   * missing one silently does not.
   */
  private serializedName(propertyName: string, options: JsonToCsharpOptions, naming?: NamingMap): string {
    const resolved = naming?.get(propertyName);
    if (resolved !== undefined) {
      return resolved;
    }

    return this.effectiveNamingPolicy(options) === 'CamelCase'
      ? this.toCamelCase(propertyName)
      : propertyName;
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
  private inferCsharpType(value: unknown, propertyName: string, options: JsonToCsharpOptions, forceNullable = false): string {
    if (value === null || value === undefined) {
      return 'object?';
    }

    if (typeof value === 'string') {
      // Check if it's a date string
      if (this.isIsoDateString(value)) {
        return forceNullable ? 'DateTime?' : 'DateTime';
      }
      // Check if it's a GUID
      if (this.isGuid(value)) {
        return forceNullable ? 'Guid?' : 'Guid';
      }
      return forceNullable ? 'string?' : 'string';
    }

    if (typeof value === 'number') {
      const baseType = Number.isInteger(value) ? 'int' : 'double';
      return forceNullable ? `${baseType}?` : baseType;
    }

    if (typeof value === 'boolean') {
      return forceNullable ? 'bool?' : 'bool';
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
      case 'IReadOnlyList<T>':
        return `IReadOnlyList<${itemType}>`;
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
    if (!str) return '';
    return str
      .split(/[-_\s]|(?=[A-Z])/)
      .filter((word) => word.length > 0)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
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

    // The context has to agree with the policy the attributes were decided against, or
    // the generated model round-trips under different rules than the tool showed.
    // `JsonKnownNamingPolicy` names the policies one-for-one, including `Unspecified`.
    const policy = this.effectiveNamingPolicy(options);

    lines.push('[JsonSourceGenerationOptions(');
    lines.push(`    PropertyNamingPolicy = JsonKnownNamingPolicy.${policy === 'None' ? 'Unspecified' : policy},`);
    lines.push('    GenerationMode = JsonSourceGenerationMode.Metadata)]');
    lines.push(`[JsonSerializable(typeof(${className}))]`);
    lines.push(`public partial class ${contextName} : JsonSerializerContext`);
    lines.push('{');
    lines.push('}');

    return lines.join('\n');
  }
}
