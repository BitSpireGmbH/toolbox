import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { TOOLS } from '../shared/tools.registry';
import { SeoService } from './seo.service';

describe('SeoService', () => {
  let document: Document;
  let originalHead: string;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SeoService,
        {
          provide: Router,
          useValue: {
            events: new Subject(),
            routerState: { snapshot: { root: { data: {}, firstChild: null } } },
          },
        },
      ],
    });

    document = TestBed.inject(DOCUMENT);
    originalHead = document.head.innerHTML;
    document.head.innerHTML = '<link rel="canonical" href="https://toolbox.bitspire.ch/">';
  });

  afterEach(() => {
    document.head.innerHTML = originalHead;
    TestBed.resetTestingModule();
  });

  it('sets unique search and social metadata for a tool route', () => {
    const service = TestBed.inject(SeoService);
    const tool = TOOLS.find(candidate => candidate.path === 'csharp-json');

    if (!tool) {
      throw new Error('Expected the JSON to C# tool to be registered.');
    }

    service.updateMetadata(tool.seo, '/csharp-json');

    expect(document.title).toBe('JSON to C# Converter | .NET Developer Toolbox');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toContain('Convert JSON to C#');
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe(tool.seo.title);
    expect(document.querySelector('meta[name="twitter:title"]')?.getAttribute('content')).toBe(tool.seo.title);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://toolbox.bitspire.ch/csharp-json',
    );
  });
});
