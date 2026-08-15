import { LinqEventKind, LinqStage, LinqTraceEvent } from '../services/linq-visualizer.service';

/**
 * What happened at one step, in words a beginner can follow.
 *
 * The trace the runtime produces is precise but wordless - `pulled@2` is evidence, not
 * an explanation. This turns each event into the sentence someone reading over your
 * shoulder would say, which is the part that actually teaches.
 */
export interface NarratedStep {
  event: LinqTraceEvent;
  text: string;
  /**
   * The gap the action crosses: `slot` sits between box `slot` and box `slot + 1`,
   * where box 0 is the list and the last box is the terminal operator.
   */
  slot: number;
  direction: 'backward' | 'forward';
  kind: LinqEventKind;
  value?: string;
  /** A number that was just dropped, so the animation can show it falling out. */
  discarded?: string;
}

/** `Where(n => n > 3)` reads better in a sentence as just `Where`. */
export function shortName(label: string): string {
  const parenthesis = label.indexOf('(');
  const name = parenthesis === -1 ? label : label.slice(0, parenthesis);
  return name.trim() || label;
}

/**
 * Builds one sentence per event.
 *
 * The interesting case is a `pulled` that directly follows a `yielded` at the same
 * stage: the operator downstream was handed a number and immediately asked for
 * another. What that means depends on the operator - `Where` rejected it, but
 * `OrderByDescending` is collecting - and saying "threw it away" for a sort would
 * teach the wrong thing entirely.
 */
export function narrate(
  stages: LinqStage[],
  events: LinqTraceEvent[],
  terminalLabel: string
): NarratedStep[] {
  const lastStage = stages.length - 1;
  const terminal = shortName(terminalLabel);

  // Defensive on purpose. These names feed a computed that the template reads, so a
  // stage index the runtime and the UI disagree about would throw during rendering and
  // take the whole page down - and this tool has no fallback to take over.
  const producerName = (stage: number): string => {
    if (stage === 0) {
      return 'the list';
    }
    const producer = stages[stage];
    return producer ? shortName(producer.label) : 'this step';
  };

  const consumerName = (stage: number): string => {
    const consumer = stage < lastStage ? stages[stage + 1] : undefined;
    return consumer ? shortName(consumer.label) : terminal;
  };

  return events.map((event, index) => {
    const previous = index > 0 ? events[index - 1] : undefined;
    const consumer = consumerName(event.stage);
    const producer = producerName(event.stage);

    if (event.kind === 'pulled') {
      const handedBack =
        previous?.kind === 'yielded' && previous.stage === event.stage ? previous.value : undefined;

      if (handedBack !== undefined) {
        const collects =
          event.stage < lastStage && stages[event.stage + 1].kind === 'buffering';

        return {
          event,
          slot: event.stage,
          direction: 'backward' as const,
          kind: event.kind,
          discarded: collects ? undefined : handedBack,
          text: collects
            ? `${consumer} stores ${handedBack} and asks for the next one — it needs every number before it can hand any back.`
            : `${consumer} looked at ${handedBack} and threw it away, so it asks ${producer} for another.`,
        };
      }

      return {
        event,
        slot: event.stage,
        direction: 'backward' as const,
        kind: event.kind,
        text: `${consumer} needs a number, so it asks ${producer}.`,
      };
    }

    if (event.kind === 'yielded') {
      return {
        event,
        slot: event.stage,
        direction: 'forward' as const,
        kind: event.kind,
        value: event.value,
        text:
          event.stage === 0
            ? `The list hands over ${event.value}.`
            : `${producer} passes ${event.value} on to ${consumer}.`,
      };
    }

    return {
      event,
      slot: event.stage,
      direction: 'forward' as const,
      kind: event.kind,
      text:
        event.stage === 0
          ? 'The list has no numbers left.'
          : `${producer} has nothing left, so it tells ${consumer} it is done.`,
    };
  });
}
