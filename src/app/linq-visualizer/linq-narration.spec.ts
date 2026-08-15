import { describe, it, expect } from 'vitest';
import { LinqStage, LinqTraceEvent } from '../services/linq-visualizer.service';
import { narrate, shortName } from './linq-narration';

/**
 * The sentences are the tool's actual teaching payload, so the wording rules are
 * pinned here. The load-bearing case is a `pulled` that follows a `yielded` at the
 * same stage: the operator downstream took a number and immediately asked for
 * another. Whether that means "rejected it" or "collecting them all" depends on the
 * operator, and getting it backwards would teach the opposite of the truth.
 */
describe('narrate', () => {
  const source: LinqStage = { index: 0, label: 'numbers (1..4)', kind: 'source' };

  const event = (
    step: number,
    stage: number,
    kind: LinqTraceEvent['kind'],
    value?: string
  ): LinqTraceEvent => ({ step, stage, kind, value, pass: 0 });

  const textsFor = (stages: LinqStage[], events: LinqTraceEvent[]): string[] =>
    narrate(stages, events, 'ToList()').map(step => step.text);

  it('names the terminal operator as the thing asking at the end of the chain', () => {
    const stages = [source, { index: 1, label: 'Where(n => n > 2)', kind: 'streaming' as const }];

    const texts = textsFor(stages, [event(0, 1, 'pulled')]);

    expect(texts[0]).toBe('ToList needs a number, so it asks Where.');
  });

  it('calls the source "the list" rather than showing its internals', () => {
    const stages = [source, { index: 1, label: 'Where(n => n > 2)', kind: 'streaming' as const }];

    const texts = textsFor(stages, [event(0, 0, 'pulled'), event(1, 0, 'yielded', '1')]);

    expect(texts[0]).toBe('Where needs a number, so it asks the list.');
    expect(texts[1]).toBe('The list hands over 1.');
  });

  it('says a streaming operator threw a number away when it asks again', () => {
    const stages = [source, { index: 1, label: 'Where(n => n > 2)', kind: 'streaming' as const }];

    const texts = textsFor(stages, [
      event(0, 0, 'pulled'),
      event(1, 0, 'yielded', '1'),
      event(2, 0, 'pulled'),
    ]);

    expect(texts[2]).toBe('Where looked at 1 and threw it away, so it asks the list for another.');
  });

  it('says a buffering operator is collecting, not discarding', () => {
    // Same event shape as the rejection above. Only the operator's kind differs, and
    // describing a sort as "threw it away" would be actively misleading.
    const stages = [
      source,
      { index: 1, label: 'OrderByDescending(n => n)', kind: 'buffering' as const },
    ];

    const texts = textsFor(stages, [
      event(0, 0, 'pulled'),
      event(1, 0, 'yielded', '1'),
      event(2, 0, 'pulled'),
    ]);

    expect(texts[2]).toContain('stores 1');
    expect(texts[2]).toContain('needs every number');
    expect(texts[2]).not.toContain('threw it away');
  });

  it('reports an exhausted source in plain words', () => {
    const stages = [source];

    const texts = textsFor(stages, [event(0, 0, 'exhausted')]);

    expect(texts[0]).toBe('The list has no numbers left.');
  });

  it('marks which gap each step crosses, and in which direction', () => {
    const stages = [source, { index: 1, label: 'Select(n => n * 2)', kind: 'streaming' as const }];

    const steps = narrate(
      stages,
      [event(0, 1, 'pulled'), event(1, 0, 'yielded', '3')],
      'ToList()'
    );

    expect(steps[0]).toMatchObject({ slot: 1, direction: 'backward' });
    expect(steps[1]).toMatchObject({ slot: 0, direction: 'forward', value: '3' });
  });

  it('survives an event naming a stage the UI does not know about', () => {
    // These sentences feed a computed the template reads, so throwing here would blank
    // the page — and there is no fallback engine to take over.
    const stages = [source];

    expect(() => narrate(stages, [event(0, 4, 'pulled')], 'ToList()')).not.toThrow();
    expect(narrate(stages, [event(0, 4, 'yielded', '9')], 'ToList()')[0].text).toContain('9');
  });

  it('exposes the discarded number so the animation can show it dropping out', () => {
    const stages = [source, { index: 1, label: 'Where(n => n > 2)', kind: 'streaming' as const }];

    const steps = narrate(
      stages,
      [event(0, 0, 'pulled'), event(1, 0, 'yielded', '1'), event(2, 0, 'pulled')],
      'ToList()'
    );

    expect(steps[2].discarded).toBe('1');
    expect(steps[1].discarded).toBeUndefined();
  });
});

describe('shortName', () => {
  it('drops the lambda so operators read as words in a sentence', () => {
    expect(shortName('Where(n => n > 3)')).toBe('Where');
    expect(shortName('ToList()')).toBe('ToList');
    expect(shortName('OrderByDescending(n => n)')).toBe('OrderByDescending');
  });

  it('leaves a name with no parentheses alone', () => {
    expect(shortName('the list')).toBe('the list');
  });
});
