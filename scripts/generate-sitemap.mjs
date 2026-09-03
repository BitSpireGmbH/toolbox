import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SITE_URL = 'https://toolbox.bitspire.ch';
const REGISTRY_FILE = join('src', 'app', 'shared', 'tools.registry.ts');
const SITEMAP_FILE = join('public', 'sitemap.xml');

const check = process.argv.includes('--check');

const registry = readFileSync(REGISTRY_FILE, 'utf8');
const paths = [...registry.matchAll(/^\s*path:\s*'([^']+)'/gm)].map(match => match[1]);

if (paths.length === 0) {
  console.error(`\n[sitemap] Found no tool paths in ${REGISTRY_FILE}.\n`);
  process.exit(1);
}

const urls = [SITE_URL, ...paths.map(path => `${SITE_URL}/${path}`)];

const contents =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(url => `  <url><loc>${url}</loc></url>`).join('\n') +
  '\n</urlset>\n';

const previous = readFileSync(SITEMAP_FILE, 'utf8');

if (previous === contents) {
  process.exit(0);
}

if (check) {
  console.error(
    `\n[sitemap] ${SITEMAP_FILE} does not match the tools registered in ${REGISTRY_FILE}.` +
      `\n[sitemap] Run "node scripts/generate-sitemap.mjs" and commit the result.\n`
  );
  process.exit(1);
}

writeFileSync(SITEMAP_FILE, contents);
console.log(`[sitemap] wrote ${urls.length} URLs to ${SITEMAP_FILE}`);
