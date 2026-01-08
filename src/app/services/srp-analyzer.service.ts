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
}

@Injectable({
  providedIn: 'root'
})
export class SrpAnalyzerService {
  private readonly colors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#8b5cf6', // purple
    '#ef4444', // red
    '#06b6d4', // cyan
    '#ec4899', // pink
    '#14b8a6', // teal
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

    return {
      dependencies,
      methodUsages,
      hasMultipleResponsibilities,
      mixedResponsibilityMethods
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

    const primaryConstructorMatch = code.match(/class\s+\w+\s*\((.*?)\)/s);
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

    const regularConstructorMatch = code.match(/(?:public|private|protected|internal)?\s*\w+\s*\((.*?)\)\s*(?::\s*\w+\(.*?\))?\s*{/s);
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

    const fieldPattern = /private\s+readonly\s+(\w+(?:<[^>]+>)?)\s+(\w+)\s*=/g;
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
    
    const methodPattern = /(?:public|private|protected|internal|static)?\s*(?:async\s+)?(?:virtual\s+)?(?:override\s+)?(\w+(?:<[^>]+>)?|\w+)\s+(\w+)\s*\([^)]*\)\s*(?:=>|{)/g;
    
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
      ].filter(Boolean);
      
      for (const pattern of patterns) {
        const regex = new RegExp(`\\b${pattern}\\b`, 'g');
        if (regex.test(methodBody)) {
          used.add(dep.type);
          break;
        }
      }
    }
    
    return Array.from(used);
  }

  highlightCode(code: string, result: AnalysisResult, selectedDependency: string | null): string {
    let highlighted = this.escapeHtml(code);
    
    const dependenciesToHighlight = selectedDependency 
      ? result.dependencies.filter(d => d.type === selectedDependency)
      : result.dependencies;
    
    for (const dep of dependenciesToHighlight) {
      const patterns = [
        { pattern: dep.parameterName, context: 'parameter' },
        ...(dep.fieldName ? [{ pattern: dep.fieldName, context: 'field' }] : [])
      ];
      
      for (const { pattern } of patterns) {
        if (pattern) {
          const regex = new RegExp(`\\b(${pattern})\\b`, 'g');
          highlighted = highlighted.replace(regex, (match) => {
            const opacity = selectedDependency ? '1' : '0.7';
            return `<span class="srp-highlight" style="background-color: ${dep.color}40; border-bottom: 2px solid ${dep.color}; opacity: ${opacity};">${match}</span>`;
          });
        }
      }
      
      const typeRegex = new RegExp(`\\b(${dep.type})\\b`, 'g');
      highlighted = highlighted.replace(typeRegex, (match) => {
        const opacity = selectedDependency ? '1' : '0.7';
        return `<span class="srp-highlight" style="background-color: ${dep.color}40; border-bottom: 2px solid ${dep.color}; opacity: ${opacity}; font-weight: 600;">${match}</span>`;
      });
    }
    
    for (const method of result.methodUsages) {
      if (method.dependencies.length > 1) {
        const methodNameRegex = new RegExp(`\\b(${method.methodName})\\b`);
        highlighted = highlighted.replace(methodNameRegex, (match) => {
          return `<span class="srp-mixed" style="background-color: #fbbf2440; border-bottom: 2px solid #fbbf24; font-weight: 600;" title="This method uses multiple dependencies">${match}</span>`;
        });
      }
    }
    
    return highlighted;
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}
