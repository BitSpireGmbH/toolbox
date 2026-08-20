#!/usr/bin/env node
/**
 * Serves the built Toolbox PWA from disk and opens it.
 *
 * The published package carries the entire app, including the .NET WebAssembly
 * runtime, so this process only ever reads local files - nothing is fetched and
 * nothing is sent anywhere. Deliberately dependency-free: a global install should
 * not put a dependency tree on someone's machine to hand them a static server.
 *
 * The shebang above is load-bearing. npm links a global bin as a bare symlink to
 * this file on macOS and Linux, so it is the only thing telling the kernel to run
 * it with node. Without it the shell runs the file as a shell script and executes
 * the first word of line one - which is "import", i.e. ImageMagick.
 */
import { createServer, get as httpGet } from 'node:http';
import { createReadStream, existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const APP_ROOT = resolve(HERE, '..', 'dist', 'toolbox', 'browser');
const INDEX = join(APP_ROOT, 'index.html');

const { version } = JSON.parse(readFileSync(resolve(HERE, '..', 'package.json'), 'utf8'));

const DEFAULT_PORT = 7654;
const DEFAULT_HOST = '127.0.0.1';

/** Identifies our own server, so a busy port can be told apart from a stranger's. */
const SIGNATURE = 'x-dotnet-toolbox';

/**
 * Mirrors the mimeMap block in web.config. Only one of these is load-bearing:
 * the browser refuses to instantiate WebAssembly streamed as anything other than
 * application/wasm, so a wrong guess here breaks every .NET-backed tool.
 */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.wasm': 'application/wasm',
  '.dat': 'application/octet-stream',
  '.blat': 'application/octet-stream',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

/**
 * Paths that must 404 honestly rather than fall back to the app shell, mirroring the
 * rewrite conditions in web.config. Handing index.html to a service worker asking for
 * ngsw.json parses as "the manifest changed", which loops it on a phantom update
 * forever; handing it to the runtime asking for an assembly hides a missing file
 * behind a confusing parse error.
 */
const NO_FALLBACK_PREFIXES = ['/assets/', '/dotnet/', '/icons/'];
const NO_FALLBACK_FILES = new Set([
  '/ngsw.json',
  '/ngsw-worker.js',
  '/safety-worker.js',
  '/manifest.webmanifest',
]);

/** Revalidated every load, so an upgraded package is noticed instead of cached over. */
const NEVER_CACHE = new Set(['/index.html', '/ngsw.json', '/ngsw-worker.js', '/safety-worker.js']);

const HELP = `
  dotnet-toolbox ${version}

  Serves the Toolbox developer PWA from your machine. Everything runs locally.

  Usage
    dotnet-toolbox [options]

  Options
    --port <number>   Port to listen on (default ${DEFAULT_PORT})
    --host <address>  Address to bind (default ${DEFAULT_HOST})
    --no-open         Print the URL instead of opening a browser
    -v, --version     Print the version
    -h, --help        Print this help

  The port is part of the origin, so the offline cache and any installed copy of
  the app belong to one specific port. Keep the default unless it clashes.
`;

function parseArgs(argv) {
  const options = { port: DEFAULT_PORT, host: DEFAULT_HOST, open: true };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '-h' || arg === '--help') return { ...options, help: true };
    if (arg === '-v' || arg === '--version') return { ...options, showVersion: true };
    if (arg === '--no-open') {
      options.open = false;
    } else if (arg === '--open') {
      options.open = true;
    } else if (arg === '--port' || arg === '--host') {
      const value = argv[++i];
      if (value === undefined) fail(`${arg} needs a value.`);
      if (arg === '--host') {
        options.host = value;
      } else {
        options.port = Number(value);
        if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535) {
          fail(`"${value}" is not a valid port.`);
        }
      }
    } else {
      fail(`Unknown option "${arg}". Try --help.`);
    }
  }

  return options;
}

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

/** Where a request lands on disk, or null if it tries to escape the app directory. */
function resolveWithin(root, urlPath) {
  const target = resolve(root, '.' + urlPath);
  return target === root || target.startsWith(root + sep) ? target : null;
}

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function send(res, status, file, urlPath) {
  const headers = {
    'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'content-length': statSync(file).size,
    [SIGNATURE]: version,
    'cache-control': NEVER_CACHE.has(urlPath)
      ? 'no-cache'
      : // Everything else the build emits is content-hashed, so the name changes
        // whenever the bytes do and this can be held indefinitely.
        'public, max-age=31536000, immutable',
  };

  res.writeHead(status, headers);
  createReadStream(file).pipe(res);
}

export function createToolboxServer() {
  return createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { allow: 'GET, HEAD', [SIGNATURE]: version }).end();
      return;
    }

    let urlPath;
    try {
      urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      res.writeHead(400, { [SIGNATURE]: version }).end('Bad request');
      return;
    }

    const target = resolveWithin(APP_ROOT, urlPath);
    if (target === null) {
      res.writeHead(403, { [SIGNATURE]: version }).end('Forbidden');
      return;
    }

    if (isFile(target)) {
      send(res, 200, target, urlPath);
      return;
    }

    const asIndex = join(target, 'index.html');
    if (isFile(asIndex)) {
      send(res, 200, asIndex, '/index.html');
      return;
    }

    const excluded =
      NO_FALLBACK_FILES.has(urlPath) ||
      NO_FALLBACK_PREFIXES.some((prefix) => urlPath.startsWith(prefix));

    if (excluded) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', [SIGNATURE]: version });
      res.end('Not found');
      return;
    }

    // An Angular route rather than a file. The shell resolves it client-side.
    send(res, 200, INDEX, '/index.html');
  });
}

/** Resolves true if something answering on this port is another copy of us. */
function probeForSelf(host, port) {
  return new Promise((resolveProbe) => {
    const request = httpGet({ host, port, path: '/', timeout: 1500 }, (res) => {
      res.resume();
      resolveProbe(res.headers[SIGNATURE] !== undefined);
    });
    request.on('error', () => resolveProbe(false));
    request.on('timeout', () => {
      request.destroy();
      resolveProbe(false);
    });
  });
}

function openBrowser(url) {
  const [command, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '""', url.replace(/&/g, '^&')]]
        : ['xdg-open', [url]];

  try {
    // Detached so closing this process' stdio never blocks the browser, and so
    // Ctrl+C here does not take the tab with it.
    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.on('error', () => {});
    child.unref();
  } catch {
    // The URL is on screen either way; a headless or locked-down box is not an error.
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(HELP);
    return;
  }

  if (options.showVersion) {
    console.log(version);
    return;
  }

  if (!existsSync(INDEX)) {
    fail(
      `The built app is missing from "${APP_ROOT}".\n` +
        `  If you installed this from npm, please report it at\n` +
        `  https://github.com/BitSpireGmbH/toolbox/issues\n` +
        `  If you are running from a clone, build it first: npm run build`
    );
  }

  const displayHost =
    options.host === '127.0.0.1' || options.host === '0.0.0.0' || options.host === '::'
      ? 'localhost'
      : options.host;
  const url = `http://${displayHost}:${options.port}`;
  const shouldOpen = options.open && !process.env['CI'];

  const server = createToolboxServer();

  server.on('error', async (error) => {
    if (error.code !== 'EADDRINUSE') {
      fail(error.message);
    }

    if (await probeForSelf(options.host, options.port)) {
      console.log(`\n  Toolbox is already running.\n  → ${url}\n`);
      if (shouldOpen) openBrowser(url);
      // The failed listen leaves a handle behind, and the browser was spawned
      // detached, so there is nothing left to wait for.
      process.exit(0);
    }

    fail(
      `Port ${options.port} is already taken by something else.\n` +
        `  Start on another one with: dotnet-toolbox --port ${options.port + 1}\n` +
        `  Note that the offline cache and any installed copy of the app\n` +
        `  belong to the port they were created on.`
    );
  });

  server.listen(options.port, options.host, () => {
    console.log(`\n  Toolbox v${version}\n  → ${url}\n`);
    console.log('  Everything runs locally. Ctrl+C to stop.\n');
    if (shouldOpen) openBrowser(url);
  });

  const stop = () => {
    server.close();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

/**
 * True when this file was run as a program rather than imported by the smoke test.
 *
 * Compared through realpath because npm installs a global bin as a symlink: argv[1]
 * is then the symlink in the bin directory while import.meta.url is the real file
 * inside node_modules, and a plain string compare says "imported" for what is
 * actually the only way users ever run this.
 */
function isRunDirectly() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isRunDirectly()) {
  await main();
}
