import { Injectable } from '@angular/core';

export interface DataItem {
  id: string;
  value: any;
  color: string;
  shape: 'circle' | 'square' | 'triangle' | 'star';
}

export interface OperatorConfig {
  type: OperatorType;
  params: any;
}

export type OperatorType =
  | 'where'
  | 'select'
  | 'orderBy'
  | 'orderByDescending'
  | 'first'
  | 'firstOrDefault'
  | 'take'
  | 'skip'
  | 'distinct'
  | 'any'
  | 'all'
  | 'count';

export interface OperatorDefinition {
  type: OperatorType;
  name: string;
  description: string;
  color: string;
  icon: string;
  requiresParam: boolean;
  paramLabel?: string;
  paramType?: 'predicate' | 'selector' | 'number';
  category: 'filtering' | 'projection' | 'ordering' | 'aggregation' | 'quantifier';
}

export interface ExecutionStep {
  operatorType: OperatorType;
  operatorName: string;
  inputItems: DataItem[];
  outputItems: DataItem[];
  description: string;
}

export interface QueryResult {
  finalResult: DataItem[];
  steps: ExecutionStep[];
  generatedCode: string;
}

@Injectable({
  providedIn: 'root',
})
export class LinqVisualizerService {
  readonly operatorDefinitions: OperatorDefinition[] = [
    {
      type: 'where',
      name: 'Where',
      description: 'Filters elements based on a predicate',
      color: 'bg-blue-500',
      icon: 'filter',
      requiresParam: true,
      paramLabel: 'Predicate (e.g., x => x.value > 5)',
      paramType: 'predicate',
      category: 'filtering',
    },
    {
      type: 'select',
      name: 'Select',
      description: 'Projects each element into a new form',
      color: 'bg-purple-500',
      icon: 'transform',
      requiresParam: true,
      paramLabel: 'Selector (e.g., x => x.value * 2)',
      paramType: 'selector',
      category: 'projection',
    },
    {
      type: 'orderBy',
      name: 'OrderBy',
      description: 'Sorts elements in ascending order',
      color: 'bg-green-500',
      icon: 'sort-asc',
      requiresParam: true,
      paramLabel: 'Key selector (e.g., x => x.value)',
      paramType: 'selector',
      category: 'ordering',
    },
    {
      type: 'orderByDescending',
      name: 'OrderByDescending',
      description: 'Sorts elements in descending order',
      color: 'bg-green-600',
      icon: 'sort-desc',
      requiresParam: true,
      paramLabel: 'Key selector (e.g., x => x.value)',
      paramType: 'selector',
      category: 'ordering',
    },
    {
      type: 'take',
      name: 'Take',
      description: 'Returns a specified number of elements from the start',
      color: 'bg-orange-500',
      icon: 'take',
      requiresParam: true,
      paramLabel: 'Count',
      paramType: 'number',
      category: 'filtering',
    },
    {
      type: 'skip',
      name: 'Skip',
      description: 'Skips a specified number of elements',
      color: 'bg-orange-600',
      icon: 'skip',
      requiresParam: true,
      paramLabel: 'Count',
      paramType: 'number',
      category: 'filtering',
    },
    {
      type: 'first',
      name: 'First',
      description: 'Returns the first element (throws if empty)',
      color: 'bg-red-500',
      icon: 'first',
      requiresParam: false,
      category: 'filtering',
    },
    {
      type: 'firstOrDefault',
      name: 'FirstOrDefault',
      description: 'Returns the first element or null if empty',
      color: 'bg-red-400',
      icon: 'first',
      requiresParam: false,
      category: 'filtering',
    },
    {
      type: 'distinct',
      name: 'Distinct',
      description: 'Returns unique elements',
      color: 'bg-cyan-500',
      icon: 'distinct',
      requiresParam: false,
      category: 'filtering',
    },
    {
      type: 'count',
      name: 'Count',
      description: 'Returns the number of elements',
      color: 'bg-pink-500',
      icon: 'count',
      requiresParam: false,
      category: 'aggregation',
    },
    {
      type: 'any',
      name: 'Any',
      description: 'Determines if any elements satisfy a condition',
      color: 'bg-indigo-500',
      icon: 'check',
      requiresParam: false,
      category: 'quantifier',
    },
    {
      type: 'all',
      name: 'All',
      description: 'Determines if all elements satisfy a condition',
      color: 'bg-indigo-600',
      icon: 'check-all',
      requiresParam: true,
      paramLabel: 'Predicate (e.g., x => x.value > 0)',
      paramType: 'predicate',
      category: 'quantifier',
    },
  ];

  executeQuery(inputData: DataItem[], operators: OperatorConfig[]): QueryResult {
    const steps: ExecutionStep[] = [];
    let currentData = [...inputData];

    operators.forEach((op) => {
      const inputItems = [...currentData];
      const opDef = this.operatorDefinitions.find((d) => d.type === op.type);

      try {
        currentData = this.applyOperator(currentData, op);
        
        steps.push({
          operatorType: op.type,
          operatorName: opDef?.name || op.type,
          inputItems,
          outputItems: [...currentData],
          description: this.getStepDescription(op, inputItems, currentData),
        });
      } catch (error) {
        steps.push({
          operatorType: op.type,
          operatorName: opDef?.name || op.type,
          inputItems,
          outputItems: [],
          description: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        currentData = [];
        throw error;
      }
    });

    const generatedCode = this.generateCSharpCode(inputData, operators);

    return {
      finalResult: currentData,
      steps,
      generatedCode,
    };
  }

  private applyOperator(data: DataItem[], operator: OperatorConfig): DataItem[] {
    switch (operator.type) {
      case 'where':
        return this.applyWhere(data, operator.params);
      case 'select':
        return this.applySelect(data, operator.params);
      case 'orderBy':
        return this.applyOrderBy(data, operator.params);
      case 'orderByDescending':
        return this.applyOrderByDescending(data, operator.params);
      case 'take':
        return this.applyTake(data, operator.params);
      case 'skip':
        return this.applySkip(data, operator.params);
      case 'first':
        return this.applyFirst(data);
      case 'firstOrDefault':
        return this.applyFirstOrDefault(data);
      case 'distinct':
        return this.applyDistinct(data);
      case 'count':
        return this.applyCount(data);
      case 'any':
        return this.applyAny(data, operator.params);
      case 'all':
        return this.applyAll(data, operator.params);
      default:
        return data;
    }
  }

  private applyWhere(data: DataItem[], predicate: string): DataItem[] {
    const func = this.createPredicateFunction(predicate);
    return data.filter((item) => func(item));
  }

  private applySelect(data: DataItem[], selector: string): DataItem[] {
    const func = this.createSelectorFunction(selector);
    return data.map((item) => {
      const newValue = func(item);
      return {
        ...item,
        id: crypto.randomUUID(),
        value: newValue,
      };
    });
  }

  private applyOrderBy(data: DataItem[], keySelector: string): DataItem[] {
    const func = this.createSelectorFunction(keySelector);
    return [...data].sort((a, b) => {
      const aKey = func(a);
      const bKey = func(b);
      return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
    });
  }

  private applyOrderByDescending(data: DataItem[], keySelector: string): DataItem[] {
    const func = this.createSelectorFunction(keySelector);
    return [...data].sort((a, b) => {
      const aKey = func(a);
      const bKey = func(b);
      return aKey > bKey ? -1 : aKey < bKey ? 1 : 0;
    });
  }

  private applyTake(data: DataItem[], count: number): DataItem[] {
    return data.slice(0, count);
  }

  private applySkip(data: DataItem[], count: number): DataItem[] {
    return data.slice(count);
  }

  private applyFirst(data: DataItem[]): DataItem[] {
    if (data.length === 0) {
      throw new Error('Sequence contains no elements');
    }
    return [data[0]];
  }

  private applyFirstOrDefault(data: DataItem[]): DataItem[] {
    return data.length > 0 ? [data[0]] : [];
  }

  private applyDistinct(data: DataItem[]): DataItem[] {
    const seen = new Set<any>();
    return data.filter((item) => {
      const value = JSON.stringify(item.value);
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
  }

  private applyCount(data: DataItem[]): DataItem[] {
    return [
      {
        id: crypto.randomUUID(),
        value: data.length,
        color: '#ec4899',
        shape: 'circle' as const,
      },
    ];
  }

  private applyAny(data: DataItem[], predicate?: string): DataItem[] {
    let result: boolean;
    if (predicate) {
      const func = this.createPredicateFunction(predicate);
      result = data.some((item) => func(item));
    } else {
      result = data.length > 0;
    }
    return [
      {
        id: crypto.randomUUID(),
        value: result,
        color: result ? '#22c55e' : '#ef4444',
        shape: 'circle' as const,
      },
    ];
  }

  private applyAll(data: DataItem[], predicate: string): DataItem[] {
    const func = this.createPredicateFunction(predicate);
    const result = data.every((item) => func(item));
    return [
      {
        id: crypto.randomUUID(),
        value: result,
        color: result ? '#22c55e' : '#ef4444',
        shape: 'circle' as const,
      },
    ];
  }

  private createPredicateFunction(predicate: string): (item: DataItem) => boolean {
    try {
      // Parse simple predicates like "x => x.value > 5" or "x.value > 5"
      let expression = predicate.trim();
      
      // Remove arrow function syntax if present
      if (expression.includes('=>')) {
        expression = expression.split('=>')[1].trim();
      }
      
      // Replace x.value with item.value
      expression = expression.replace(/x\./g, 'item.');
      
      // Create function
      return new Function('item', `return ${expression};`) as (item: DataItem) => boolean;
    } catch (error) {
      throw new Error(`Invalid predicate: ${predicate}`);
    }
  }

  private createSelectorFunction(selector: string): (item: DataItem) => any {
    try {
      let expression = selector.trim();
      
      // Remove arrow function syntax if present
      if (expression.includes('=>')) {
        expression = expression.split('=>')[1].trim();
      }
      
      // Replace x.value with item.value
      expression = expression.replace(/x\./g, 'item.');
      
      // Create function
      return new Function('item', `return ${expression};`) as (item: DataItem) => any;
    } catch (error) {
      throw new Error(`Invalid selector: ${selector}`);
    }
  }

  private getStepDescription(
    operator: OperatorConfig,
    inputItems: DataItem[],
    outputItems: DataItem[]
  ): string {
    const inCount = inputItems.length;
    const outCount = outputItems.length;
    const opDef = this.operatorDefinitions.find((d) => d.type === operator.type);

    switch (operator.type) {
      case 'where':
        return `Filtered ${inCount} items → ${outCount} items matched the condition`;
      case 'select':
        return `Transformed ${inCount} items`;
      case 'orderBy':
        return `Sorted ${inCount} items in ascending order`;
      case 'orderByDescending':
        return `Sorted ${inCount} items in descending order`;
      case 'take':
        return `Took ${outCount} of ${inCount} items`;
      case 'skip':
        return `Skipped ${operator.params} items, ${outCount} remaining`;
      case 'first':
        return `Retrieved the first item`;
      case 'firstOrDefault':
        return outCount > 0 ? `Retrieved the first item` : `No items found, returned default`;
      case 'distinct':
        return `Removed duplicates: ${inCount} items → ${outCount} unique items`;
      case 'count':
        return `Counted ${inCount} items → result: ${outCount > 0 ? outputItems[0].value : 0}`;
      case 'any':
        return `Checked if any items exist → ${outCount > 0 ? outputItems[0].value : false}`;
      case 'all':
        return `Checked if all items match → ${outCount > 0 ? outputItems[0].value : false}`;
      default:
        return `Applied ${opDef?.name || operator.type}`;
    }
  }

  generateCSharpCode(inputData: DataItem[], operators: OperatorConfig[]): string {
    let code = '// LINQ Query\nvar result = data';

    operators.forEach((op) => {
      switch (op.type) {
        case 'where':
          code += `\n    .Where(${op.params})`;
          break;
        case 'select':
          code += `\n    .Select(${op.params})`;
          break;
        case 'orderBy':
          code += `\n    .OrderBy(${op.params})`;
          break;
        case 'orderByDescending':
          code += `\n    .OrderByDescending(${op.params})`;
          break;
        case 'take':
          code += `\n    .Take(${op.params})`;
          break;
        case 'skip':
          code += `\n    .Skip(${op.params})`;
          break;
        case 'first':
          code += `\n    .First()`;
          break;
        case 'firstOrDefault':
          code += `\n    .FirstOrDefault()`;
          break;
        case 'distinct':
          code += `\n    .Distinct()`;
          break;
        case 'count':
          code += `\n    .Count()`;
          break;
        case 'any':
          code += op.params ? `\n    .Any(${op.params})` : `\n    .Any()`;
          break;
        case 'all':
          code += `\n    .All(${op.params})`;
          break;
      }
    });

    code += ';';
    return code;
  }

  generateSampleData(count: number = 10): DataItem[] {
    const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];
    const shapes: Array<'circle' | 'square' | 'triangle' | 'star'> = [
      'circle',
      'square',
      'triangle',
      'star',
    ];

    return Array.from({ length: count }, (_, i) => ({
      id: crypto.randomUUID(),
      value: Math.floor(Math.random() * 100),
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: shapes[Math.floor(Math.random() * shapes.length)],
    }));
  }
}
