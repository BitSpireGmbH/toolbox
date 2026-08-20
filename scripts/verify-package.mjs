import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BROWSER_DIR = join('dist', 'toolbox', 'browser');

/** Entries whose absence means the tarball is not a working app. */
const REQUIRED = [
  'bin/dotnet-toolbox.mjs',
  `${BROWSER_DIR}/index.html`,
  `${BROWSER_DIR}/ngsw.json`,
  `${BROWSER_DIR}/ngsw-worker.js`,
  `${BROWSER_DIR}/manifest.webmanifest`,
  `${BROWSER_DIR}/dotnet/_framework/dotnet.js`,
];

const missingOnDisk = REQUIRED.filter((entry) => !existsSync(entry));

if (missingOnDisk.length > 0) {
  console.error(
    `\n[package] Not publishable - these are missing from the working tree:\n` +
      missingOnDisk.map((entry) => `  - ${entry}`).join('\n') +
      `\n[package] Run "npm run build" first.\n`
  );
  process.exit(1);
}

// npm links a global bin as a bare symlink on macOS and Linux, so the shebang is
// the only thing that makes it runnable. Without it the shell interprets the file
// and runs its first word - for this file, "import", which is ImageMagick.
const { bin } = JSON.parse(readFileSync('package.json', 'utf8'));

for (const [command, file] of Object.entries(bin)) {
  const firstLine = readFileSync(file, 'utf8').split('\n', 1)[0];
  if (firstLine !== '#!/usr/bin/env node') {
    console.error(
      `\n[package] "${file}" (bin "${command}") does not start with "#!/usr/bin/env node".` +
        `\n[package] It begins with: ${JSON.stringify(firstLine.slice(0, 60))}` +
        `\n[package] Installed globally, the shell would execute it instead of node.\n`
    );
    process.exit(1);
  }

  if (!(statSync(file).mode & 0o111)) {
    console.error(`\n[package] "${file}" is not executable. Run: chmod +x ${file}\n`);
    process.exit(1);
  }
}

if (!process.argv.includes('--pack')) {
  process.exit(0);
}

// --ignore-scripts so this does not re-enter itself through prepack.
const report = JSON.parse(
  execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
);

// npm 11 reports an object keyed by package name; older versions report an array.
const [packed] = Array.isArray(report) ? report : Object.values(report);

const shipped = new Set(packed.files.map((file) => file.path));
const missingFromTarball = REQUIRED.filter((entry) => !shipped.has(entry));

if (missingFromTarball.length > 0) {
  console.error(
    `\n[package] "${packed.name}" would ship without:\n` +
      missingFromTarball.map((entry) => `  - ${entry}`).join('\n') +
      `\n[package] Check the "files" field in package.json. The build output is` +
      `\n[package] gitignored, so it only ships because "files" allowlists it.\n`
  );
  process.exit(1);
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
console.log(
  `[package] ${packed.name}@${packed.version}: ${packed.entryCount} files, ` +
    `${mb(packed.unpackedSize)} unpacked, ${mb(packed.size)} tarball.`
);
