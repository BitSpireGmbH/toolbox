import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';

type VisualizerState = 'steady' | 'allocating' | 'copying' | 'adding' | 'discarding';

@Component({
  selector: 'app-list-visualizer',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-7xl mx-auto p-6">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-1">List&lt;T&gt; Visualizer</h1>
          <p class="text-sm text-gray-600">Visualize memory addresses and dynamic resizing in C# List&lt;T&gt;</p>
        </div>

        <div class="flex gap-2">
           <button
            (click)="reset()"
            [disabled]="state() !== 'steady'"
            class="px-4 py-2 rounded-lg border border-gray-300 font-medium text-sm hover:bg-gray-50 text-gray-700 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Reset
          </button>
        </div>
      </div>

      <!-- Information Box -->
      <div class="bg-blue-50 border-l-4 border-blue-500 rounded-lg mb-6 shadow-sm overflow-hidden">
        <button 
          (click)="isInfoExpanded.set(!isInfoExpanded())"
          class="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-100 transition-colors">
          <div class="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-blue-600 shrink-0">
              <path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
            <h3 class="font-semibold text-blue-900">How List&lt;T&gt; Works Internally</h3>
          </div>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke-width="2" 
            stroke="currentColor" 
            class="w-5 h-5 text-blue-600 transition-transform duration-200"
            [class.rotate-180]="isInfoExpanded()">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
        
        @if (isInfoExpanded()) {
          <div class="px-4 pb-4 pt-2">
            <p class="text-sm text-blue-800 leading-relaxed">
              A <span class="font-mono font-semibold">List&lt;T&gt;</span> uses an internal <strong>array</strong> for storage. Arrays have a <strong>fixed size</strong> in memory.
              When the list is first created, it has <strong>no internal array</strong> (capacity = 0). When you add the first element, it allocates an array with capacity 4 (or your specified initial capacity).
              When you try to add an element beyond the current capacity, the list must:
            </p>
            <ol class="text-sm text-blue-800 list-decimal list-inside mt-2 space-y-1 ml-2">
              <li>Allocate a <strong>new array</strong> at a different memory address (typically <strong>double</strong> the size)</li>
              <li>Copy all existing elements from the old array to the new one</li>
              <li>Add the new element to the new array</li>
              <li>Discard the old array (making it eligible for garbage collection)</li>
            </ol>
            <p class="text-sm text-blue-800 mt-2">
              This is why setting an appropriate initial capacity with <span class="font-mono font-semibold">new List&lt;T&gt;(capacity)</span> can improve performance when you know how many items you'll store.
            </p>
          </div>
        }
      </div>

      <!-- Controls -->
      <div class="bg-white rounded-xl shadow-md border border-gray-200 p-5 mb-6">
        <div class="flex flex-wrap items-start gap-4">
          <div class="min-w-[150px] flex flex-col">
             <label class="block text-xs font-semibold text-gray-700 mb-2">Initial Capacity</label>
             <input
                type="number"
                [(ngModel)]="initialCapacity"
                (change)="onInitialCapacityChange()"
                [disabled]="count() > 0 || state() !== 'steady'"
                min="0"
                max="1000"
                placeholder="0"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white shadow-sm disabled:bg-gray-100 disabled:text-gray-500" />
             @if (initialCapacity() > 0) {
               <p class="text-[10px] font-mono text-blue-600 mt-1 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                 new List&lt;T&gt;({{ initialCapacity() }})
               </p>
             } @else {
               <p class="text-[10px] text-gray-500 mt-1">Default: 0 (creates 4 on first add)</p>
             }
          </div>
          <div class="flex-1 min-w-[200px] flex flex-col">
             <label class="block text-xs font-semibold text-gray-700 mb-2">Element Value</label>
             <div class="flex gap-2">
                <input
                  type="text"
                  [(ngModel)]="inputValue"
                  (keyup.enter)="addItem()"
                  [disabled]="state() !== 'steady'"
                  placeholder="Enter a value..."
                  class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white shadow-sm disabled:bg-gray-100 disabled:text-gray-500" />
                <button
                  (click)="addItem()"
                  [disabled]="!inputValue() || state() !== 'steady'"
                  class="bg-brand-primary hover:bg-brand-secondary text-white px-4 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  @if (state() === 'steady') {
                    Add Item
                  } @else {
                    Processing...
                  }
                </button>
             </div>
          </div>
          
          <div class="flex gap-4 border-l border-gray-200 pl-4">
             <div>
                <span class="block text-xs font-semibold text-gray-500 uppercase">Count</span>
                <span class="text-2xl font-bold text-gray-900">{{ count() }}</span>
             </div>
             <div>
                <span class="block text-xs font-semibold text-gray-500 uppercase">Capacity</span>
                <span class="text-2xl font-bold text-blue-600">{{ capacity() }}</span>
             </div>
          </div>
        </div>
      </div>

      <!-- Visualization Area -->
      <div class="grid lg:grid-cols-3 gap-6">
         <!-- Main Visualizer -->
         <div class="lg:col-span-2 space-y-6">
            
            <!-- Current Array State -->
             <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden relative transition-all duration-700"
                  [class.opacity-40]="state() === 'discarding'"
                  [class.scale-95]="state() === 'discarding'">
               <div class="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                  <h3 class="font-semibold text-sm text-gray-700 flex items-center gap-2">
                     <div class="w-2 h-2 rounded-full" [class.bg-blue-500]="state() !== 'discarding' && capacity() > 0" [class.bg-gray-400]="state() === 'discarding' || capacity() === 0"></div>
                     @if (capacity() === 0) {
                        No Internal Array Yet
                     } @else {
                        Current Array @ <span class="font-mono text-gray-600">0x{{ baseAddress().toString(16).toUpperCase() }}</span>
                     }
                  </h3>
                  @if (state() === 'discarding') {
                      <span class="text-xs font-bold text-red-500">DISCARDING...</span>
                  }
               </div>
               
               <div class="p-6">
                  @if (capacity() === 0) {
                     <div class="text-center py-12 text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-16 h-16 mx-auto mb-3 opacity-50">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                        </svg>
                        <p class="font-medium text-sm">No internal array allocated</p>
                        <p class="text-xs mt-1">Add an item to trigger initial allocation</p>
                     </div>
                  } @else {
                     <div class="flex flex-wrap gap-x-2 gap-y-8">
                        @for (item of internalArray(); track $index) {
                        <div class="relative group">
                           <div 
                              class="relative w-16 h-16 sm:w-20 sm:h-20 border-2 rounded-lg flex items-center justify-center text-sm font-mono font-medium transition-all duration-300 z-10"
                              [class.border-blue-500]="item !== null"
                              [class.bg-blue-50]="item !== null"
                              [class.border-gray-200]="item === null"
                              [class.bg-gray-50]="item === null"
                              [class.border-dashed]="item === null"
                              [class.ring-2]="copyIndex() === $index"
                              [class.ring-green-400]="copyIndex() === $index"
                              [class.ring-offset-2]="copyIndex() === $index">
                              
                              <span class="truncate px-1 max-w-full" [title]="item || 'Empty'">{{ item || 'null' }}</span>
                              
                              <span class="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 font-sans">
                                 [{{ $index }}]
                              </span>
                           </div>

                            <!-- Memory Address -->
                            <div class="absolute -bottom-10 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 font-mono whitespace-nowrap">
                                0x{{ (baseAddress() + ($index * 8)).toString(16).toUpperCase() }}
                            </div>
                        </div>
                     }
                  </div>
                  }
               </div>
            </div>

            <!-- New Array (The "Next" Generation) -->
            @if (newArray()) {
               <div class="relative">
                  <!-- Arrow connecting arrays -->
                  <div class="absolute -top-6 left-10 text-gray-300 flex flex-col items-center">
                     <div class="h-4 w-0.5 bg-gray-300"></div>
                     <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                       <path d="M12 5v14M5 12l7 7 7-7"/>
                     </svg>
                  </div>

                  <div class="bg-blue-50 rounded-xl shadow-md border-2 border-blue-200 overflow-hidden relative animate-fade-in-up">
                     <div class="bg-blue-100 px-4 py-3 border-b border-blue-200 flex justify-between items-center">
                        <h3 class="font-semibold text-sm text-blue-900 flex items-center gap-2">
                           <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                           New Allocation @ <span class="font-mono text-blue-800">0x{{ newBaseAddress().toString(16).toUpperCase() }}</span>
                        </h3>
                        <span class="text-xs font-bold text-blue-700 uppercase tracking-wider">
                           {{ state() === 'allocating' ? 'Allocating...' : (state() === 'copying' ? 'Copying...' : 'Ready') }}
                        </span>
                     </div>
                     
                     <div class="p-6">
                        <div class="flex flex-wrap gap-x-2 gap-y-8">
                           @for (item of newArray(); track $index) {
                              <div class="relative">
                                 <div 
                                    class="relative w-16 h-16 sm:w-20 sm:h-20 border-2 rounded-lg flex items-center justify-center text-sm font-mono font-medium transition-all duration-500 z-10"
                                    [class.border-green-500]="item !== null"
                                    [class.bg-green-50]="item !== null"
                                    [class.border-blue-200]="item === null"
                                    [class.bg-white]="item === null"
                                    [class.border-dashed]="item === null"
                                    [class.scale-110]="copyIndex() === $index && state() === 'copying'"
                                    [class.shadow-lg]="copyIndex() === $index && state() === 'copying'">
                                    
                                    <span class="truncate px-1 max-w-full" [title]="item || 'Empty'">{{ item || 'null' }}</span>
                                    
                                    <span class="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 font-sans">
                                       [{{ $index }}]
                                    </span>
                                 </div>

                                  <!-- Memory Address -->
                                  <div class="absolute -bottom-10 left-1/2 -translate-x-1/2 text-[10px] text-blue-300 font-mono whitespace-nowrap">
                                      0x{{ (newBaseAddress() + ($index * 8)).toString(16).toUpperCase() }}
                                  </div>
                              </div>
                           }
                        </div>
                        
                        <div class="mt-8 text-xs text-blue-800 text-center font-medium">
                           @if (state() === 'allocating') {
                              Allocating contiguous memory block at 0x{{ newBaseAddress().toString(16).toUpperCase() }}...
                           } @else if (state() === 'copying') {
                              Copying items from old memory location to new location...
                           } @else if (state() === 'adding') {
                              Adding new item...
                           }
                        </div>
                     </div>
                  </div>
               </div>
            }
         </div>

         <!-- Info / Logs -->
         <div class="space-y-6">
            <div class="bg-gray-50 rounded-xl p-5 border border-gray-200">
               <h3 class="font-bold text-gray-900 mb-2">Internal State</h3>
               <div class="flex items-center gap-3 mb-4">
                  <div class="w-3 h-3 rounded-full"
                     [class.bg-green-500]="state() === 'steady'"
                     [class.bg-amber-500]="state() !== 'steady'"></div>
                  <span class="font-mono text-sm font-medium uppercase">{{ state() }}</span>
               </div>
               
               <p class="text-xs text-gray-600 leading-relaxed">
                  @if (state() === 'steady') {
                     Ready. List stores items contiguously starting at 0x{{ baseAddress().toString(16).toUpperCase() }}.
                  } @else if (state() === 'allocating') {
                     Capacity reached. Allocating new memory block at a different address.
                  } @else if (state() === 'copying') {
                     Iterating through the old array and copying elements to the new one.
                  } @else if (state() === 'discarding') {
                     Garbage Collection: The old memory block is abandoned and reference is updated.
                  }
               </p>
            </div>

            <!-- Log -->
             <div class="bg-gray-900 rounded-xl shadow-md border border-gray-700 overflow-hidden flex flex-col h-[400px]">
                <div class="bg-gray-800 px-4 py-2 border-b border-gray-700 flex justify-between items-center">
                   <h3 class="font-mono text-xs text-gray-300 font-semibold uppercase">Operation Log</h3>
                   <button (click)="clearLogs()" class="text-[10px] text-gray-400 hover:text-white uppercase">Clear</button>
                </div>
                <div class="p-4 overflow-y-auto font-mono text-xs space-y-2 flex-1 scroll-smooth" #logContainer>
                   @for (log of logs(); track $index) {
                      <div [class]="getLogColor(log.type)" class="border-b border-gray-800/50 pb-1 last:border-0">
                         <span class="opacity-50 text-[10px] block mb-0.5">[{{ log.time }}]</span>
                         {{ log.message }}
                      </div>
                   }
                   @if (logs().length === 0) {
                      <div class="text-gray-600 italic">No operations yet.</div>
                   }
                </div>
             </div>
         </div>
      </div>
    </div>
  `,
  styles: [`
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in-up {
      animation: fadeInUp 0.5s ease-out forwards;
    }
  `]
})
export class ListVisualizerComponent {
  protected readonly inputValue = signal<string>('');
  protected initialCapacity = signal<number>(0);
  protected readonly count = signal<number>(0);
  protected readonly capacity = signal<number>(0);
  protected readonly isInfoExpanded = signal<boolean>(false);
  
  protected readonly internalArray = signal<(string | null)[]>([]);
  protected readonly newArray = signal<(string | null)[] | null>(null);
  
  protected readonly state = signal<VisualizerState>('steady');
  protected readonly copyIndex = signal<number | null>(null);
  
  // Memory
  protected readonly baseAddress = signal<number>(0x5000);
  protected readonly newBaseAddress = signal<number>(0x0000);
  
  protected readonly logs = signal<{time: string, message: string, type: 'info' | 'success' | 'warning' | 'error'}[]>([]);

  constructor() {
     this.addLog('List<T> initialized with no internal array (Capacity = 0).', 'info');
  }

  protected onInitialCapacityChange(): void {
    const cap = this.initialCapacity();
    if (this.count() === 0 && cap >= 0) {
      this.capacity.set(cap);
      if (cap > 0) {
        this.internalArray.set(new Array(cap).fill(null));
        this.addLog(`Initial capacity set to ${cap}. Internal array allocated @ 0x${this.baseAddress().toString(16).toUpperCase()}.`, 'info');
      } else {
        this.internalArray.set([]);
        this.addLog('Initial capacity set to 0. No internal array allocated.', 'info');
      }
    }
  }

  protected async addItem(): Promise<void> {
    const val = this.inputValue();
    if (!val || this.state() !== 'steady') return;

    this.inputValue.set(''); // Clear input immediately

    // Handle initial allocation (capacity 0 -> 4 or initialCapacity)
    if (this.capacity() === 0) {
      const initialSize = this.initialCapacity() || 4;
      await this.initialAllocation(val, initialSize);
      return;
    }

    // Check if we need to resize
    if (this.count() === this.capacity()) {
       await this.resizeAndAdd(val);
    } else {
       this.simpleAdd(val);
    }
  }

  private async initialAllocation(val: string, size: number): Promise<void> {
    this.state.set('allocating');
    this.addLog(`First element added. Allocating initial array (Size ${size})...`, 'info');
    
    // Generate memory address
    const addr = 0x5000;
    this.baseAddress.set(addr);
    
    await this.delay(800);
    
    this.addLog(`Allocated array @ 0x${addr.toString(16).toUpperCase()}.`, 'info');
    const newArr = new Array(size).fill(null);
    newArr[0] = val;
    this.internalArray.set(newArr);
    this.capacity.set(size);
    this.count.set(1);
    
    await this.delay(600);
    
    this.state.set('steady');
    this.addLog(`Added "${val}" at index 0. Capacity: ${size}.`, 'success');
  }

  private simpleAdd(val: string): void {
     this.internalArray.update(arr => {
        const newArr = [...arr];
        newArr[this.count()] = val;
        return newArr;
     });
     this.count.update(c => c + 1);
     this.addLog(`Added "${val}" at index ${this.count() - 1}.`, 'success');
  }

  private async resizeAndAdd(val: string): Promise<void> {
     const oldCapacity = this.capacity();
     const newCapacity = oldCapacity * 2;
     
     // Generate new random memory address
     const nextAddr = this.baseAddress() + (oldCapacity * 16) + Math.floor(Math.random() * 4096) + 4096;
     this.newBaseAddress.set(nextAddr);
     
     // 1. ALLOCATING
     this.state.set('allocating');
     this.addLog(`Capacity limit (${oldCapacity}) reached. Triggering resize.`, 'warning');
     await this.delay(800);
     
     this.addLog(`Allocating new array (Size ${newCapacity}) at 0x${nextAddr.toString(16).toUpperCase()}...`, 'info');
     this.newArray.set(new Array(newCapacity).fill(null));
     await this.delay(1200);

     // 2. COPYING
     this.state.set('copying');
     this.addLog(`Starting Array.Copy()...`, 'info');
     await this.delay(500);

     const currentArr = this.internalArray();
     // We iterate through existing items to simulate copying
     for (let i = 0; i < currentArr.length; i++) {
        this.copyIndex.set(i);
        const itemToCopy = currentArr[i];
        
        // Update visual new array
        this.newArray.update(arr => {
           if (!arr) return null;
           const updated = [...arr];
           updated[i] = itemToCopy;
           return updated;
        });
        
        await this.delay(400); // Wait for user to see the copy
     }
     this.copyIndex.set(null);
     this.addLog(`Copied ${oldCapacity} items to new array.`, 'info');
     await this.delay(800);

     // 3. ADDING NEW ITEM
     this.state.set('adding');
     this.addLog(`Adding new item "${val}" to new array at index ${this.count()}...`, 'info');
     this.newArray.update(arr => {
        if (!arr) return null;
        const updated = [...arr];
        updated[this.count()] = val;
        return updated;
     });
     await this.delay(1000);

     // 4. DISCARDING / SWAPPING
     this.state.set('discarding');
     this.addLog('Swapping references: internal array now points to new array.', 'warning');
     this.addLog('Old array is dismissed (eligible for GC).', 'info');
     
     // Wait for fade out effect
     await this.delay(1500);

     // Apply the swap
     const newArr = this.newArray();
     if (newArr == null) {
       throw new Error('Unexpected null newArray during resizeAndAdd swap.');
     }
     this.internalArray.set(newArr);
     this.capacity.set(newCapacity);
     this.count.update(c => c + 1);
     this.baseAddress.set(nextAddr);
      
     // Cleanup
     this.newArray.set(null);
     this.state.set('steady');
     this.addLog(`Resize complete. New Capacity: ${newCapacity}.`, 'success');
  }

  protected reset(): void {
     const initCap = this.initialCapacity();
     this.count.set(0);
     this.capacity.set(initCap);
     if (initCap > 0) {
       this.internalArray.set(new Array(initCap).fill(null));
       this.baseAddress.set(0x5000);
       this.addLog(`Reset complete. Initial capacity: ${initCap} @ 0x5000.`, 'info');
     } else {
       this.internalArray.set([]);
       this.baseAddress.set(0x5000);
       this.addLog('Reset complete. No internal array (Capacity = 0).', 'info');
     }
     this.newArray.set(null);
     this.logs.set([]);
     this.state.set('steady');
     this.copyIndex.set(null);
     this.inputValue.set('');
  }

  protected clearLogs(): void {
    this.logs.set([]);
  }

  private addLog(message: string, type: 'info' | 'success' | 'warning' | 'error'): void {
     const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
     this.logs.update(logs => [{ time, message, type }, ...logs]);
  }

  protected getLogColor(type: string): string {
     switch (type) {
        case 'success': return 'text-green-400';
        case 'warning': return 'text-amber-400';
        case 'error': return 'text-red-400';
        default: return 'text-gray-300';
     }
  }

  private delay(ms: number): Promise<void> {
     return new Promise(resolve => setTimeout(resolve, ms));
  }
}