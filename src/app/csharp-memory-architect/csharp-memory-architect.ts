import { Component, signal, effect, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Variable {
  name: string;
  type: string;
  value: string | number;
  address?: string;
  isReference: boolean;
  referencesAddress?: string;
}

interface StackFrame {
  methodName: string;
  variables: Variable[];
}

interface HeapObject {
  address: string;
  type: string;
  fields: Variable[];
  isBoxed?: boolean;
}

@Component({
  selector: 'app-csharp-memory-architect',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-7xl mx-auto p-6">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 mb-2">C# Memory Architect</h1>
          <p class="text-gray-600">Understand Stack vs. Heap, Value vs. Reference types, and Memory Scopes.</p>
        </div>
        <div class="flex gap-2">
          <button
            (click)="resetCode()"
            class="px-4 py-2 rounded-lg border border-gray-300 font-medium text-sm hover:bg-gray-50 text-gray-700 transition-all flex items-center gap-2 shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Reset Code
          </button>
        </div>
      </div>

      <div class="grid lg:grid-cols-12 gap-8">
        <!-- Editor Section -->
        <div class="lg:col-span-5 flex flex-col gap-4">
          <div class="bg-gray-900 rounded-xl overflow-hidden border border-gray-700 shadow-xl flex flex-col h-[600px]">
            <div class="bg-gray-800 px-4 py-2 border-b border-gray-700 flex justify-between items-center">
              <div class="flex items-center gap-2">
                <div class="flex gap-1.5">
                  <div class="w-3 h-3 rounded-full bg-red-500"></div>
                  <div class="w-3 h-3 rounded-full bg-amber-500"></div>
                  <div class="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <span class="text-gray-400 text-xs font-mono ml-2">memory_playground.cs</span>
              </div>
            </div>
            <textarea
              [ngModel]="code()"
              (ngModelChange)="code.set($event)"
              class="flex-1 w-full p-4 bg-gray-900 text-gray-100 font-mono text-sm focus:outline-none resize-none leading-relaxed"
              spellcheck="false"
              placeholder="// Write your C# code here..."
            ></textarea>
          </div>
          
          <div class="bg-blue-50 p-5 rounded-xl border border-blue-100 shadow-sm">
            <h3 class="text-blue-900 font-bold text-sm mb-3 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
              </svg>
              Interactive Visualization
            </h3>
            <div class="space-y-2">
              <p class="text-blue-800 text-sm leading-relaxed">
                Try these patterns to see how memory changes:
              </p>
              <ul class="text-blue-700 text-xs space-y-1 ml-4 list-disc">
                <li>Assign a <code class="bg-blue-100 px-1 rounded">struct</code> to <code class="bg-blue-100 px-1 rounded">object</code> to see <strong>Boxing</strong>.</li>
                <li>Create a <code class="bg-blue-100 px-1 rounded">class</code> to see <strong>Heap allocation</strong>.</li>
                <li>Use <code class="bg-blue-100 px-1 rounded">ref</code> or <code class="bg-blue-100 px-1 rounded">out</code> to see <strong>Extended Scopes</strong>.</li>
                <li>Write a <strong>lambda</strong> that captures a local to see <strong>Variable Lifting</strong>.</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Visualization Section -->
        <div class="lg:col-span-7 space-y-8">
          
          <!-- Memory Stats -->
          <div class="grid grid-cols-2 gap-4">
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <span class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Stack Depth</span>
              <span class="text-2xl font-black text-indigo-600">{{ stack().length }} <span class="text-sm font-normal text-gray-500">Frames</span></span>
            </div>
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <span class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Heap Objects</span>
              <span class="text-2xl font-black text-purple-600">{{ heap().length }} <span class="text-sm font-normal text-gray-500">Allocations</span></span>
            </div>
          </div>

          <!-- The Stack -->
          <div class="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div class="bg-indigo-600 px-6 py-3 flex justify-between items-center">
              <h2 class="font-bold text-white uppercase text-xs tracking-widest flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0-3.75-3.75M17.25 21l3.75-3.75" />
                </svg>
                The Stack
              </h2>
              <span class="text-indigo-200 text-[10px] font-mono italic">LIFO (Last In, First Out)</span>
            </div>
            
            <div class="p-6 flex flex-col-reverse gap-4">
              @for (frame of stack(); track $index) {
                <div class="border-2 border-indigo-100 rounded-xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div class="bg-indigo-50 px-4 py-2 border-b border-indigo-100 flex justify-between items-center">
                    <span class="text-indigo-900 font-mono text-sm font-bold">{{ frame.methodName }}</span>
                    <span class="bg-indigo-200 text-indigo-700 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">Frame</span>
                  </div>
                  <div class="p-4 space-y-3 bg-white">
                    @for (variable of frame.variables; track $index) {
                      <div class="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100 relative group transition-all hover:border-indigo-300 hover:bg-indigo-50/30">
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2 mb-1">
                            <span class="text-[9px] font-black text-indigo-500 uppercase tracking-tight">{{ variable.type }}</span>
                            <span class="font-mono text-sm text-gray-900 font-bold truncate">{{ variable.name }}</span>
                          </div>
                          <div class="font-mono text-xs text-gray-500 flex items-center gap-2">
                            <span class="opacity-50">Value:</span>
                            <span class="text-gray-700 truncate" [title]="variable.value">{{ variable.value }}</span>
                          </div>
                        </div>
                        
                        @if (variable.isReference) {
                          <div class="shrink-0 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center shadow-lg shadow-purple-200 animate-pulse-slow" title="References heap address">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5 text-white">
                              <path fill-rule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                            </svg>
                          </div>
                        } @else {
                           <div class="shrink-0 w-8 h-8 bg-indigo-100 rounded flex items-center justify-center border border-indigo-200" title="Primitive / Value Type">
                              <span class="text-indigo-400 font-bold text-[10px]">VAL</span>
                           </div>
                        }
                      </div>
                    }
                  </div>
                </div>
              }
              @if (stack().length === 0) {
                <div class="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                  <p class="text-gray-400 text-sm font-medium">Define a method like <code class="bg-gray-200 px-1 rounded">void Main()</code> to start</p>
                </div>
              }
            </div>
          </div>

          <!-- The Heap -->
          <div class="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div class="bg-purple-600 px-6 py-3 flex justify-between items-center">
              <h2 class="font-bold text-white uppercase text-xs tracking-widest flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
                The Heap
              </h2>
              <span class="text-purple-200 text-[10px] font-mono italic">Dynamic Allocation</span>
            </div>
            
            <div class="p-6 grid sm:grid-cols-2 gap-6 bg-gray-50/50">
              @for (obj of heap(); track $index) {
                <div class="group border-2 border-purple-100 rounded-2xl overflow-hidden bg-white shadow-sm relative transition-all hover:shadow-lg hover:-translate-y-1" 
                     [class.border-amber-200]="obj.isBoxed" [class.bg-amber-50]="obj.isBoxed">
                  
                  <div class="bg-purple-50 px-4 py-2 border-b border-purple-100 flex justify-between items-center" 
                       [class.bg-amber-100]="obj.isBoxed" [class.border-amber-200]="obj.isBoxed">
                    <div class="flex flex-col">
                      <span class="text-purple-900 font-mono text-xs font-black">{{ obj.type }}</span>
                      <span class="text-[8px] font-mono text-purple-400">Object Header + VTable</span>
                    </div>
                    <span class="text-purple-400 text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-purple-100">{{ obj.address }}</span>
                  </div>

                  @if (obj.isBoxed) {
                    <div class="absolute top-8 right-2 bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg z-10 uppercase tracking-tighter ring-2 ring-white">Boxed</div>
                  }

                  <div class="p-4 space-y-2">
                    @for (field of obj.fields; track $index) {
                       <div class="flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
                         <div class="flex flex-col">
                           <span class="text-gray-400 text-[8px] uppercase font-bold">{{ field.type }}</span>
                           <span class="text-gray-600 font-mono text-xs">{{ field.name }}</span>
                         </div>
                         <span class="text-gray-900 font-mono text-sm font-medium">{{ field.value }}</span>
                       </div>
                    }
                    @if (obj.fields.length === 0) {
                      <div class="text-[10px] text-gray-400 italic py-2">No accessible fields</div>
                    }
                  </div>
                  
                  <!-- Memory Representation -->
                  <div class="bg-gray-900 px-4 py-1.5 flex gap-1 overflow-hidden opacity-20 group-hover:opacity-100 transition-opacity">
                    @for (i of [1,2,3,4,5,6,7,8]; track i) {
                      <div class="w-2 h-2 bg-purple-400 rounded-sm"></div>
                    }
                  </div>
                </div>
              }
              @if (heap().length === 0) {
                <div class="col-span-full text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                  <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8 text-gray-300">
                      <path stroke-linecap="round" stroke-linejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                    </svg>
                  </div>
                  <p class="text-gray-400 text-sm font-medium italic">Heap is currently empty</p>
                </div>
              }
            </div>
          </div>

          <!-- Legend -->
          <div class="bg-gray-800 rounded-xl p-4 text-white">
            <h4 class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Memory Legend</h4>
            <div class="grid grid-cols-2 gap-4">
              <div class="flex items-center gap-2 text-xs">
                <div class="w-3 h-3 bg-indigo-500 rounded-sm"></div>
                <span>Stack Frame / Value Type</span>
              </div>
              <div class="flex items-center gap-2 text-xs">
                <div class="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span>Heap Reference / Pointer</span>
              </div>
              <div class="flex items-center gap-2 text-xs">
                <div class="w-3 h-3 bg-amber-500 rounded-sm ring-1 ring-white"></div>
                <span>Boxed Value (on Heap)</span>
              </div>
              <div class="flex items-center gap-2 text-xs text-indigo-300">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3 h-3">
                  <path fill-rule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
                <span>Pointer Connection</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      background-color: #f8fafc;
      min-height: 100vh;
    }
    textarea::selection {
      background: #4f46e5;
      color: white;
    }
    @keyframes pulse-slow {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.8; transform: scale(1.05); }
    }
    .animate-pulse-slow {
      animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
  `]
})
export class CsharpMemoryArchitectComponent {
  code = signal<string>(`struct Point 
{ 
    public int X; 
    public int Y; 
}

class Person 
{ 
    public string Name; 
}

void Main() 
{
    // Structs are value types (on stack)
    Point p = new Point { X = 1, Y = 2 };

    // Classes are reference types (on heap)
    Person person = new Person { Name = "Alice" };

    // Boxing: Struct moved to heap
    object boxed = p;

    // Closures: Capturing local 'p'
    var action = () => { var x = p.X; };

    Process(out int result);
}

void Process(out int val) 
{
    val = 42;
}`);

  stack = signal<StackFrame[]>([]);
  heap = signal<HeapObject[]>([]);

  private nextAddress = 0x1000;

  constructor() {
    effect(() => {
      this.analyzeCode(this.code());
    });
  }

  resetCode() {
    this.code.set(`struct Point 
{ 
    public int X; 
    public int Y; 
}

class Person 
{ 
    public string Name; 
}

void Main() 
{
    // Structs are value types (on stack)
    Point p = new Point { X = 1, Y = 2 };

    // Classes are reference types (on heap)
    Person person = new Person { Name = "Alice" };

    // Boxing: Struct moved to heap
    object boxed = p;

    // Closures: Capturing local 'p'
    var action = () => { var x = p.X; };

    Process(out int result);
}

void Process(out int val) 
{
    val = 42;
}`);
  }

  analyzeCode(code: string) {
    const newStack: StackFrame[] = [];
    const newHeap: HeapObject[] = [];
    this.nextAddress = 0x1000;

    const lines = code.split(/\r?\n/);
    
    // 1. Identify Types
    const structs = new Set<string>();
    const classes = new Set<string>();
    const primitives = new Set(['int', 'float', 'double', 'bool', 'char', 'long', 'byte', 'decimal', 'string']);

    lines.forEach(line => {
      const sMatch = line.match(/struct\s+(\w+)/);
      if (sMatch) structs.add(sMatch[1]);
      
      const cMatch = line.match(/class\s+(\w+)/);
      if (cMatch) classes.add(cMatch[1]);
    });

    // 2. Track Frames
    let currentFrame: StackFrame | null = null;

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//')) return;

      // Method entry
      const methodMatch = trimmed.match(/void\s+(\w+)\(.*\)/);
      if (methodMatch) {
        currentFrame = { methodName: methodMatch[1] + '()', variables: [] };
        newStack.push(currentFrame);
      }

      if (!currentFrame) return;

      // Variable declaration
      const declRegex = /(?:var|(\w+))\s+(\w+)\s*=\s*(.*);/;
      const declMatch = trimmed.match(declRegex);

      if (declMatch) {
        let type = declMatch[1] || 'var';
        const name = declMatch[2];
        const rval = declMatch[3].trim();

        if (type === 'var') {
          if (rval.startsWith('new ')) {
             const typeMatch = rval.match(/new\s+(\w+)/);
             if (typeMatch) type = typeMatch[1];
          } else if (rval.startsWith('"')) {
             type = 'string';
          } else if (!isNaN(Number(rval))) {
             type = 'int';
          } else if (rval.includes('=>')) {
             type = 'Action';
          }
        }

        if (primitives.has(type)) {
           if (type === 'string') {
              const addr = this.getNewAddress();
              newHeap.push({ address: addr, type: 'String', fields: [{ name: 'Value', type: 'string', value: rval, isReference: false }] });
              currentFrame.variables.push({ name, type, value: addr, isReference: true, referencesAddress: addr });
           } else {
              currentFrame.variables.push({ name, type, value: rval, isReference: false });
           }
        } else if (structs.has(type)) {
           currentFrame.variables.push({ name, type, value: '(Value)', isReference: false });
        } else if (classes.has(type)) {
           const addr = this.getNewAddress();
           newHeap.push({ address: addr, type, fields: [] });
           currentFrame.variables.push({ name, type, value: addr, isReference: true, referencesAddress: addr });
        } else if (type === 'object') {
           const existingVar = currentFrame.variables.find(v => v.name === rval);
           if (existingVar && !existingVar.isReference) {
              const addr = this.getNewAddress();
              newHeap.push({
                address: addr,
                type: existingVar.type,
                isBoxed: true,
                fields: [{ name: 'Value', type: existingVar.type, value: existingVar.value, isReference: false }]
              });
              currentFrame.variables.push({ name, type, value: addr, isReference: true, referencesAddress: addr });
           } else {
              const addr = this.getNewAddress();
              newHeap.push({ address: addr, type: 'Object', fields: [] });
              currentFrame.variables.push({ name, type, value: addr, isReference: true, referencesAddress: addr });
           }
        } else if (type === 'Action' || rval.includes('=>')) {
           const addr = this.getNewAddress();
           const captured = this.findCapturedVariables(rval, currentFrame.variables);
           newHeap.push({
             address: addr,
             type: 'Closure (Generated Class)',
             fields: captured.map(v => ({ ...v, name: '<>__captured_' + v.name }))
           });
           currentFrame.variables.push({ name, type: 'Action', value: addr, isReference: true, referencesAddress: addr });
        }
      }

      const outMatch = trimmed.match(/(\w+)\(out\s+(\w+)\s+(\w+)\)/);
      if (outMatch) {
         const outType = outMatch[2];
         const outName = outMatch[3];
         currentFrame.variables.push({ name: outName, type: outType, value: '?', isReference: false });
         
         const subFrame: StackFrame = { 
           methodName: outMatch[1] + '()', 
           variables: [{ name: 'val', type: outType + ' (ref)', value: 'Pointer to ' + outName, isReference: true }] 
         };
         newStack.push(subFrame);
      }
    });

    this.stack.set(newStack);
    this.heap.set(newHeap);
  }

  private findCapturedVariables(lambda: string, currentVars: Variable[]): Variable[] {
    return currentVars.filter(v => lambda.includes(v.name));
  }

  private getNewAddress(): string {
    const addr = '0x' + this.nextAddress.toString(16).toUpperCase();
    this.nextAddress += 0x100;
    return addr;
  }
}
