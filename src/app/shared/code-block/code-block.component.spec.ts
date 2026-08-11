import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { CodeBlockComponent } from './code-block.component';

describe('CodeBlockComponent', () => {
  let fixture: ComponentFixture<CodeBlockComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CodeBlockComponent] }).compileComponents();
    fixture = TestBed.createComponent(CodeBlockComponent);
  });

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const codeEl = (): HTMLElement | null => el().querySelector('code');

  /**
   * The global Prism rules in styles.css are keyed on code[class*='language-'].
   * Drop that class and every token falls back to the inherited body colour,
   * which is near-black on these dark panels - the bug this guards against.
   */
  it('tags the code element with the language class the global CSS hooks onto', async () => {
    fixture.componentRef.setInput('code', 'var x = 1;');
    await fixture.whenStable();

    expect(codeEl()?.getAttribute('class')).toContain('language-csharp');
  });

  it('switches the language class when the language changes', async () => {
    fixture.componentRef.setInput('code', 'const x = 1;');
    fixture.componentRef.setInput('language', 'typescript');
    await fixture.whenStable();

    expect(codeEl()?.getAttribute('class')).toContain('language-typescript');
  });

  it('renders Prism token markup for the supplied code', async () => {
    fixture.componentRef.setInput('code', 'public class Foo { }');
    await fixture.whenStable();

    expect(el().innerHTML).toContain('class="token');
    expect(el().textContent).toContain('public class Foo');
  });

  /**
   * Guards the contract that broke once: an earlier template bound [innerHTML]
   * to a wrapper <span> inside the @if, and every tool then showed its first
   * result forever while the underlying signal stayed correct.
   *
   * Be aware this test did NOT reproduce that bug - it passed against the
   * broken template, which only misrendered in the browser. Treat a green run
   * here as necessary, not sufficient, and check a tool in the browser when
   * changing this template.
   */
  it('re-renders when the code input changes', async () => {
    fixture.componentRef.setInput('code', 'public class Alpha { }');
    await fixture.whenStable();
    expect(el().textContent).toContain('Alpha');

    fixture.componentRef.setInput('code', 'public class Bravo { }');
    await fixture.whenStable();

    expect(el().textContent).toContain('Bravo');
    expect(el().textContent).not.toContain('Alpha');
  });

  it('swaps between code and placeholder as the code comes and goes', async () => {
    fixture.componentRef.setInput('placeholder', 'nothing yet');
    fixture.componentRef.setInput('code', 'public class Alpha { }');
    await fixture.whenStable();
    expect(el().textContent).toContain('Alpha');

    fixture.componentRef.setInput('code', '');
    await fixture.whenStable();
    expect(el().textContent).toContain('nothing yet');

    fixture.componentRef.setInput('code', 'public class Charlie { }');
    await fixture.whenStable();
    expect(el().textContent).toContain('Charlie');
    expect(el().textContent).not.toContain('nothing yet');
  });

  it('does not indent rendered code, since <pre> preserves template whitespace', async () => {
    fixture.componentRef.setInput('code', 'public class Alpha { }');
    await fixture.whenStable();

    expect(el().querySelector('pre')?.textContent).toBe('public class Alpha { }');
  });

  it('shows the placeholder when there is no code', async () => {
    fixture.componentRef.setInput('code', '');
    fixture.componentRef.setInput('placeholder', 'C# will appear here...');
    await fixture.whenStable();

    expect(el().textContent).toContain('C# will appear here...');
    expect(el().innerHTML).not.toContain('class="token');
  });

  it('renders the placeholder in red when the tool reports an error', async () => {
    fixture.componentRef.setInput('code', '');
    fixture.componentRef.setInput('placeholder', 'Invalid JSON');
    fixture.componentRef.setInput('error', true);
    await fixture.whenStable();

    expect(el().querySelector('.text-red-400')?.textContent).toContain('Invalid JSON');
  });

  it('keeps the panel keyboard-reachable so it can be read and copied', async () => {
    fixture.componentRef.setInput('code', 'var x = 1;');
    await fixture.whenStable();

    expect(el().querySelector('pre')?.getAttribute('tabindex')).toBe('0');
  });

  it('applies caller-supplied sizing alongside its own base classes', async () => {
    fixture.componentRef.setInput('code', 'var x = 1;');
    fixture.componentRef.setInput('heightClass', 'h-64');
    await fixture.whenStable();

    const cls = el().querySelector('pre')?.getAttribute('class') ?? '';
    expect(cls).toContain('h-64');
    expect(cls).toContain('bg-gray-900');
  });

  /*
   * Generated code is full of identifiers longer than a narrow panel, so the
   * panel wraps instead of scrolling sideways - the behaviour the readonly
   * textareas this component replaced had for free.
   */
  it('wraps long lines instead of scrolling horizontally', async () => {
    fixture.componentRef.setInput('code', 'var x = 1;');
    await fixture.whenStable();

    const cls = el().querySelector('pre')?.getAttribute('class') ?? '';
    expect(cls).toContain('whitespace-pre-wrap');
    expect(cls).toContain('break-words');
  });
});
