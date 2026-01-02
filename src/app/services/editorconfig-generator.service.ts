import { Injectable } from '@angular/core';

export interface EditorConfigSection {
  id: string;
  pattern: string;
  settings: EditorConfigSettings;
}

export interface EditorConfigSettings {
  // Indentation
  indent_style?: 'space' | 'tab';
  indent_size?: number;
  tab_width?: number;

  // Line endings
  end_of_line?: 'lf' | 'crlf' | 'cr';
  insert_final_newline?: boolean;
  trim_trailing_whitespace?: boolean;

  // Charset
  charset?: 'utf-8' | 'utf-8-bom' | 'latin1' | 'utf-16be' | 'utf-16le';

  // .NET specific
  dotnet_sort_system_directives_first?: boolean;
  dotnet_separate_import_directive_groups?: boolean;

  // C# specific
  csharp_new_line_before_open_brace?: string;
  csharp_new_line_before_else?: boolean;
  csharp_new_line_before_catch?: boolean;
  csharp_new_line_before_finally?: boolean;
  csharp_prefer_braces?: string;
  csharp_prefer_simple_using_statement?: boolean;
  csharp_style_expression_bodied_methods?: string;
  csharp_style_expression_bodied_constructors?: string;
  csharp_style_expression_bodied_operators?: string;
  csharp_style_expression_bodied_properties?: string;
  csharp_style_var_for_built_in_types?: boolean;
  csharp_style_var_when_type_is_apparent?: boolean;
  csharp_style_var_elsewhere?: boolean;

  // Naming conventions
  dotnet_naming_rule_interfaces_should_be_prefixed_with_i?: string;
  dotnet_naming_rule_types_should_be_pascal_case?: string;
  dotnet_naming_rule_non_field_members_should_be_pascal_case?: string;

  // Code quality
  dotnet_code_quality_unused_parameters?: string;
  
  // Other options
  max_line_length?: number;
}

@Injectable({
  providedIn: 'root'
})
export class EditorconfigGeneratorService {
  generateEditorConfig(rootSettings: EditorConfigSettings, sections: EditorConfigSection[]): string {
    let config = '# EditorConfig is awesome: https://EditorConfig.org\n\n';
    config += '# top-most EditorConfig file\n';
    config += 'root = true\n\n';

    // Add root/global settings
    if (rootSettings && Object.keys(rootSettings).length > 0) {
      config += '[*]\n';
      config += this.generateSettingsBlock(rootSettings);
      config += '\n';
    }

    // Add specific sections
    for (const section of sections) {
      if (section.pattern && Object.keys(section.settings).length > 0) {
        config += `[${section.pattern}]\n`;
        config += this.generateSettingsBlock(section.settings);
        config += '\n';
      }
    }

    return config;
  }

  private generateSettingsBlock(settings: EditorConfigSettings): string {
    let block = '';
    
    for (const [key, value] of Object.entries(settings)) {
      if (value !== undefined && value !== null && value !== '') {
        block += `${key} = ${value}\n`;
      }
    }
    
    return block;
  }

  parseEditorConfig(content: string): { rootSettings: EditorConfigSettings; sections: EditorConfigSection[] } {
    const lines = content.split('\n');
    const rootSettings: EditorConfigSettings = {};
    const sections: EditorConfigSection[] = [];
    let currentSection: EditorConfigSection | null = null;
    let inRoot = false;

    for (let line of lines) {
      line = line.trim();
      
      // Skip comments and empty lines
      if (line.startsWith('#') || line.startsWith(';') || line === '' || line === 'root = true') {
        continue;
      }

      // Check for section header
      const sectionMatch = line.match(/^\[(.+)\]$/);
      if (sectionMatch) {
        const pattern = sectionMatch[1];
        
        if (pattern === '*') {
          inRoot = true;
          currentSection = null;
        } else {
          inRoot = false;
          currentSection = {
            id: this.generateId(),
            pattern: pattern,
            settings: {}
          };
          sections.push(currentSection);
        }
        continue;
      }

      // Parse key-value pairs
      const settingMatch = line.match(/^([^=]+)=(.+)$/);
      if (settingMatch) {
        const key = settingMatch[1].trim();
        let value: string | boolean | number = settingMatch[2].trim();

        // Convert boolean values
        if (value === 'true') {
          value = true;
        } else if (value === 'false') {
          value = false;
        } else if (!isNaN(Number(value))) {
          value = Number(value);
        }

        if (inRoot) {
          (rootSettings as any)[key] = value;
        } else if (currentSection) {
          (currentSection.settings as any)[key] = value;
        }
      }
    }

    return { rootSettings, sections };
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 11);
  }

  getDefaultSettings(): EditorConfigSettings {
    return {
      indent_style: 'space',
      indent_size: 4,
      end_of_line: 'lf',
      insert_final_newline: true,
      trim_trailing_whitespace: true,
      charset: 'utf-8'
    };
  }

  getDefaultCSharpSettings(): EditorConfigSettings {
    return {
      indent_style: 'space',
      indent_size: 4,
      tab_width: 4,
      end_of_line: 'lf',
      insert_final_newline: true,
      trim_trailing_whitespace: true,
      charset: 'utf-8',
      dotnet_sort_system_directives_first: true,
      dotnet_separate_import_directive_groups: false,
      csharp_new_line_before_open_brace: 'all',
      csharp_new_line_before_else: true,
      csharp_new_line_before_catch: true,
      csharp_new_line_before_finally: true,
      csharp_prefer_braces: 'true:suggestion',
      csharp_prefer_simple_using_statement: true,
      csharp_style_var_for_built_in_types: false,
      csharp_style_var_when_type_is_apparent: true,
      csharp_style_var_elsewhere: false
    };
  }
}
