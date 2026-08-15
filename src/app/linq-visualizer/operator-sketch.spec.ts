import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { OperatorSketchComponent, SKETCHED_OPERATOR_IDS } from './operator-sketch';

/**
 * The sketches are keyed by ids the .NET catalog owns, so this file is also where the
 * coupling between the two sides gets stated out loud.
 */
describe('OperatorSketchComponent', () => {
  @Component({
    imports: [OperatorSketchComponent],
    template: `<app-operator-sketch [operatorId]="id()" />`,
  })
  class HostComponent {
    readonly id = signal('where-greater-than');
  }

  let fixture: ComponentFixture<HostComponent>;

  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => host().textContent ?? '';

  const show = async (id: string): Promise<void> => {
    fixture.componentInstance.id.set(id);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
  });

  it('shows what goes in and what comes out', () => {
    // Where(n => n > 2) over 1..5.
    expect(text()).toContain('1');
    expect(text()).toContain('5');
    expect(text()).toContain('can be fewer');
  });

  it('keeps the rejected values visible rather than omitting them', () => {
    // The point of Where is not only what survives - the rejected numbers were still
    // fetched and looked at, so they are struck through rather than absent.
    const struckThrough = Array.from(host().querySelectorAll('span')).filter(element =>
      element.className.includes('line-through')
    );

    expect(struckThrough.map(element => element.textContent?.trim())).toEqual(['1', '2']);
  });

  it('marks operators that cannot change how many items come out', async () => {
    await show('select-double');

    expect(text()).toContain('same count');
    expect(text()).not.toContain('can be fewer');
  });

  it('shows a reordering rather than a filter for sorts', async () => {
    await show('order-by-desc');

    expect(text()).toContain('same count');
    expect(host().querySelectorAll('.line-through').length).toBe(0);
  });

  it('renders nothing for an operator it has no picture for', async () => {
    // An operator added on the C# side must degrade quietly, not break the page.
    await show('not-a-real-operator');

    expect(text().trim()).toBe('');
  });

  it('shows a later number being dropped even though it would have passed', async () => {
    // TakeWhile's whole point. It is invisible on a sorted list, so the sketch uses an
    // unsorted one - the 3 and 4 are dropped because the 5 stopped it first.
    await show('take-while');

    const struckThrough = Array.from(host().querySelectorAll('span')).filter(element =>
      element.className.includes('line-through')
    );

    expect(struckThrough.map(element => element.textContent?.trim())).toEqual(['5', '3', '4']);
  });

  it('covers every operator the catalog currently serves', () => {
    // Kept in step by hand: the catalog lives in C# and is only available at runtime,
    // so this list is the tripwire if an operator is added there without a picture.
    expect([...SKETCHED_OPERATOR_IDS].sort()).toEqual([
      'distinct',
      'order-by-asc',
      'order-by-desc',
      'reverse',
      'select-double',
      'select-mod',
      'select-square',
      'skip',
      'skip-while',
      'take',
      'take-while',
      'where-even',
      'where-greater-than',
    ]);
  });
});
