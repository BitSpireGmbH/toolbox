import { Injectable } from '@angular/core';

export interface DependencyInfo {
  name: string;
  type: string;
  parameterName: string;
  fieldName?: string;
  color: string;
}

export interface MethodUsage {
  methodName: string;
  startIndex: number;
  endIndex: number;
  dependencies: string[];
}

export interface AnalysisResult {
  dependencies: DependencyInfo[];
  methodUsages: MethodUsage[];
  hasMultipleResponsibilities: boolean;
  mixedResponsibilityMethods: string[];
  responsibilityGroups: { dependency: string; methods: string[] }[];
}

@Injectable({
  providedIn: 'root'
})
export class SrpAnalyzerService {
  private readonly colors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#8b5cf6', // purple
    '#ef4444', // red
    '#06b6d4', // cyan
    '#ec4899', // pink
    '#14b8a6', // teal
    '#f97316', // orange
  ];

  private readonly frameworkServices = new Set([
    'ILogger',
    'IOptions',
    'IConfiguration',
    'IMemoryCache',
    'IDistributedCache',
    'IHostEnvironment',
    'IWebHostEnvironment',
    'IHttpContextAccessor',
    'IServiceProvider',
    'IHostApplicationLifetime',
  ]);

  analyzeCode(code: string, filterFrameworkServices: boolean): AnalysisResult {
    const dependencies = this.extractDependencies(code, filterFrameworkServices);
    const methodUsages = this.extractMethodUsages(code, dependencies);
    
    const mixedResponsibilityMethods = methodUsages
      .filter(m => m.dependencies.length > 1)
      .map(m => m.methodName);
    
    const hasMultipleResponsibilities = this.detectMultipleResponsibilities(
      dependencies,
      methodUsages
    );

    const responsibilityGroups = dependencies.map(dep => {
      const methods = methodUsages
        .filter(m => m.dependencies.includes(dep.type))
        .map(m => m.methodName);
      return { dependency: dep.type, methods };
    }).filter(g => g.methods.length > 0);

    return {
      dependencies,
      methodUsages,
      hasMultipleResponsibilities,
      mixedResponsibilityMethods,
      responsibilityGroups
    };
  }

  private detectMultipleResponsibilities(
    dependencies: DependencyInfo[],
    methodUsages: MethodUsage[]
  ): boolean {
    if (dependencies.length < 2) {
      return false;
    }

    const dependencyUsageMap = new Map<string, Set<string>>();
    for (const dep of dependencies) {
      dependencyUsageMap.set(dep.type, new Set());
    }

    for (const method of methodUsages) {
      for (const dep of method.dependencies) {
        dependencyUsageMap.get(dep)?.add(method.methodName);
      }
    }

    const dependenciesWithExclusiveMethods: string[] = [];
    for (const [dep, methods] of dependencyUsageMap.entries()) {
      if (methods.size > 0) {
        const hasExclusiveUsage = Array.from(methods).some(method => {
          const methodUsage = methodUsages.find(m => m.methodName === method);
          return methodUsage && methodUsage.dependencies.length === 1;
        });
        if (hasExclusiveUsage) {
          dependenciesWithExclusiveMethods.push(dep);
        }
      }
    }

    return dependenciesWithExclusiveMethods.length >= 2;
  }

  private extractDependencies(code: string, filterFrameworkServices: boolean): DependencyInfo[] {
    const dependencies: DependencyInfo[] = [];
    const colorIndex = new Map<string, number>();
    let nextColorIndex = 0;

    const classNameMatch = code.match(/class\s+(\w+)/);
    const className = classNameMatch ? classNameMatch[1] : null;

    let primaryConstructorMatch = null;
    if (className) {
      const primaryConstructorRegex = new RegExp(`class\\s+${className}\\s*\\((.*?)\\)`, 's');
      primaryConstructorMatch = code.match(primaryConstructorRegex);
      
      if (primaryConstructorMatch) {
        const params = this.parseParameters(primaryConstructorMatch[1]);
        for (const param of params) {
          if (this.shouldIncludeDependency(param.type, filterFrameworkServices)) {
            const color = this.colors[nextColorIndex % this.colors.length];
            colorIndex.set(param.type, nextColorIndex++);
            dependencies.push({
              name: param.type,
              type: param.type,
              parameterName: param.name,
              color
            });
          }
        }
      }

      const regularConstructorRegex = new RegExp(`(?:public|private|protected|internal)?\\s*${className}\\s*\\((.*?)\\)\\s*(?::\\s*\\w+\\(.*?\\))?\\s*{`, 's');
      const regularConstructorMatch = code.match(regularConstructorRegex);

      if (regularConstructorMatch && !primaryConstructorMatch) {
        const params = this.parseParameters(regularConstructorMatch[1]);
        for (const param of params) {
          if (this.shouldIncludeDependency(param.type, filterFrameworkServices)) {
            const color = this.colors[nextColorIndex % this.colors.length];
            colorIndex.set(param.type, nextColorIndex++);
            dependencies.push({
              name: param.type,
              type: param.type,
              parameterName: param.name,
              color
            });
          }
        }
      }
    }

    const fieldPattern = /private\s+readonly\s+(\w+(?:<[^>]+>)?)\s+(\w+)\s*(?:=|;)/g;
    let fieldMatch;
    while ((fieldMatch = fieldPattern.exec(code)) !== null) {
      const type = fieldMatch[1];
      const fieldName = fieldMatch[2];
      
      const existingDep = dependencies.find(d => d.type === type);
      if (existingDep) {
        existingDep.fieldName = fieldName;
      } else if (this.shouldIncludeDependency(type, filterFrameworkServices)) {
        const color = this.colors[nextColorIndex % this.colors.length];
        colorIndex.set(type, nextColorIndex++);
        dependencies.push({
          name: type,
          type: type,
          parameterName: '',
          fieldName: fieldName,
          color
        });
      }
    }

    return dependencies;
  }

  private parseParameters(paramsString: string): { type: string; name: string }[] {
    const params: { type: string; name: string }[] = [];
    const paramParts = paramsString.split(',').map(p => p.trim()).filter(p => p);
    
    for (const part of paramParts) {
      const match = part.match(/(\w+(?:<[^>]+>)?)\s+(\w+)/);
      if (match) {
        params.push({ type: match[1], name: match[2] });
      }
    }
    
    return params;
  }

  private shouldIncludeDependency(type: string, filterFrameworkServices: boolean): boolean {
    if (!filterFrameworkServices) {
      return true;
    }
    
    const baseType = type.replace(/<.*>/, '');
    return !this.frameworkServices.has(baseType);
  }

  private extractMethodUsages(code: string, dependencies: DependencyInfo[]): MethodUsage[] {
    const methodUsages: MethodUsage[] = [];
    
    const classNameMatch = code.match(/class\s+(\w+)/);
    const className = classNameMatch ? classNameMatch[1] : '';
    
    const methodPattern = /(?:public|private|protected|internal|static|async|virtual|override|new|readonly|unsafe|extern|volatile)*\s+(\S(?:.*?)?)\s+(\w+)\s*\(/g;
    
    let methodMatch;
    while ((methodMatch = methodPattern.exec(code)) !== null) {
      const methodName = methodMatch[2];
      
      if (methodName === className) {
        continue;
      }
      
      const startIndex = methodMatch.index;
      
      const endIndex = this.findMethodEnd(code, startIndex);
      const methodBody = code.substring(startIndex, endIndex);
      
      const usedDependencies = this.findUsedDependencies(methodBody, dependencies);
      
      if (usedDependencies.length > 0) {
        methodUsages.push({
          methodName,
          startIndex,
          endIndex,
          dependencies: usedDependencies
        });
      }
    }
    
    return methodUsages;
  }

  private findMethodEnd(code: string, startIndex: number): number {
    const lambdaMatch = code.substring(startIndex).match(/=>\s*([^;]+);/);
    if (lambdaMatch && lambdaMatch.index !== undefined) {
      return startIndex + lambdaMatch.index + lambdaMatch[0].length;
    }
    
    let braceCount = 0;
    let inMethod = false;
    
    for (let i = startIndex; i < code.length; i++) {
      if (code[i] === '{') {
        braceCount++;
        inMethod = true;
      } else if (code[i] === '}') {
        braceCount--;
        if (inMethod && braceCount === 0) {
          return i + 1;
        }
      }
    }
    
    return code.length;
  }

  private findUsedDependencies(methodBody: string, dependencies: DependencyInfo[]): string[] {
    const used = new Set<string>();
    
    for (const dep of dependencies) {
      const patterns = [
        dep.parameterName,
        dep.fieldName,
      ].filter((p): p is string => Boolean(p));
      
      for (const pattern of patterns) {
        const escapedPattern = this.escapeRegex(pattern);
        const regex = new RegExp(`\\b${escapedPattern}\\b`, 'g');
        if (regex.test(methodBody)) {
          used.add(dep.type);
          break;
        }
      }
    }
    
    return Array.from(used);
  }

  highlightCode(code: string, result: AnalysisResult, selectedDependency: string | null): string {
    const highlights: { index: number, type: 'start' | 'end', content?: string, priority: number }[] = [];

    // 1. Method Highlights
    for (const method of result.methodUsages) {
      let bgStyle = '';
      if (method.dependencies.length > 1) {
        bgStyle = 'background-color: #fef3c7;'; // Mixed (Amber 100)
      } else if (method.dependencies.length === 1) {
        const dep = result.dependencies.find(d => d.type === method.dependencies[0]);
        if (dep && (!selectedDependency || selectedDependency === dep.type)) {
           bgStyle = `background-color: ${dep.color}20;`; // Stronger background: 12% alpha
        }
      }

      if (bgStyle) {
          highlights.push({
            index: method.startIndex,
            type: 'start',
            content: `<span class="srp-method" style="${bgStyle} display: inline-block; width: 100%;">`, // Corrected escaping for class name
            priority: 1
          });
          highlights.push({
            index: method.endIndex,
            type: 'end',
            content: '</span>',
            priority: 1
          });
      }
    }

    // 2. Dependency Highlights
    const dependenciesToHighlight = selectedDependency 
      ? result.dependencies.filter(d => d.type === selectedDependency)
      : result.dependencies;

    for (const dep of dependenciesToHighlight) {
      const patterns = [
        { pattern: dep.parameterName, context: 'parameter' },
        ...(dep.fieldName ? [{ pattern: dep.fieldName, context: 'field' }] : [])
      ];

      for (const { pattern } of patterns) {
        if (!pattern) continue;
        const regex = new RegExp(`\\b${this.escapeRegex(pattern)}\\b`, 'g');
        let match;
        while ((match = regex.exec(code)) !== null) {
            const opacity = selectedDependency ? '1' : '0.85';
            const style = `background-color: ${dep.color}60; border-bottom: 2px solid ${dep.color}; opacity: ${opacity};`; // Stronger highlights: 37% alpha
            
            highlights.push({
                index: match.index,
                type: 'start',
                content: `<span class="srp-highlight" style="${style}">`, // Corrected escaping for class name
                priority: 2
            });
            highlights.push({
                index: match.index + match[0].length,
                type: 'end',
                content: '</span>',
                priority: 2
            });
        }
      }
      
      const typeRegex = new RegExp(`\\b${this.escapeRegex(dep.type)}\\b`, 'g');
      let match;
       while ((match = typeRegex.exec(code)) !== null) {
            const opacity = selectedDependency ? '1' : '0.85';
            const style = `background-color: ${dep.color}60; border-bottom: 2px solid ${dep.color}; opacity: ${opacity}; font-weight: 600;`;
            
            highlights.push({
                index: match.index,
                type: 'start',
                content: `<span class="srp-highlight" style="${style}">`, // Corrected escaping for class name
                priority: 2
            });
            highlights.push({
                index: match.index + match[0].length,
                type: 'end',
                content: '</span>',
                priority: 2
            });
       }
    }
    
    // Sort highlights
    highlights.sort((a, b) => {
        if (a.index !== b.index) return a.index - b.index;
        
        if (a.type === 'start' && b.type === 'start') {
            return a.priority - b.priority; 
        }
        if (a.type === 'end' && b.type === 'end') {
            return b.priority - a.priority; 
        }
        
        if (a.type === 'end' && b.type === 'start') return -1;
        if (a.type === 'start' && b.type === 'end') return 1;
        
        return 0;
    });
    
    let resultHtml = '';
    let lastIndex = 0;
    
    for (const h of highlights) {
        if (h.index > lastIndex) {
            resultHtml += this.escapeHtml(code.substring(lastIndex, h.index));
            lastIndex = h.index;
        }
        resultHtml += h.content || '';
    }
    
    if (lastIndex < code.length) {
        resultHtml += this.escapeHtml(code.substring(lastIndex));
    }
    
    return resultHtml;
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>\"']/g, m => map[m]);
  }

  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
