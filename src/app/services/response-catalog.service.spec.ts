import { describe, it, expect, beforeEach } from 'vitest';
import { ResponseCatalogService } from './response-catalog.service';
import { RESPONSE_CATALOG } from '../response-guide/response-catalog.const';
import { ResponseEntry } from '../response-guide/models/response-entry.models';

describe('ResponseCatalogService', () => {
  let service: ResponseCatalogService;

  beforeEach(() => {
    service = new ResponseCatalogService();
  });

  const allCodes = (entries: ResponseEntry[]): string[] => entries.flatMap(e => e.statusCodes);

  describe('searching', () => {
    it('finds an entry by its status code', () => {
      const result = service.filter(RESPONSE_CATALOG, {
        query: '504',
        showVendorSpecific: false,
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('gateway-timeout');
    });

    it('finds the same entry by prose, not just by number', () => {
      const result = service.filter(RESPONSE_CATALOG, {
        query: 'timeout',
        showVendorSpecific: false,
      });

      expect(result.map(e => e.id)).toContain('gateway-timeout');
      expect(result.length).toBeGreaterThan(1);
    });

    it('is case-insensitive', () => {
      const lower = service.filter(RESPONSE_CATALOG, {
        query: 'rate limit',
        showVendorSpecific: false,
      });
      const upper = service.filter(RESPONSE_CATALOG, {
        query: 'RATE LIMIT',
        showVendorSpecific: false,
      });

      expect(upper.map(e => e.id)).toEqual(lower.map(e => e.id));
      expect(lower.map(e => e.id)).toContain('rate-limited');
    });

    it('matches on tags that do not appear in the title', () => {
      const result = service.filter(RESPONSE_CATALOG, {
        query: 'retry-after',
        showVendorSpecific: false,
      });

      expect(result.map(e => e.id)).toContain('rate-limited');
      expect(result.map(e => e.id)).toContain('service-unavailable');
    });

    it('ignores surrounding whitespace', () => {
      const result = service.filter(RESPONSE_CATALOG, {
        query: '   429   ',
        showVendorSpecific: false,
      });

      expect(result.map(e => e.id)).toEqual(['rate-limited']);
    });

    it('returns everything standard for an empty query', () => {
      const result = service.filter(RESPONSE_CATALOG, {
        query: '',
        showVendorSpecific: false,
      });

      expect(result).toEqual(RESPONSE_CATALOG.filter(e => e.standard === 'standard'));
    });

    it('returns nothing for an unknown query, which drives the empty state', () => {
      const result = service.filter(RESPONSE_CATALOG, {
        query: 'definitely-not-a-status-code',
        showVendorSpecific: true,
      });

      expect(result).toEqual([]);
    });
  });

  describe('vendor-specific filter', () => {
    it('hides nginx, Cloudflare, and AWS codes by default', () => {
      const result = service.filter(RESPONSE_CATALOG, {
        query: '',
        showVendorSpecific: false,
      });

      expect(result.every(e => e.standard === 'standard')).toBe(true);
      expect(allCodes(result)).not.toContain('499');
      expect(allCodes(result)).not.toContain('524');
      expect(allCodes(result)).not.toContain('599');
    });

    it('reveals them when enabled', () => {
      const result = service.filter(RESPONSE_CATALOG, {
        query: '',
        showVendorSpecific: true,
      });

      expect(allCodes(result)).toContain('499');
      expect(allCodes(result)).toContain('524');
      expect(allCodes(result)).toContain('599');
      expect(result).toEqual([...RESPONSE_CATALOG]);
    });

    it('applies the vendor filter before the query, so a hidden code stays hidden', () => {
      const hidden = service.filter(RESPONSE_CATALOG, {
        query: '524',
        showVendorSpecific: false,
      });
      const shown = service.filter(RESPONSE_CATALOG, {
        query: '524',
        showVendorSpecific: true,
      });

      expect(hidden).toEqual([]);
      expect(shown.map(e => e.id)).toEqual(['cf-timeout-occurred']);
    });
  });
});

describe('RESPONSE_CATALOG integrity', () => {
  it('has unique ids', () => {
    const ids = RESPONSE_CATALOG.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every entry at least one status code and one tag', () => {
    for (const entry of RESPONSE_CATALOG) {
      expect(entry.statusCodes.length, entry.id).toBeGreaterThan(0);
      expect(entry.tags.length, entry.id).toBeGreaterThan(0);
      expect(entry.summary.length, entry.id).toBeGreaterThan(0);
    }
  });

  it('gives every scenario both a controller and a minimal API snippet', () => {
    for (const entry of RESPONSE_CATALOG) {
      if (entry.kind !== 'scenario') {
        continue;
      }
      expect(entry.snippets.controller.trim().length, entry.id).toBeGreaterThan(0);
      expect(entry.snippets.minimalApi.trim().length, entry.id).toBeGreaterThan(0);
    }
  });

  it('gives every reference entry meaning, cause, and what-to-do', () => {
    for (const entry of RESPONSE_CATALOG) {
      if (entry.kind !== 'reference') {
        continue;
      }
      expect(entry.meaning.trim().length, entry.id).toBeGreaterThan(0);
      expect(entry.cause.trim().length, entry.id).toBeGreaterThan(0);
      expect(entry.whatToDo.trim().length, entry.id).toBeGreaterThan(0);
    }
  });

  it('covers the rate-limiting and downstream-failure codes the guide promises', () => {
    const codes = new Set(RESPONSE_CATALOG.flatMap(e => e.statusCodes));

    for (const code of ['429', '408', '502', '503', '504', '507']) {
      expect(codes.has(code), `missing ${code}`).toBe(true);
    }
    for (const code of ['499', '520', '521', '522', '523', '524', '525', '526', '599']) {
      expect(codes.has(code), `missing ${code}`).toBe(true);
    }
  });

  it('marks every non-IANA code as vendor-specific so the filter can hide it', () => {
    const vendorCodes = ['499', '520', '522', '524', '599', '420'];

    for (const code of vendorCodes) {
      const entry = RESPONSE_CATALOG.find(e => e.statusCodes.includes(code));
      expect(entry?.standard, `${code} should not be marked standard`).not.toBe('standard');
    }
  });
});
