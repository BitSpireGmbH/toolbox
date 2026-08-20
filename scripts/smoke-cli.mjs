import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createToolboxServer } from '../bin/dotnet-toolbox.mjs';

const FRAMEWORK_DIR = join('dist', 'toolbox', 'browser', 'dotnet', '_framework');

const failures = [];

function check(name, condition, detail) {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures.push(`${name}: ${detail}`);
    console.log(`  FAIL ${name} - ${detail}`);
  }
}

const server = createToolboxServer();
await new Promise((ready) => server.listen(0, '127.0.0.1', ready));
const base = `http://127.0.0.1:${server.address().port}`;

try {
  const shell = await fetch(`${base}/`);
  const shellBody = await shell.text();
  check(
    'serves the app shell at /',
    shell.status === 200 && shellBody.includes('<app-root'),
    `status ${shell.status}, ${shellBody.length} bytes`
  );

  const route = await fetch(`${base}/json-to-csharp`);
  const routeBody = await route.text();
  check(
    'falls back to the shell on a deep route',
    route.status === 200 && routeBody === shellBody,
    `status ${route.status}`
  );

  const loader = await fetch(`${base}/dotnet/_framework/dotnet.js`);
  check(
    'serves the .NET loader as javascript',
    loader.status === 200 && loader.headers.get('content-type').startsWith('text/javascript'),
    `status ${loader.status}, type ${loader.headers.get('content-type')}`
  );

  // Any assembly will do - they are content-hashed, so pick whichever this build emitted.
  const wasmFile = readdirSync(FRAMEWORK_DIR).find((file) => file.endsWith('.wasm'));
  const wasm = await fetch(`${base}/dotnet/_framework/${wasmFile}`);
  check(
    'serves WebAssembly as application/wasm',
    wasm.status === 200 && wasm.headers.get('content-type') === 'application/wasm',
    `status ${wasm.status}, type ${wasm.headers.get('content-type')}`
  );

  const manifest = await fetch(`${base}/ngsw.json`);
  check(
    'serves the service worker manifest rather than rewriting it',
    manifest.status === 200 && manifest.headers.get('content-type').startsWith('application/json'),
    `status ${manifest.status}, type ${manifest.headers.get('content-type')}`
  );

  const missingAsset = await fetch(`${base}/assets/not-here.webp`);
  check(
    '404s a missing asset instead of returning the shell',
    missingAsset.status === 404,
    `status ${missingAsset.status}`
  );

  // The URL parser folds the first two of these back inside the root before we see
  // them; the encoded slash in the third survives that and is what the guard is for.
  const traversals = ['/../package.json', '/%2e%2e/package.json', '/..%2fpackage.json'];
  const leaked = [];
  for (const path of traversals) {
    const response = await fetch(base + path);
    if (response.status === 200 && (await response.text()).includes('"devDependencies"')) {
      leaked.push(path);
    }
  }
  check(
    'refuses to serve files outside the app directory',
    leaked.length === 0,
    `leaked via ${leaked.join(', ')}`
  );
} finally {
  server.close();
}

// Deliberately executed as a program rather than through "node", because that is
// what an installed global bin does: npm symlinks it and the kernel reads the
// shebang. Running it as `node bin/...` proves nothing about that path.
const expected = JSON.parse(readFileSync('package.json', 'utf8')).version;
let reported;
try {
  reported = execFileSync('./bin/dotnet-toolbox.mjs', ['--version'], { encoding: 'utf8' }).trim();
} catch (error) {
  reported = `could not run it: ${error.message.split('\n')[0]}`;
}
check('runs as an executable in its own right', reported === expected, `printed "${reported}"`);

// And once more through a symlink, because that is precisely what "npm install -g"
// creates: a link in the bin directory pointing into node_modules. Resolving the
// entry point without following it makes the CLI silently do nothing.
const linkDir = mkdtempSync(join(tmpdir(), 'toolbox-bin-'));
const link = join(linkDir, 'dotnet-toolbox');
let viaLink;
try {
  symlinkSync(resolve('bin/dotnet-toolbox.mjs'), link);
  viaLink = execFileSync(link, ['--version'], { encoding: 'utf8' }).trim();
} catch (error) {
  viaLink = `could not run it: ${error.message.split('\n')[0]}`;
} finally {
  rmSync(linkDir, { recursive: true, force: true });
}
check('runs when linked the way npm installs a global bin', viaLink === expected, `printed "${viaLink}"`);

if (failures.length > 0) {
  console.error(`\n[cli] ${failures.length} check(s) failed.\n`);
  process.exit(1);
}

console.log('\n[cli] all checks passed.\n');
