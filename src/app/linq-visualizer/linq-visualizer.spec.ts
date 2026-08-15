import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  LinqCatalog,
  LinqRunResult,
  LinqVisualizerService,
} from '../services/linq-visualizer.service';
import { INPUT_DEBOUNCE_MS, LinqVisualizerComponent } from './linq-visualizer';

/**
 * jsdom cannot start the WebAssembly runtime, so the service is stubbed. What is worth
 * testing here is what the component itself decides: that the query is editable from
 * the moment the page opens, that the run is explained in plain words rather than left
 * as numbers, and that a runtime failure is stated instead of quietly approximated.
 */
describe('LinqVisualizerComponent', () => {
  let fixture: ComponentFixture<LinqVisualizerComponent>;

  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => host().textContent ?? '';

  const buttonWith = (label: string): HTMLButtonElement => {
    const found = Array.from(host().querySelectorAll('button')).find(button =>
      button.textContent?.includes(label)
    );
    if (!found) throw new Error(`No button containing "${label}"`);
    return found as HTMLButtonElement;
  };

  const CATALOG: LinqCatalog = {
    sources: [{ kind: 'numbers', label: 'Numbers', elementType: 'int' }],
    operators: [
      {
        id: 'where-greater-than',
        label: 'Where(n => n > N)',
        kind: 'streaming',
        argKind: 'number',
        defaultNumber: 3,
        sources: ['numbers'],
        hint: 'Keeps only the numbers bigger than N.',
        group: 'Filtering',
      },
      {
        id: 'select-double',
        label: 'Select(n => n * 2)',
        kind: 'streaming',
        sources: ['numbers'],
        hint: 'Doubles each number.',
        group: 'Changing each number',
      },
      {
        id: 'order-by-desc',
        label: 'OrderByDescending(n => n)',
        kind: 'buffering',
        sources: ['numbers'],
        hint: 'Sorts biggest first.',
        group: 'Reordering',
      },
    ],
    terminals: [
      {
        id: 'none',
        label: '(nothing)',
        sources: ['numbers'],
        hint: 'Nothing runs.',
        group: 'Runs nothing',
      },
      {
        id: 'toList',
        label: 'ToList()',
        sources: ['numbers'],
        hint: 'Fetches everything.',
        group: 'Needs every number',
      },
    ],
  };

  /** Mirrors the default query: 1..5, keep above 2, double, ToList(). */
  const RUN: LinqRunResult = {
    stages: [
      { index: 0, label: 'numbers (1..5)', kind: 'source' },
      { index: 1, label: 'Where(n => n > 2)', kind: 'streaming' },
      { index: 2, label: 'Select(n => n * 2)', kind: 'streaming' },
    ],
    events: [
      { step: 0, stage: 2, kind: 'pulled', pass: 0 },
      { step: 1, stage: 1, kind: 'pulled', pass: 0 },
      { step: 2, stage: 0, kind: 'pulled', pass: 0 },
      { step: 3, stage: 0, kind: 'yielded', value: '1', pass: 0 },
      { step: 4, stage: 0, kind: 'pulled', pass: 0 },
      { step: 5, stage: 0, kind: 'yielded', value: '3', pass: 0 },
      { step: 6, stage: 1, kind: 'yielded', value: '3', pass: 0 },
      { step: 7, stage: 2, kind: 'yielded', value: '6', pass: 0 },
    ],
    methodSyntax: 'var numbers = Enumerable.Range(1, 5);',
    resultText: '[6, 8, 10]  (3 items)',
    stats: { sourcePulls: 6, sourceYields: 5, totalEvents: 8, shortCircuited: false },
    truncated: false,
  };

  const NOTHING_RAN: LinqRunResult = {
    stages: [{ index: 0, label: 'numbers (1..5)', kind: 'source' }],
    events: [],
    methodSyntax: 'var numbers = Enumerable.Range(1, 5);',
    resultText: 'Nothing ran. The query has been built but never enumerated.',
    stats: { sourcePulls: 0, sourceYields: 0, totalEvents: 0, shortCircuited: false },
    truncated: false,
  };

  const settle = async (): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, INPUT_DEBOUNCE_MS + 25));
    await fixture.whenStable();
  };

  const create = async (overrides: Partial<Record<string, unknown>> = {}): Promise<void> => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [LinqVisualizerComponent],
      providers: [
        {
          provide: LinqVisualizerService,
          useValue: {
            runtimeStatus: () => 'ready',
            runtimeFailure: () => null,
            frameworkDescription: () => '.NET 10.0.3',
            loadCatalog: vi.fn(() => Promise.resolve(CATALOG)),
            run: vi.fn(() => Promise.resolve(RUN)),
            ...overrides,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LinqVisualizerComponent);
    await settle();
  };

  beforeEach(async () => {
    await create();
  });

  it('opens straight into an editable query with something already happening', () => {
    expect(host().querySelector('app-pipeline-builder')).not.toBeNull();
    expect(host().querySelector('app-pipeline-animation')).not.toBeNull();
  });

  it('keeps the explanation collapsed so the tool itself is what you land on', () => {
    expect(text()).toContain('New to this? Start here');
    expect(text()).not.toContain('chain of requests running');
  });

  it('explains the backwards-request idea when the primer is opened', async () => {
    buttonWith('New to this?').click();
    await settle();

    expect(text()).toContain('chain of requests running');
    expect(text()).toContain('backwards');
  });

  it('suggests things to try, so free play has somewhere to start', async () => {
    buttonWith('New to this?').click();
    await settle();

    expect(text()).toContain('Things worth trying');
    expect(text()).toContain('watch the whole query do nothing');
  });

  it('points at the sketches article for what each operator does', async () => {
    buttonWith('New to this?').click();
    await settle();

    const link = host().querySelector<HTMLAnchorElement>('a[href*="linq-explained-with-sketches"]');

    expect(link).not.toBeNull();
    expect(link?.textContent).toContain('LINQ explained with sketches');
    expect(link?.target).toBe('_blank');
    expect(link?.rel).toContain('noopener');
  });

  it('shows what you start with and what you end up with', () => {
    expect(text()).toContain('You start with');
    expect(text()).toContain('[1, 2, 3, 4, 5]');
    expect(text()).toContain('You end up with');
    expect(text()).toContain('[6, 8, 10]');
  });

  it('describes the run in plain words rather than leaving it as numbers', () => {
    expect(text()).toContain('What just happened');
    expect(text()).toContain('read all the way to the end');
    expect(text()).toContain('the intermediate lists you might picture never existed');
  });

  it('reports the cost of the query in ordinary language', () => {
    expect(text()).toContain('the list was asked');
    expect(text()).toContain('it handed over');
    expect(text()).toContain('stopped early');
  });

  it('calls out a step that has to collect everything first', async () => {
    await create({
      run: vi.fn(() =>
        Promise.resolve({
          ...RUN,
          stages: [
            { index: 0, label: 'numbers (1..5)', kind: 'source' as const },
            { index: 1, label: 'OrderByDescending(n => n)', kind: 'buffering' as const },
          ],
          events: [
            { step: 0, stage: 1, kind: 'pulled' as const, pass: 0 },
            { step: 1, stage: 0, kind: 'pulled' as const, pass: 0 },
            { step: 2, stage: 0, kind: 'yielded' as const, value: '1', pass: 0 },
            { step: 3, stage: 0, kind: 'exhausted' as const, pass: 0 },
            { step: 4, stage: 1, kind: 'yielded' as const, value: '5', pass: 0 },
          ],
        })
      ),
    });

    expect(text()).toContain('OrderByDescending had to collect every number');
    expect(text()).toContain('nothing downstream could stop early');
  });

  it('presents a query that never ran as the point, not as a blank screen', async () => {
    await create({ run: vi.fn(() => Promise.resolve(NOTHING_RAN)) });

    expect(text()).toContain('Nothing ran at all');
    expect(text()).toContain('just a written-down plan');

    const animation = host().querySelector('app-pipeline-animation');
    expect(animation?.textContent).toContain('Nothing happened at all');
  });

  it('keeps the C# and the step table tucked away until asked for', async () => {
    expect(host().querySelector('app-code-block')).toBeNull();
    expect(host().querySelector('app-enumeration-timeline')).toBeNull();

    buttonWith('See the C#').click();
    await settle();

    expect(host().querySelector('app-code-block')?.textContent).toContain(
      'Enumerable.Range(1, 5)'
    );
  });

  it('reports the framework version the runtime itself gave', () => {
    expect(text()).toContain('.NET 10.0.3');
  });

  it('refuses to fall back when the runtime cannot be loaded', async () => {
    await create({
      runtimeStatus: () => 'failed',
      runtimeFailure: () => 'network error',
      loadCatalog: vi.fn(() => Promise.reject(new Error('network error'))),
    });

    // The absence of a JavaScript fallback is deliberate and must be visible: an
    // approximation of .NET enumeration would teach the wrong thing.
    expect(text()).toContain('could not be loaded');
    expect(text()).toContain('no JavaScript fallback');
    expect(text()).toContain('network error');
  });
});
