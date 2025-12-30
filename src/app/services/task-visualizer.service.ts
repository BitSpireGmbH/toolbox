import { Injectable } from '@angular/core';

export interface AsyncPattern {
  type: 'await' | 'whenall' | 'whenany' | 'getawaiter' | 'task' | 'continuation';
  line: number;
  code: string;
  description: string;
}

export interface VisualizationResult {
  diagram: string;
  patterns: AsyncPattern[];
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TaskVisualizerService {
  /**
   * Analyzes C# async code and generates a Mermaid.js flowchart
   */
  analyzeCode(code: string): VisualizationResult {
    if (!code || code.trim().length === 0) {
      return {
        diagram: '',
        patterns: [],
        error: 'Please enter some code to visualize'
      };
    }

    try {
      const patterns = this.extractAsyncPatterns(code);
      const diagram = this.generateMermaidDiagram(code, patterns);
      
      return {
        diagram,
        patterns
      };
    } catch (error) {
      return {
        diagram: '',
        patterns: [],
        error: error instanceof Error ? error.message : 'An error occurred while analyzing the code'
      };
    }
  }

  /**
   * Extracts async/await patterns from C# code
   */
  private extractAsyncPatterns(code: string): AsyncPattern[] {
    const patterns: AsyncPattern[] = [];
    const lines = code.split('\n');

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmedLine = line.trim();

      // Detect await keyword
      if (trimmedLine.includes('await ') && !trimmedLine.startsWith('//')) {
        patterns.push({
          type: 'await',
          line: lineNum,
          code: trimmedLine,
          description: 'Execution pauses until the task completes. Control returns to the caller.'
        });
      }

      // Detect Task.WhenAll
      if (trimmedLine.includes('Task.WhenAll') || trimmedLine.includes('Task.WaitAll')) {
        const hasAwait = trimmedLine.includes('await ');
        patterns.push({
          type: 'whenall',
          line: lineNum,
          code: trimmedLine,
          description: hasAwait 
            ? 'Waits for all tasks to complete. Execution pauses here.'
            : 'Creates a task that completes when all tasks complete. Does NOT wait (no await).'
        });
      }

      // Detect Task.WhenAny
      if (trimmedLine.includes('Task.WhenAny') || trimmedLine.includes('Task.WaitAny')) {
        const hasAwait = trimmedLine.includes('await ');
        patterns.push({
          type: 'whenany',
          line: lineNum,
          code: trimmedLine,
          description: hasAwait
            ? 'Waits for any one task to complete. Execution pauses here.'
            : 'Creates a task that completes when any task completes. Does NOT wait (no await).'
        });
      }

      // Detect GetAwaiter().GetResult() or .Result or .Wait()
      if (trimmedLine.includes('.GetResult()') || 
          (trimmedLine.includes('.Result') && !trimmedLine.includes('GetAwaiter')) ||
          trimmedLine.includes('.Wait()')) {
        patterns.push({
          type: 'getawaiter',
          line: lineNum,
          code: trimmedLine,
          description: 'BLOCKS the current thread until the task completes. Can cause deadlocks!'
        });
      }

      // Detect Task.Run or Task.Factory.StartNew
      if ((trimmedLine.includes('Task.Run') || trimmedLine.includes('Task.Factory.StartNew')) 
          && !trimmedLine.includes('await ')) {
        patterns.push({
          type: 'task',
          line: lineNum,
          code: trimmedLine,
          description: 'Starts a task on the thread pool. Execution continues immediately (fire-and-forget).'
        });
      }

      // Detect .ContinueWith
      if (trimmedLine.includes('.ContinueWith')) {
        patterns.push({
          type: 'continuation',
          line: lineNum,
          code: trimmedLine,
          description: 'Adds a continuation that runs when the task completes. Execution continues immediately.'
        });
      }
    });

    return patterns;
  }

  /**
   * Generates Mermaid.js flowchart syntax from the code analysis
   */
  private generateMermaidDiagram(code: string, patterns: AsyncPattern[]): string {
    const lines = code.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('//'));
    
    if (patterns.length === 0) {
      return `flowchart TD
    Start([Start]) --> NoAsync[No async patterns detected]
    NoAsync --> End([End])
    
    style NoAsync fill:#fef3c7,stroke:#f59e0b,stroke-width:2px`;
    }

    let diagram = 'flowchart TD\n';
    diagram += '    Start([Start Execution]) --> L1\n';

    let nodeCount = 1;
    const patternsByLine = new Map<number, AsyncPattern>();
    patterns.forEach(p => patternsByLine.set(p.line, p));

    let previousNode = 'L1';
    let inAsyncBlock = false;

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const pattern = patternsByLine.get(lineNum);
      const currentNode = `L${nodeCount}`;
      const nextNode = `L${nodeCount + 1}`;

      // Simplify line display
      let displayLine = line.length > 40 ? line.substring(0, 37) + '...' : line;
      displayLine = displayLine.replace(/"/g, "'");

      if (pattern) {
        switch (pattern.type) {
          case 'await':
            diagram += `    ${currentNode}["${displayLine}"]\n`;
            diagram += `    ${currentNode} -->|"⏸️ Pauses execution"| Wait${nodeCount}[Task executes]\n`;
            diagram += `    Wait${nodeCount} -->|"▶️ Resumes"| ${nextNode}\n`;
            diagram += `    style ${currentNode} fill:#dbeafe,stroke:#3b82f6,stroke-width:2px\n`;
            diagram += `    style Wait${nodeCount} fill:#fef3c7,stroke:#f59e0b,stroke-width:2px\n`;
            inAsyncBlock = true;
            break;

          case 'whenall':
            if (line.includes('await ')) {
              diagram += `    ${currentNode}["${displayLine}"]\n`;
              diagram += `    ${currentNode} -->|"⏸️ Waits for ALL"| WaitAll${nodeCount}[All tasks execute]\n`;
              diagram += `    WaitAll${nodeCount} -->|"▶️ All complete"| ${nextNode}\n`;
              diagram += `    style ${currentNode} fill:#dbeafe,stroke:#3b82f6,stroke-width:2px\n`;
              diagram += `    style WaitAll${nodeCount} fill:#fef3c7,stroke:#f59e0b,stroke-width:2px\n`;
            } else {
              diagram += `    ${currentNode}["${displayLine}"]\n`;
              diagram += `    ${currentNode} -->|"✅ No wait, continues"| ${nextNode}\n`;
              diagram += `    style ${currentNode} fill:#bbf7d0,stroke:#22c55e,stroke-width:2px\n`;
            }
            break;

          case 'whenany':
            if (line.includes('await ')) {
              diagram += `    ${currentNode}["${displayLine}"]\n`;
              diagram += `    ${currentNode} -->|"⏸️ Waits for ANY"| WaitAny${nodeCount}[First task completes]\n`;
              diagram += `    WaitAny${nodeCount} -->|"▶️ One complete"| ${nextNode}\n`;
              diagram += `    style ${currentNode} fill:#dbeafe,stroke:#3b82f6,stroke-width:2px\n`;
              diagram += `    style WaitAny${nodeCount} fill:#fef3c7,stroke:#f59e0b,stroke-width:2px\n`;
            } else {
              diagram += `    ${currentNode}["${displayLine}"]\n`;
              diagram += `    ${currentNode} -->|"✅ No wait, continues"| ${nextNode}\n`;
              diagram += `    style ${currentNode} fill:#bbf7d0,stroke:#22c55e,stroke-width:2px\n`;
            }
            break;

          case 'getawaiter':
            diagram += `    ${currentNode}["${displayLine}"]\n`;
            diagram += `    ${currentNode} -->|"⛔ BLOCKS thread!"| Block${nodeCount}[Thread blocked]\n`;
            diagram += `    Block${nodeCount} -->|"Unblocks"| ${nextNode}\n`;
            diagram += `    style ${currentNode} fill:#fecaca,stroke:#ef4444,stroke-width:3px\n`;
            diagram += `    style Block${nodeCount} fill:#fee2e2,stroke:#dc2626,stroke-width:2px\n`;
            break;

          case 'task':
            diagram += `    ${currentNode}["${displayLine}"]\n`;
            diagram += `    ${currentNode} -->|"🔥 Fire and forget"| Async${nodeCount}[Task runs in background]\n`;
            diagram += `    ${currentNode} -->|"✅ Continues immediately"| ${nextNode}\n`;
            diagram += `    style ${currentNode} fill:#bbf7d0,stroke:#22c55e,stroke-width:2px\n`;
            diagram += `    style Async${nodeCount} fill:#e9d5ff,stroke:#a855f7,stroke-width:2px\n`;
            break;

          case 'continuation':
            diagram += `    ${currentNode}["${displayLine}"]\n`;
            diagram += `    ${currentNode} -->|"✅ Continues immediately"| ${nextNode}\n`;
            diagram += `    ${currentNode} -.->|"Later: continuation runs"| Cont${nodeCount}[Continuation]\n`;
            diagram += `    style ${currentNode} fill:#bbf7d0,stroke:#22c55e,stroke-width:2px\n`;
            diagram += `    style Cont${nodeCount} fill:#e9d5ff,stroke:#a855f7,stroke-width:2px\n`;
            break;
        }
        previousNode = nextNode;
        nodeCount++;
      } else if (line.length > 0 && !line.startsWith('//')) {
        // Regular line
        diagram += `    ${currentNode}["${displayLine}"]\n`;
        diagram += `    ${currentNode} --> ${nextNode}\n`;
        previousNode = nextNode;
        nodeCount++;
      }
    });

    diagram += `    ${previousNode} --> End([End Execution])\n`;
    diagram += '    style Start fill:#d1fae5,stroke:#10b981,stroke-width:2px\n';
    diagram += '    style End fill:#d1fae5,stroke:#10b981,stroke-width:2px\n';

    return diagram;
  }

  /**
   * Provides example code snippets for users to try
   */
  getExamples(): { title: string; code: string; description: string }[] {
    return [
      {
        title: 'Basic Await',
        description: 'Shows how await pauses execution until the task completes',
        code: `public async Task<string> FetchDataAsync()
{
    var client = new HttpClient();
    var response = await client.GetStringAsync("https://api.example.com/data");
    return response;
}`
      },
      {
        title: 'Task.WhenAll with Await',
        description: 'Waits for all tasks to complete before continuing',
        code: `public async Task ProcessMultipleAsync()
{
    var task1 = FetchUser();
    var task2 = FetchOrders();
    var task3 = FetchProducts();
    
    await Task.WhenAll(task1, task2, task3);
    
    Console.WriteLine("All tasks completed");
}`
      },
      {
        title: 'Task.WhenAll without Await',
        description: 'Creates a task but does NOT wait - execution continues immediately',
        code: `public async Task ProcessMultipleAsync()
{
    var task1 = FetchUser();
    var task2 = FetchOrders();
    
    var allTasks = Task.WhenAll(task1, task2);
    
    Console.WriteLine("This runs immediately!");
    
    await allTasks;
}`
      },
      {
        title: 'Fire and Forget',
        description: 'Starts a task but does not wait for it',
        code: `public void StartBackgroundWork()
{
    Task.Run(() => DoLongRunningWork());
    
    Console.WriteLine("This executes immediately");
}`
      },
      {
        title: 'Blocking Call (Anti-pattern)',
        description: 'BLOCKS the thread - can cause deadlocks!',
        code: `public string FetchDataSync()
{
    var task = FetchDataAsync();
    var result = task.GetAwaiter().GetResult();
    return result;
}`
      },
      {
        title: 'Task.WhenAny',
        description: 'Waits for the first task to complete',
        code: `public async Task<string> GetFastestResponseAsync()
{
    var task1 = FetchFromServer1();
    var task2 = FetchFromServer2();
    
    var completedTask = await Task.WhenAny(task1, task2);
    return await completedTask;
}`
      }
    ];
  }
}
