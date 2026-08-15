/**
 * Empties the publish directory before `dotnet publish` writes to it.
 *
 * Without this, repeated local builds accumulate: every published file carries a
 * content hash in its name, so a rebuilt runtime lands *beside* the previous one
 * rather than replacing it. Three builds in an afternoon left three copies of
 * dotnet.native.wasm - 2.6MB each - and angular.json copies the whole directory into
 * the app, where ngsw-config.json then prefetches all of it. The result was a 16MB
 * offline cache for a 7MB runtime.
 *
 * CI never saw this because it builds from a fresh checkout; it only ever hurt local
 * development, which is exactly where it is least likely to be noticed.
 */
import { rmSync } from 'node:fs';
import { join } from 'node:path';

const PUBLISH_DIR = join('dotnet', 'artifacts', 'publish');

rmSync(PUBLISH_DIR, { recursive: true, force: true });
