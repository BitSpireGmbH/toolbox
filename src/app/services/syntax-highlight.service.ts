import { Injectable, inject } from '@angular/core';
import hljs from 'highlight.js/lib/core';
import csharp from 'highlight.js/lib/languages/csharp';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';

@Injectable({
  providedIn: 'root'
})
export class SyntaxHighlightService {
  constructor() {
    // Register languages
    hljs.registerLanguage('csharp', csharp);
    hljs.registerLanguage('typescript', typescript);
    hljs.registerLanguage('json', json);
  }

  /**
   * Highlight code with the specified language
   */
  highlight(code: string, language: 'csharp' | 'typescript' | 'json'): string {
    try {
      const result = hljs.highlight(code, { language });
      return result.value;
    } catch (error) {
      console.error('Syntax highlighting error:', error);
      return code; // Return original code if highlighting fails
    }
  }

  /**
   * Auto-detect language and highlight
   */
  highlightAuto(code: string): string {
    try {
      const result = hljs.highlightAuto(code, ['csharp', 'typescript', 'json']);
      return result.value;
    } catch (error) {
      console.error('Syntax highlighting error:', error);
      return code;
    }
  }
}
