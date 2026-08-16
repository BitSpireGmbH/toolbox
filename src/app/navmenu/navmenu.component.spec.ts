import { describe, it, expect, beforeEach } from 'vitest';
import { Component } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NavmenuComponent } from './navmenu.component';
import { TOOLS } from '../shared/tools.registry';

@Component({ selector: 'app-stub', template: '' })
class StubComponent {}

const COLLAPSED_KEY = 'toolbox.sidebar.collapsed';

/** The desktop sidebar; the mobile drawer only renders once sidebarOpen is true. */
function desktop(fixture: ComponentFixture<NavmenuComponent>): HTMLElement {
  return fixture.nativeElement.querySelector('div.hidden.md\\:flex') as HTMLElement;
}

function sectionToggle(fixture: ComponentFixture<NavmenuComponent>, name: string): HTMLButtonElement {
  const buttons = Array.from(
    desktop(fixture).querySelectorAll<HTMLButtonElement>('button[aria-controls^="desktop-section-"]')
  );
  const match = buttons.find(button => button.textContent?.trim() === name);
  if (!match) {
    throw new Error(`No section toggle for "${name}" (found: ${buttons.map(b => b.textContent?.trim()).join(', ')})`);
  }
  return match;
}

function toolLinks(fixture: ComponentFixture<NavmenuComponent>): string[] {
  return Array.from(desktop(fixture).querySelectorAll<HTMLAnchorElement>('a[href]'))
    .map(anchor => anchor.getAttribute('href')?.replace(/^\//, '') ?? '')
    .filter(path => TOOLS.some(tool => tool.path === path));
}

async function render(sidebarOpen = true): Promise<ComponentFixture<NavmenuComponent>> {
  const fixture = TestBed.createComponent(NavmenuComponent);
  fixture.componentRef.setInput('sidebarOpen', sidebarOpen);
  await fixture.whenStable();
  return fixture;
}

describe('NavmenuComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [NavmenuComponent],
      providers: [provideRouter([{ path: '**', component: StubComponent }])],
    }).compileComponents();
  });

  it('renders both sections', async () => {
    const fixture = await render();

    expect(sectionToggle(fixture, 'Tools')).toBeTruthy();
    expect(sectionToggle(fixture, 'Learn')).toBeTruthy();
  });

  it('shows every registered tool exactly once', async () => {
    const fixture = await render();

    const links = toolLinks(fixture);
    expect(links).toHaveLength(TOOLS.length);
    expect(new Set(links).size).toBe(TOOLS.length);
  });

  it('renders category sub-headers under Tools but not under single-category Learn', async () => {
    const fixture = await render();

    const headers = Array.from(desktop(fixture).querySelectorAll('span')).map(span => span.textContent?.trim());
    expect(headers).toContain('Converters');
    expect(headers).toContain('ASP.NET Core');
    expect(headers).toContain('Utilities');
    expect(headers).not.toContain('Explainers');
  });

  it('collapsing a section hides its tools and persists the choice', async () => {
    const fixture = await render();
    const learnTools = TOOLS.filter(tool => tool.section === 'Learn').map(tool => tool.path);

    expect(toolLinks(fixture)).toEqual(expect.arrayContaining(learnTools));

    sectionToggle(fixture, 'Learn').click();
    await fixture.whenStable();

    const visible = toolLinks(fixture);
    for (const path of learnTools) {
      expect(visible).not.toContain(path);
    }
    expect(JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]')).toEqual(['Learn']);
  });

  it('reports collapsed state through aria-expanded', async () => {
    const fixture = await render();

    expect(sectionToggle(fixture, 'Learn').getAttribute('aria-expanded')).toBe('true');

    sectionToggle(fixture, 'Learn').click();
    await fixture.whenStable();

    expect(sectionToggle(fixture, 'Learn').getAttribute('aria-expanded')).toBe('false');
  });

  it('starts collapsed when localStorage says so', async () => {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(['Learn']));
    const fixture = await render();

    expect(sectionToggle(fixture, 'Learn').getAttribute('aria-expanded')).toBe('false');
  });

  it('ignores unknown section names in stored state', async () => {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(['Architecture & Analysis']));
    const fixture = await render();

    expect(sectionToggle(fixture, 'Tools').getAttribute('aria-expanded')).toBe('true');
    expect(sectionToggle(fixture, 'Learn').getAttribute('aria-expanded')).toBe('true');
  });

  it('re-expands a collapsed section while filtering, so matches are never hidden', async () => {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(['Learn']));
    const fixture = await render();

    expect(toolLinks(fixture)).not.toContain('linq-visualizer');

    const input = desktop(fixture).querySelector('input') as HTMLInputElement;
    input.value = 'linq';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(toolLinks(fixture)).toContain('linq-visualizer');
  });

  it('filters on the section name too', async () => {
    const fixture = await render();

    const input = desktop(fixture).querySelector('input') as HTMLInputElement;
    input.value = 'learn';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    const visible = toolLinks(fixture);
    const learnTools = TOOLS.filter(tool => tool.section === 'Learn').map(tool => tool.path);
    expect(visible.sort()).toEqual(learnTools.sort());
  });

  it('auto-expands the section holding the active route', async () => {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(['Tools', 'Learn']));
    await TestBed.inject(Router).navigateByUrl('/linq-visualizer');

    const fixture = await render();

    expect(sectionToggle(fixture, 'Learn').getAttribute('aria-expanded')).toBe('true');
    expect(sectionToggle(fixture, 'Tools').getAttribute('aria-expanded')).toBe('false');
    expect(toolLinks(fixture)).toContain('linq-visualizer');
  });

  /**
   * The sidebar is built during bootstrap, before the router resolves the first
   * URL - so auto-expand has to react to navigation, not read router.url once.
   */
  it('auto-expands when navigation resolves after the sidebar is built', async () => {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(['Learn']));
    const fixture = await render();
    expect(sectionToggle(fixture, 'Learn').getAttribute('aria-expanded')).toBe('false');

    await TestBed.inject(Router).navigateByUrl('/span-visualizer');
    await fixture.whenStable();

    expect(sectionToggle(fixture, 'Learn').getAttribute('aria-expanded')).toBe('true');
    expect(toolLinks(fixture)).toContain('span-visualizer');
  });

  it('lets a section stay closed after the user closes it on a tool inside it', async () => {
    const fixture = await render();
    await TestBed.inject(Router).navigateByUrl('/span-visualizer');
    await fixture.whenStable();

    sectionToggle(fixture, 'Learn').click();
    await fixture.whenStable();

    expect(sectionToggle(fixture, 'Learn').getAttribute('aria-expanded')).toBe('false');
  });

  /**
   * The rail is a launcher, not a directory: its height must not grow with the
   * registry, which is the whole reason it stopped listing every tool.
   */
  it('shows only the active tool and recents in the collapsed rail', async () => {
    await TestBed.inject(Router).navigateByUrl('/regex-tester');
    const fixture = await render(false);

    expect(toolLinks(fixture)).toEqual(['regex-tester']);
    expect(toolLinks(fixture).length).toBeLessThan(TOOLS.length);
  });

  it('offers a way out of the rail to the full list', async () => {
    const fixture = await render(false);

    const allTools = desktop(fixture).querySelector('button[aria-label="Show all tools"]');
    expect(allTools).toBeTruthy();
    expect(desktop(fixture).querySelector('button[aria-label="Search tools"]')).toBeTruthy();
  });

  it('renders no section headers in the rail', async () => {
    const fixture = await render(false);

    expect(desktop(fixture).querySelectorAll('button[aria-controls^="desktop-section-"]')).toHaveLength(0);
  });

  it('says so when nothing matches the filter', async () => {
    const fixture = await render();

    const input = desktop(fixture).querySelector('input') as HTMLInputElement;
    input.value = 'zzzznope';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(toolLinks(fixture)).toEqual([]);
    expect(desktop(fixture).textContent).toContain('No tools match');
  });
});
