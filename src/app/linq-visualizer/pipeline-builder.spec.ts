import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import {
  LinqCatalog,
  LinqOperatorInfo,
  LinqPipelineSpec,
} from '../services/linq-visualizer.service';
import { PipelineBuilderComponent } from './pipeline-builder';

/**
 * The palette grew past a dozen operators, so how it is organised matters as much as
 * what is in it.
 */
describe('PipelineBuilderComponent', () => {
  const operator = (
    id: string,
    label: string,
    group: string,
    kind: 'streaming' | 'buffering' = 'streaming'
  ): LinqOperatorInfo => ({ id, label, kind, sources: ['numbers'], hint: `${label} hint`, group });

  const CATALOG: LinqCatalog = {
    sources: [{ kind: 'numbers', label: 'Numbers', elementType: 'int' }],
    operators: [
      operator('where-greater-than', 'Where(n => n > N)', 'Filtering'),
      operator('distinct', 'Distinct()', 'Filtering'),
      operator('select-double', 'Select(n => n * 2)', 'Changing each number'),
      operator('order-by-desc', 'OrderByDescending(n => n)', 'Reordering', 'buffering'),
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
        id: 'first',
        label: 'First()',
        sources: ['numbers'],
        hint: 'Stops at the first.',
        group: 'Can stop early',
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

  const SPEC: LinqPipelineSpec = {
    source: { kind: 'numbers', count: 5 },
    operators: [{ id: 'where-greater-than', number: 2 }],
    terminal: 'toList',
    enumerateTwice: false,
  };

  @Component({
    imports: [PipelineBuilderComponent],
    template: `
      <app-pipeline-builder
        [catalog]="catalog()"
        [spec]="spec()"
        (specChange)="patches.push($event)"
      />
    `,
  })
  class HostComponent {
    readonly catalog = signal(CATALOG);
    readonly spec = signal(SPEC);
    readonly patches: Partial<LinqPipelineSpec>[] = [];
  }

  let fixture: ComponentFixture<HostComponent>;

  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => host().textContent ?? '';

  const buttonWith = (label: string): HTMLButtonElement => {
    const found = Array.from(host().querySelectorAll('button')).find(button =>
      button.textContent?.includes(label)
    );
    if (!found) throw new Error(`No button containing "${label}"`);
    return found as HTMLButtonElement;
  };

  const openPalette = async (): Promise<void> => {
    buttonWith('Add a step').click();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
  });

  it('files the palette under headings rather than one long list', async () => {
    await openPalette();

    expect(text()).toContain('Filtering');
    expect(text()).toContain('Changing each number');
    expect(text()).toContain('Reordering');
  });

  it('keeps the catalog ordering instead of sorting the groups alphabetically', async () => {
    await openPalette();

    const headings = Array.from(host().querySelectorAll('div'))
      .map(element => element.textContent?.trim())
      .filter((value): value is string =>
        value === 'Filtering' || value === 'Changing each number' || value === 'Reordering'
      );

    // The .NET catalog orders these roughly as a beginner meets them.
    expect(headings[0]).toBe('Filtering');
    expect(headings.at(-1)).toBe('Reordering');
  });

  it('groups the terminals by whether they can stop early', () => {
    const groups = Array.from(host().querySelectorAll('optgroup')).map(element => element.label);

    expect(groups).toEqual(['Runs nothing', 'Can stop early', 'Needs every number']);
  });

  it('selects the terminal the spec actually names', () => {
    // A plain [value] binding on the select silently lost this, leaving the dropdown
    // reading "(nothing)" while the query ran ToList().
    const select = host().querySelector<HTMLSelectElement>('#linq-terminal');

    expect(select?.value).toBe('toList');
  });

  it('emits only what changed, so edits in one tick cannot overwrite each other', async () => {
    buttonWith('Add a step').click();
    await fixture.whenStable();
    buttonWith('Distinct()').click();
    await fixture.whenStable();

    const patch = fixture.componentInstance.patches.at(-1);

    expect(Object.keys(patch ?? {})).toEqual(['operators']);
    expect(patch?.operators).toHaveLength(2);
  });

  it('marks the steps that have to collect everything before yielding', async () => {
    await openPalette();

    const sortCard = buttonWith('OrderByDescending');
    expect(sortCard.textContent).toContain('same count');
  });
});
