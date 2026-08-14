import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegexTesterComponent } from './regex-tester';

describe('RegexTesterComponent', () => {
  let fixture: ComponentFixture<RegexTesterComponent>;

  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => host().textContent ?? '';

  const buttons = (selector = 'button'): HTMLButtonElement[] =>
    Array.from(host().querySelectorAll<HTMLButtonElement>(selector));

  const buttonWith = (label: string, selector = 'button'): HTMLButtonElement => {
    const found = buttons(selector).find(button => button.textContent?.includes(label));
    if (!found) throw new Error(`No button containing "${label}"`);
    return found;
  };

  const patternField = (): HTMLInputElement =>
    host().querySelector<HTMLInputElement>('input.pattern-input') as HTMLInputElement;

  const setValue = (element: HTMLInputElement | HTMLTextAreaElement, value: string): void => {
    element.value = value;
    element.dispatchEvent(new Event('input'));
  };

  const click = async (button: HTMLButtonElement): Promise<void> => {
    button.click();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RegexTesterComponent] }).compileComponents();

    fixture = TestBed.createComponent(RegexTesterComponent);
    await fixture.whenStable();
  });

  it('explains the default pattern as a chain of parts', () => {
    const chain = host().querySelector('app-pattern-chain');

    expect(chain?.textContent).toContain('CAPTURE - NAMED "YEAR"');
    expect(chain?.textContent).toContain('4 × digits 0-9');
    expect(chain?.textContent).toContain('the text "-"');
  });

  it('shows the generated C# and the match details without any interaction', () => {
    expect(host().querySelector('app-code-block')?.textContent).toContain('[GeneratedRegex(');
    expect(host().querySelector('app-match-details-panel')?.textContent).toContain('2024-03-15');
  });

  it('marks a valid pattern as valid and an invalid one as invalid', async () => {
    expect(text()).toContain('valid');

    setValue(patternField(), '(');
    await fixture.whenStable();

    expect(text()).toContain('invalid');
    expect(text()).toContain('Pattern error:');
  });

  it('keeps rendering a chain while the pattern is half-typed', async () => {
    setValue(patternField(), '(?<year>\\d{');
    await fixture.whenStable();

    expect(host().querySelector('app-pattern-chain')).not.toBeNull();
  });

  it('loads an example together with its own sample text', async () => {
    await click(buttonWith('Examples'));
    await click(buttonWith('Email address'));

    expect(patternField().value).toContain('@');
    expect(host().querySelector('textarea')?.value).toContain('ada.lovelace@example.com');
  });

  it('appends a palette part to the pattern', async () => {
    const before = patternField().value;

    await click(buttonWith('Add part'));
    const spaceItem = buttons('app-pattern-chain button').find(
      button => button.querySelector('span')?.textContent === '\\s'
    );
    await click(spaceItem as HTMLButtonElement);

    expect(patternField().value).toBe(`${before}\\s`);
  });

  it('rewrites the pattern when a part is selected and re-quantified', async () => {
    const yearChip = buttons('app-pattern-chain button').find(
      button => button.querySelector('span')?.textContent === '\\d{4}'
    );
    await click(yearChip as HTMLButtonElement);

    await click(buttonWith('+', 'app-pattern-chain button'));

    expect(patternField().value).toContain('(?<year>\\d+)');
  });

  it('folds all but the first two tips behind a "+N more" line', async () => {
    setValue(patternField(), '(a).');
    setValue(host().querySelector('textarea') as HTMLTextAreaElement, 'zzz');
    await fixture.whenStable();

    const more = buttonWith('more');
    expect(more.textContent).toContain('+');

    await click(more);
    expect(text()).toContain('Show fewer');
  });

  it('counts the RegexOptions that are set on the toggle', async () => {
    await click(buttonWith('RegexOptions'));

    const ignoreCase = host().querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (!ignoreCase) throw new Error('No option checkboxes rendered');
    ignoreCase.checked = true;
    ignoreCase.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(buttonWith('RegexOptions').textContent).toContain('1');
    expect(host().querySelector('app-code-block')?.textContent).toContain('RegexOptions.IgnoreCase');
  });

  it('moves the .NET-only engine warning into the tips list', async () => {
    await click(buttonWith('RegexOptions'));

    // RegexOptions render in REGEX_OPTION_META order; RightToLeft is the last.
    const checkboxes = host().querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    const rightToLeft = checkboxes[checkboxes.length - 1];
    expect(checkboxes).toHaveLength(7);

    rightToLeft.checked = true;
    rightToLeft.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    const tips = host().querySelector('app-pattern-chain')?.parentElement?.parentElement;
    expect(tips?.textContent).toContain('no equivalent for: RightToLeft');
    expect(host().querySelector('app-code-block')?.textContent).toContain(
      'RegexOptions.RightToLeft'
    );
  });

  it('adds and removes the optional replacement field', async () => {
    await click(buttonWith('Add replacement'));

    const replacementField = host().querySelector<HTMLInputElement>(
      'input[aria-label="Replacement pattern"]'
    );
    expect(replacementField).not.toBeNull();

    setValue(replacementField as HTMLInputElement, '$<year>/$<month>');
    await fixture.whenStable();
    expect(text()).toContain('Replaced preview');

    await click(buttonWith('Remove', 'button'));
    expect(host().querySelector('input[aria-label="Replacement pattern"]')).toBeNull();
  });

  it('highlights every match behind the test text', () => {
    const layer = host().querySelector('app-test-text-panel .layer');

    expect(layer?.querySelectorAll('span').length).toBeGreaterThan(0);
    expect(layer?.textContent).toContain('2024-03-15');
  });
});
