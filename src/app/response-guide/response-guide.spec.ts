import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ResponseGuideComponent } from './response-guide';

/**
 * Real timers throughout: Angular's whenStable() never settles while vitest's
 * fake timers are installed, so the ~150ms debounce is waited out for real.
 */
const QUERY_DEBOUNCE_MS = 150;
const afterDebounce = (): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, QUERY_DEBOUNCE_MS + 50));

describe('ResponseGuideComponent', () => {
  let fixture: ComponentFixture<ResponseGuideComponent>;

  const create = async (): Promise<ComponentFixture<ResponseGuideComponent>> => {
    await TestBed.configureTestingModule({
      imports: [ResponseGuideComponent],
      providers: [provideRouter([{ path: '**', component: ResponseGuideComponent }])],
    }).compileComponents();

    const created = TestBed.createComponent(ResponseGuideComponent);
    await created.whenStable();
    return created;
  };

  const text = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const code = (): string =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('pre'))
      .map(p => p.textContent ?? '')
      .join('\n');

  beforeEach(async () => {
    localStorage.clear();
    fixture = await create();
  });

  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('renders cards from the catalog', () => {
    expect(text()).toContain('Get a resource by id');
    expect(text()).toContain('Rate limited');
  });

  it('hides vendor-specific entries until the chip is enabled', async () => {
    expect(text()).not.toContain('Connection Timed Out');

    fixture.componentInstance['showVendorSpecific'].set(true);
    await fixture.whenStable();

    expect(text()).toContain('Connection Timed Out');
  });

  it('defaults to the Minimal API style the guide recommends', async () => {
    expect(fixture.componentInstance['mode']()).toBe('minimal');
    expect(code()).toContain('app.MapGet(');
    expect(code()).not.toContain('[HttpGet("{id:int}")]');

    fixture.componentInstance['mode'].set('controller');
    await fixture.whenStable();

    expect(code()).toContain('[HttpGet("{id:int}")]');
    expect(code()).not.toContain('app.MapGet(');
  });

  it('does not re-filter when the mode changes, so the card list stays stable', async () => {
    const before = fixture.componentInstance['filtered']().map(e => e.id);

    fixture.componentInstance['mode'].set('minimal');
    await fixture.whenStable();

    expect(fixture.componentInstance['filtered']().map(e => e.id)).toEqual(before);
  });

  it('debounces the query before filtering', async () => {
    const component = fixture.componentInstance;
    const initialCount = component['filtered']().length;

    component['query'].set('429');
    await fixture.whenStable();

    // The debounce window has not elapsed, so the list is untouched.
    expect(component['filtered']().length).toBe(initialCount);

    await afterDebounce();
    await fixture.whenStable();

    expect(component['filtered']().map(e => e.id)).toEqual(['rate-limited']);
  });

  it('shows the empty state when nothing matches', async () => {
    fixture.componentInstance['query'].set('nothing-matches-this');
    await afterDebounce();
    await fixture.whenStable();

    expect(text()).toContain('No scenarios match your search');
  });

  it('mirrors state into the URL so links are shareable', async () => {
    const router = TestBed.inject(Router);

    fixture.componentInstance['mode'].set('minimal');
    fixture.componentInstance['query'].set('timeout');
    await afterDebounce();
    await fixture.whenStable();

    expect(router.url).toContain('mode=minimal');
    expect(router.url).toContain('q=timeout');
  });

  // Deliberately switches away from the default, so a regression that dropped
  // persistence entirely could not pass by accident.
  it('remembers the mode across visits via localStorage', async () => {
    fixture.componentInstance['mode'].set('controller');
    await fixture.whenStable();

    expect(localStorage.getItem('response-guide.mode')).toBe('controller');

    TestBed.resetTestingModule();
    const second = await create();
    expect(second.componentInstance['mode']()).toBe('controller');
  });
});
