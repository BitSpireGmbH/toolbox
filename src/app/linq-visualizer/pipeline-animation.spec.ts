import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { LinqStage, LinqTraceEvent } from '../services/linq-visualizer.service';
import { narrate } from './linq-narration';
import { PipelineAnimationComponent } from './pipeline-animation';

/**
 * The animation is the tool's centrepiece, so its non-empty state is worth exercising
 * directly rather than only through the page around it.
 */
describe('PipelineAnimationComponent', () => {
  const STAGES: LinqStage[] = [
    { index: 0, label: 'numbers (1..4)', kind: 'source' },
    { index: 1, label: 'Where(n => n > 2)', kind: 'streaming' },
    { index: 2, label: 'OrderByDescending(n => n)', kind: 'buffering' },
  ];

  const event = (
    step: number,
    stage: number,
    kind: LinqTraceEvent['kind'],
    value?: string
  ): LinqTraceEvent => ({ step, stage, kind, value, pass: 0 });

  const EVENTS: LinqTraceEvent[] = [
    event(0, 2, 'pulled'),
    event(1, 1, 'pulled'),
    event(2, 0, 'pulled'),
    event(3, 0, 'yielded', '1'),
    event(4, 0, 'pulled'),
    event(5, 0, 'yielded', '3'),
    event(6, 1, 'yielded', '3'),
  ];

  @Component({
    imports: [PipelineAnimationComponent],
    template: `
      <app-pipeline-animation
        [stages]="stages()"
        [steps]="steps()"
        [terminalLabel]="'ToList()'"
        [sourceCount]="4"
        [resultText]="'[3]  (1 items)'"
        [stats]="stats()"
      />
    `,
  })
  class HostComponent {
    readonly stages = signal(STAGES);
    readonly steps = signal(narrate(STAGES, EVENTS, 'ToList()'));
    readonly stats = signal({
      sourcePulls: 2,
      sourceYields: 2,
      totalEvents: 7,
      shortCircuited: true,
    });
  }

  let fixture: ComponentFixture<HostComponent>;

  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => host().textContent ?? '';

  const buttonWith = (label: string): HTMLButtonElement | undefined =>
    Array.from(host().querySelectorAll('button')).find(button =>
      button.textContent?.trim().startsWith(label)
    ) as HTMLButtonElement | undefined;

  /** The step controls are icon-only, so they are found by their accessible name. */
  const control = (ariaLabel: string): HTMLButtonElement => {
    const found = host().querySelector<HTMLButtonElement>(`button[aria-label="${ariaLabel}"]`);
    if (!found) throw new Error(`No control labelled "${ariaLabel}"`);
    return found;
  };

  const next = async (): Promise<void> => {
    control('Next step').click();
    await fixture.whenStable();
  };

  /** Playback starts on its own, so tests pin it to a known step first. */
  const pause = async (): Promise<void> => {
    buttonWith('Pause')?.click();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    await pause();
  });

  it('draws a box for the list, each step, and the terminal', () => {
    expect(text()).toContain('the list');
    expect(text()).toContain('Where');
    expect(text()).toContain('OrderByDescending');
    expect(text()).toContain('ToList');
  });

  it('distinguishes steps that stream from steps that must collect everything', () => {
    expect(text()).toContain('passes through');
    expect(text()).toContain('collects all first');
  });

  it('narrates the current step in plain words', () => {
    // Step 0 of the trace: the terminal asking the last operator.
    expect(text()).toContain('ToList needs a number, so it asks OrderByDescending.');
  });

  it('walks forward through the trace one step at a time', async () => {
    await next();
    expect(text()).toContain('OrderByDescending needs a number, so it asks Where.');

    await next();
    expect(text()).toContain('Where needs a number, so it asks the list.');
  });

  it('shows a number being thrown away when a filter rejects it', async () => {
    // Steps 0-3 lead to the list handing over 1; step 4 is Where rejecting it.
    for (let index = 0; index < 4; index++) {
      await next();
    }

    expect(text()).toContain('Where looked at 1 and threw it away');
  });

  it('counts how many times each step has been asked', () => {
    expect(text()).toContain('asked 0×');
  });

  it('shows the position in the trace', () => {
    expect(text()).toContain('1 / 7');
  });

  it('carries the input, the answer and the running cost alongside the diagram', () => {
    // These used to be three separate cards, which split one continuous idea into
    // several things to look at.
    expect(text()).toContain('You start with');
    expect(text()).toContain('You end up with');
    expect(text()).toContain('[3]  (1 items)');
    expect(text()).toContain('the list was asked');
    expect(text()).toContain('stopped early');
  });
});
