import { describe, it, expect } from 'vitest';
import { narrate, type TimelineSegment } from './thread-timeline';

describe('narrate', () => {
  const segment = (overrides: Partial<TimelineSegment>): TimelineSegment => ({
    task: 'A',
    kind: 'run',
    startMs: 0,
    endMs: 8,
    threadId: 1,
    label: 'starts',
    ...overrides,
  });

  it('tells an await apart from a block by whether the thread is kept', () => {
    expect(narrate(segment({ kind: 'wait', threadId: null, label: 'await Task.Delay(40)' }))).toContain('holds no thread');
    expect(narrate(segment({ kind: 'block', label: 'Thread.Sleep(40)' }))).toContain('Thread #1 is stuck');
  });

  it('distinguishes starting, resuming and finishing', () => {
    expect(narrate(segment({}))).toContain('starts Task A');
    expect(narrate(segment({ label: 'resumes' }))).toContain('picks it up where it left off.');
    expect(narrate(segment({ label: 'resumes, finishes' }))).toContain('runs it to the end');
    expect(narrate(segment({ label: 'resumes' }), true)).toContain('never let go of Thread #1');
  });
});
