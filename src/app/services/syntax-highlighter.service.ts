import { Injectable } from '@angular/core';
import hljs from 'highlight.js/lib/core';
import csharp from 'highlight.js/lib/languages/csharp';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';

// Register languages
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('json', json);

@Injectable({
  providedIn: 'root'
})
export class SyntaxHighlighterService {
  /**
   * Highlights code with the specified language
   * @param code The code to highlight
   * @param language The language to use for highlighting
   * @returns HTML string with syntax highlighting
   */
  highlight(code: string, language: 'csharp' | 'typescript' | 'json' = 'csharp'): string {
    try {
      const result = hljs.highlight(code, { language });
      return result.value;
    } catch (error) {
      console.error('Error highlighting code:', error);
      return code;
    }
  }

  /**
   * Highlights code and adds line numbers
   * @param code The code to highlight
   * @param language The language to use for highlighting
   * @returns HTML string with syntax highlighting and line numbers
   */
  highlightWithLineNumbers(code: string, language: 'csharp' | 'typescript' | 'json' = 'csharp'): string {
    try {
      const highlighted = this.highlight(code, language);
      const lines = highlighted.split('\n');
      
      return lines
        .map((line, index) => {
          const lineNumber = (index + 1).toString().padStart(3, ' ');
          return `<span class="code-line"><span class="line-number">${lineNumber}</span>${line}</span>`;
        })
        .join('\n');
    } catch (error) {
      console.error('Error highlighting code with line numbers:', error);
      return code;
    }
  }
}
