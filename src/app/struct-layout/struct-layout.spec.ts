import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StructLayoutComponent } from './struct-layout';
import { StructLayoutService, type LayoutResult } from '../services/struct-layout.service';

describe('StructLayoutComponent', () => {
  const RESULT: LayoutResult = {
    target: 'X64',
    structs: [
      {
        name: 'Order',
        kind: 'Auto',
        size: 24,
        alignment: 8,
        paddingBytes: 3,
        pack: 0,
        trailingPadding: 3,
        fields: [
          { name: 'Customer', type: 'string', offset: 0, size: 8, alignment: 8, paddingBefore: 0, isExplicit: false, overlaps: false },
          { name: 'PlacedAtTicks', type: 'long', offset: 8, size: 8, alignment: 8, paddingBefore: 0, isExplicit: false, overlaps: false },
          { name: 'Id', type: 'int', offset: 16, size: 4, alignment: 4, paddingBefore: 0, isExplicit: false, overlaps: false },
          { name: 'Status', type: 'byte', offset: 20, size: 1, alignment: 1, paddingBefore: 0, isExplicit: false, overlaps: false },
        ],
        notes: ['This struct holds a GC reference, so CoreCLR lays it out automatically.'],
      },
    ],
    diagnostics: [],
    caveats: [],
  };

  let fixture: ComponentFixture<StructLayoutComponent>;
  let calculate: ReturnType<typeof vi.fn>;

  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const create = async (overrides: Partial<Record<string, unknown>> = {}): Promise<void> => {
    calculate = vi.fn(() => Promise.resolve(RESULT));

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [StructLayoutComponent],
      providers: [
        {
          provide: StructLayoutService,
          useValue: {
            runtimeStatus: () => 'ready',
            runtimeFailure: () => null,
            frameworkDescription: () => '.NET 10.0.3',
            calculate,
            ...overrides,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StructLayoutComponent);
    await settle();
  };

  beforeEach(async () => {
    await create();
  });

  const text = (): string => fixture.nativeElement.textContent as string;

  it('lays out the default struct on load', () => {
    expect(calculate).toHaveBeenCalled();
    expect(text()).toContain('Order');
    expect(text()).toContain('24 bytes');
  });

  it('renders every field with its offset', () => {
    const rows = text();

    expect(rows).toContain('Customer');
    expect(rows).toContain('PlacedAtTicks');
    expect(rows).toContain('Status');
  });

  it('shows trailing padding as its own row', () => {
    expect(text()).toContain('trailing padding');
  });

  it('shows the runtime note explaining why the order changed', () => {
    expect(text()).toContain('CoreCLR lays it out automatically');
  });

  it('recalculates when the target changes', async () => {
    calculate.mockClear();

    const select: HTMLSelectElement = fixture.nativeElement.querySelector('#layout-target');
    select.value = 'Wasm32';
    select.dispatchEvent(new Event('change'));
    await settle();

    expect(calculate).toHaveBeenCalledWith(expect.any(String), 'Wasm32');
  });

  it('reports the framework version the runtime says it is', () => {
    expect(text()).toContain('.NET 10.0.3');
  });

  it('refuses to guess when the runtime is unavailable', async () => {
    await create({
      runtimeStatus: () => 'failed',
      runtimeFailure: () => 'network error',
    });

    expect(text()).toContain('could not be loaded');
    expect(text()).toContain('network error');
    // No offset table at all, rather than an approximate one.
    expect(text()).not.toContain('Offset');
  });

  it('shows diagnostics for source it could not read', async () => {
    await create({
      calculate: vi.fn(() =>
        Promise.resolve({ ...RESULT, structs: [], diagnostics: ['unknown type `MyThing`'] })
      ),
    });

    expect(text()).toContain('unknown type');
  });

  it('shows the caveat that comes with a 32-bit target', async () => {
    await create({
      calculate: vi.fn(() =>
        Promise.resolve({ ...RESULT, caveats: ['32-bit target: references are 4 bytes.'] })
      ),
    });

    expect(text()).toContain('32-bit target');
  });

  it('shows a reorder suggestion when the runtime offers one', async () => {
    await create({
      calculate: vi.fn(() =>
        Promise.resolve({
          ...RESULT,
          structs: [
            {
              ...RESULT.structs[0],
              kind: 'Sequential',
              suggestion: { fieldOrder: ['B', 'A', 'C'], size: 16, paddingBytes: 0 },
            },
          ],
        })
      ),
    });

    expect(text()).toContain('8 bytes smaller');
    expect(text()).toContain('B, A, C');
  });
});
