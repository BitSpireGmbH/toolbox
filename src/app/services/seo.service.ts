import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, Router, RouterStateSnapshot } from '@angular/router';
import { filter } from 'rxjs';
import { HOME_SEO, SeoMetadata, SITE_URL } from '../shared/seo.models';

const SOCIAL_IMAGE_URL = `${SITE_URL}/assets/logo.webp`;

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly document = inject(DOCUMENT);
  private readonly meta = inject(Meta);
  private readonly router = inject(Router);
  private readonly title = inject(Title);

  constructor() {
    this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(event => {
      this.updateForRoute(event.urlAfterRedirects);
    });
  }

  updateMetadata(metadata: SeoMetadata, path: string): void {
    const canonicalUrl = this.getCanonicalUrl(path);

    this.title.setTitle(metadata.title);
    this.meta.updateTag({ name: 'description', content: metadata.description });
    this.meta.updateTag({ property: 'og:title', content: metadata.title }, 'property="og:title"');
    this.meta.updateTag({ property: 'og:description', content: metadata.description }, 'property="og:description"');
    this.meta.updateTag({ property: 'og:url', content: canonicalUrl }, 'property="og:url"');
    this.meta.updateTag({ property: 'og:image', content: SOCIAL_IMAGE_URL }, 'property="og:image"');
    this.meta.updateTag({ name: 'twitter:title', content: metadata.title }, 'name="twitter:title"');
    this.meta.updateTag({ name: 'twitter:description', content: metadata.description }, 'name="twitter:description"');
    this.meta.updateTag({ name: 'twitter:image', content: SOCIAL_IMAGE_URL }, 'name="twitter:image"');

    const canonical = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    canonical?.setAttribute('href', canonicalUrl);
  }

  private updateForRoute(url: string): void {
    const metadata = this.getSeoMetadata(this.router.routerState.snapshot);
    const path = this.getCanonicalPath(url);
    this.updateMetadata(metadata, path);
  }

  private getSeoMetadata(state: RouterStateSnapshot): SeoMetadata {
    let route = state.root;
    let metadata = route.data['seo'] as SeoMetadata | undefined;

    while (route.firstChild) {
      route = route.firstChild;
      metadata = (route.data['seo'] as SeoMetadata | undefined) ?? metadata;
    }

    return metadata ?? HOME_SEO;
  }

  private getCanonicalPath(url: string): string {
    const path = url.split(/[?#]/, 1)[0] || '/';

    if (path === '/' || path === '/home') {
      return '';
    }

    return path.replace(/\/$/, '');
  }

  private getCanonicalUrl(path: string): string {
    return `${SITE_URL}${path}`;
  }
}
