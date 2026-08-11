/**
 * Which of the two ASP.NET Core styles a snippet is written in. Persisted to
 * localStorage as the user's default and mirrored to the URL.
 */
export type ResponseMode = 'controller' | 'minimal';

/**
 * Which stacks a status code is actually real on.
 *
 * Only 'standard' codes are in the IANA registry and safe to rely on anywhere.
 * The rest exist solely because a particular proxy, CDN, or vendor emits them,
 * so they are hidden behind the "vendor-specific" filter chip by default.
 */
export type ResponseStandard = 'standard' | 'nginx' | 'cloudflare' | 'aws' | 'webdav' | 'legacy';

export interface ResponseSnippets {
  /** Classic MVC controller action. */
  controller: string;
  /** Minimal API endpoint using TypedResults. */
  minimalApi: string;
  /**
   * Why the untyped `Results.*` form is worse for this scenario. Rendered only
   * when the user turns on "show discouraged Results.* equivalent".
   */
  avoidNote?: string;
}

interface ResponseEntryBase {
  id: string;
  title: string;
  /**
   * Strings rather than numbers: an entry can map to several codes, and the
   * catalog is searched by substring so `'429'` must compare as text anyway.
   */
  statusCodes: string[];
  /** Free-form search terms - the prose a user is likely to type. */
  tags: string[];
  standard: ResponseStandard;
  /** One line shown under the title on the card. */
  summary: string;
}

/**
 * A code your ASP.NET Core app can legitimately return, so it carries a
 * controller/minimal-API snippet pair.
 */
export interface ScenarioEntry extends ResponseEntryBase {
  kind: 'scenario';
  snippets: ResponseSnippets;
}

/**
 * A code you only ever *observe* in logs - emitted by nginx, Cloudflare, or a
 * load balancer, never by your own code. Documenting it with a fabricated
 * `TypedResults.StatusCode(524)` snippet would teach the wrong thing, so these
 * entries explain the code instead of demonstrating it.
 */
export interface ReferenceEntry extends ResponseEntryBase {
  kind: 'reference';
  meaning: string;
  cause: string;
  whatToDo: string;
  /** Optional link to the vendor's own documentation for this code. */
  docsUrl?: string;
}

export type ResponseEntry = ScenarioEntry | ReferenceEntry;

/** Human labels for the `standard` field, used on the card badge. */
export const STANDARD_LABELS: Record<ResponseStandard, string> = {
  standard: 'Standard',
  nginx: 'nginx',
  cloudflare: 'Cloudflare',
  aws: 'AWS / proxies',
  webdav: 'WebDAV',
  legacy: 'Non-standard',
};
