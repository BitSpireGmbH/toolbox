import { Injectable } from '@angular/core';
import { ResponseEntry } from '../response-guide/models/response-entry.models';

export interface ResponseFilter {
  /** Already-debounced search text. */
  query: string;
  /** When false, only IANA-registered codes are shown. */
  showVendorSpecific: boolean;
}

/**
 * Pure filtering for the Response Guide. Kept out of the component so the
 * search behaviour - the part with actual edge cases - is unit-testable
 * without a TestBed.
 */
@Injectable({ providedIn: 'root' })
export class ResponseCatalogService {
  filter(entries: readonly ResponseEntry[], filter: ResponseFilter): ResponseEntry[] {
    const query = filter.query.trim().toLowerCase();

    return entries.filter(entry => {
      if (!filter.showVendorSpecific && entry.standard !== 'standard') {
        return false;
      }

      return query.length === 0 || this.matches(entry, query);
    });
  }

  /**
   * Matches title, tags, and the status codes joined as text, so both "504"
   * and "timeout" find the gateway-timeout entry. The summary is included too
   * because it carries the wording people actually search for ("overloaded").
   */
  private matches(entry: ResponseEntry, lowercaseQuery: string): boolean {
    const haystack = [
      entry.title,
      entry.summary,
      entry.tags.join(' '),
      entry.statusCodes.join(' '),
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(lowercaseQuery);
  }
}
