import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RecentToolsService } from './recent-tools.service';

@Component({ selector: 'app-stub', template: '' })
class StubComponent {}

const STORAGE_KEY = 'toolbox.recent-tools';

/** Real registry paths - the service deliberately ignores anything it can't resolve. */
const CSHARP_JSON = 'csharp-json';
const JWT = 'jwt-decoder';
const REGEX = 'regex-tester';
const LINQ = 'linq-visualizer';
const SPAN = 'span-visualizer';
const LIST = 'list-visualizer';

function setup(): { service: RecentToolsService; router: Router } {
  TestBed.configureTestingModule({
    providers: [provideRouter([{ path: '**', component: StubComponent }])],
  });
  // Injected before navigating so the service is subscribed in time.
  const service = TestBed.inject(RecentToolsService);
  return { service, router: TestBed.inject(Router) };
}

describe('RecentToolsService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('lists visited tools newest first', async () => {
    const { service, router } = setup();

    await router.navigateByUrl('/' + CSHARP_JSON);
    await router.navigateByUrl('/' + JWT);
    await router.navigateByUrl('/home');

    expect(service.recent().map(tool => tool.path)).toEqual([JWT, CSHARP_JSON]);
  });

  it('excludes the tool that is currently open', async () => {
    const { service, router } = setup();

    await router.navigateByUrl('/' + CSHARP_JSON);
    await router.navigateByUrl('/' + JWT);
    await router.navigateByUrl('/' + REGEX);

    expect(service.recent().map(tool => tool.path)).toEqual([JWT, CSHARP_JSON]);
  });

  it('moves a revisited tool back to the front instead of duplicating it', async () => {
    const { service, router } = setup();

    await router.navigateByUrl('/' + CSHARP_JSON);
    await router.navigateByUrl('/' + JWT);
    await router.navigateByUrl('/' + CSHARP_JSON);
    await router.navigateByUrl('/home');

    expect(service.recent().map(tool => tool.path)).toEqual([CSHARP_JSON, JWT]);
  });

  it('shows at most three, and never more than five survive a reload', async () => {
    const { service, router } = setup();

    for (const path of [LIST, SPAN, LINQ, REGEX, JWT, CSHARP_JSON]) {
      await router.navigateByUrl('/' + path);
    }
    await router.navigateByUrl('/home');

    expect(service.recent()).toHaveLength(3);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toHaveLength(5);
  });

  it('ignores routes that are not tools', async () => {
    const { service, router } = setup();

    await router.navigateByUrl('/home');
    await router.navigateByUrl('/not-a-real-tool');

    expect(service.recent()).toEqual([]);
  });

  it('keeps query strings out of the recorded path', async () => {
    const { service, router } = setup();

    await router.navigateByUrl('/' + REGEX + '?pattern=abc');
    await router.navigateByUrl('/home');

    expect(service.recent().map(tool => tool.path)).toEqual([REGEX]);
  });

  it('restores the list from localStorage on a later visit', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([JWT, CSHARP_JSON]));
    const { service, router } = setup();

    await router.navigateByUrl('/home');

    expect(service.recent().map(tool => tool.path)).toEqual([JWT, CSHARP_JSON]);
  });

  it('drops stored paths that no longer exist in the registry', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['tool-that-was-deleted', JWT]));
    const { service, router } = setup();

    await router.navigateByUrl('/home');

    expect(service.recent().map(tool => tool.path)).toEqual([JWT]);
  });

  it('starts empty when the stored value is not valid JSON', async () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    const { service, router } = setup();

    await router.navigateByUrl('/home');

    expect(service.recent()).toEqual([]);
  });

  it('still records in-session when localStorage is unavailable', async () => {
    // Safari private mode throws on both reads and writes.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });

    const { service, router } = setup();
    await router.navigateByUrl('/' + JWT);
    await router.navigateByUrl('/home');

    expect(service.recent().map(tool => tool.path)).toEqual([JWT]);
    vi.restoreAllMocks();
  });
});
