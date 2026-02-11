import { Injectable } from '@angular/core';

export interface StrongTyperOptions {
  useAddOptions: boolean;
  validateDataAnnotations: boolean;
  validateOnStart: boolean;
  propertyInitialization: 'set' | 'init';
  visibility: 'public' | 'internal';
  sealed: boolean;
}

export interface ConfigNode {
  key: string;
  fullPath: string;
  className: string;
  isSelected: boolean;
  isRequired: boolean;
  isObject: boolean;
  value: unknown;
  children: ConfigNode[];
}

@Injectable({
  providedIn: 'root'
})
export class StrongTyperConverterService {
  private generatedClasses = new Map<string, string>();

  discoverNodes(json: string): ConfigNode[] {
    try {
      const obj = JSON.parse(json);
      return this.parseNodes(obj, '', '');
    } catch {
      return [];
    }
  }

  private parseNodes(obj: unknown, key: string, parentPath: string): ConfigNode[] {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      return [];
    }

    const nodes: ConfigNode[] = [];
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const currentPath = parentPath ? `${parentPath}:${k}` : k;
      const isObject = typeof v === 'object' && v !== null && !Array.isArray(v);
      
      const node: ConfigNode = {
        key: k,
        fullPath: currentPath,
        className: this.toPascalCase(k) + 'Options',
        isSelected: isObject,
        isRequired: true,
        isObject: isObject,
        value: v,
        children: isObject ? this.parseNodes(v, k, currentPath) : []
      };
      nodes.push(node);
    }
    return nodes;
  }

  generate(nodes: ConfigNode[], options: StrongTyperOptions): string {
    this.generatedClasses.clear();
    const selectedNodes = this.getAllSelectedNodes(nodes);
    
    if (selectedNodes.length === 0) {
      return '// No objects selected for generation';
    }

    selectedNodes.forEach(node => {
      this.generateClassForNode(node, options);
    });

    const usings = options.validateDataAnnotations 
      ? 'using System.ComponentModel.DataAnnotations;\nusing Microsoft.Extensions.Options;\n\n' 
      : 'using Microsoft.Extensions.Options;\n\n';
    
    const classes = Array.from(this.generatedClasses.values()).join('\n\n');
    
    const registrations = selectedNodes.map(node => this.generateRegistration(node, options)).join('\n');

    const usageExample = this.generateUsageExample(selectedNodes[0]);

    return `${usings}${classes}\n\n// Registration code:\n${registrations}\n\n${usageExample}`;
  }

  private getAllSelectedNodes(nodes: ConfigNode[]): ConfigNode[] {
    let selected: ConfigNode[] = [];
    for (const node of nodes) {
      if (node.isObject && node.isSelected) {
        selected.push(node);
      }
      selected = selected.concat(this.getAllSelectedNodes(node.children));
    }
    return selected;
  }

  private generateClassForNode(node: ConfigNode, options: StrongTyperOptions): void {
    const lines: string[] = [];
    const sealedModifier = options.sealed ? 'sealed ' : '';
    lines.push(`${options.visibility} ${sealedModifier}class ${node.className}`);
    lines.push(`{`);
    // Section name is the key or the full path? Usually the section name is used in Bind.
    // If it's a nested section, Bind(config.GetSection("Outer:Inner")) is common.
    lines.push(`    public const string SectionName = "${node.fullPath}";`);
    lines.push(``);

    for (const [key, value] of Object.entries(node.value as Record<string, unknown>)) {
      const propertyName = this.toPascalCase(key);
      const propertyType = this.inferType(value, key);

      if (options.validateDataAnnotations) {
        // Find if this property is also a discoverable node and check isRequired
        const childNode = node.children.find(c => c.key === key);
        if (childNode?.isRequired || (!childNode && options.validateDataAnnotations)) {
           lines.push(`    [Required]`);
        }
      }

      const accessor = options.propertyInitialization === 'init' ? 'get; init;' : 'get; set;';
      lines.push(`    public ${propertyType} ${propertyName} { ${accessor} } = default!;`);
    }

    lines.push(`}`);
    this.generatedClasses.set(node.className, lines.join('\n'));
  }

  private inferType(value: unknown, key: string): string {
    if (value === null) return 'object?';
    if (Array.isArray(value)) {
      if (value.length === 0) return 'List<object>';
      const itemType = this.inferType(value[0], key);
      return `List<${itemType}>`;
    }
    if (typeof value === 'object') {
      return this.toPascalCase(key) + 'Options';
    }
    if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'double';
    if (typeof value === 'boolean') return 'bool';
    if (typeof value === 'string') return 'string';
    return 'object';
  }

  private generateRegistration(node: ConfigNode, options: StrongTyperOptions): string {
    const section = `${node.className}.SectionName`;
    if (options.useAddOptions) {
      let code = `builder.Services.AddOptions<${node.className}>()\n    .Bind(builder.Configuration.GetSection(${section}))`;
      if (options.validateDataAnnotations) {
        code += `\n    .ValidateDataAnnotations()`;
      }
      if (options.validateOnStart) {
        code += `\n    .ValidateOnStart()`;
      }
      return code + ';';
    } else {
      return `builder.Services.Configure<${node.className}>(builder.Configuration.GetSection(${section}));`;
    }
  }

  private generateUsageExample(node: ConfigNode): string {
    return `// Usage Example in a Service/Controller:
public class MyService
{
    private readonly ${node.className} _options;

    public MyService(IOptions<${node.className}> options)
    {
        _options = options.Value;
    }

    public void DoSomething()
    {
        // Access properties via _options.${this.toPascalCase(Object.keys(node.value as Record<string, unknown>)[0] || 'Property')}
    }
}`;
  }

  private toPascalCase(str: string): string {
    if (!str) return '';
    return str
      .split(/[-_\s]|(?=[A-Z])/)
      .filter((word) => word.length > 0)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }
}
