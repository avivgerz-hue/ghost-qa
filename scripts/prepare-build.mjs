#!/usr/bin/env node
/**
 * `prepare` lifecycle script — must be safe in EVERY install context:
 *
 * 1. dist/ already built (it is committed to the repo, so
 *    `npx github:avivgerz-hue/ghost-qa` works instantly)  -> no-op.
 * 2. TypeScript available (normal clone / npm install)    -> build.
 * 3. TypeScript absent (production install, git dep with
 *    devDependencies pruned)                              -> no-op, never fail.
 *
 * Failing here would break installs for end users, so every path exits 0
 * except a genuine build failure when TypeScript IS present and dist/ is
 * missing.
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distEntry = join(root, 'dist', 'bin', 'ghost-qa.js');
const tscBin = join(root, 'node_modules', 'typescript', 'bin', 'tsc');

if (existsSync(distEntry)) {
  process.exit(0);
}

if (!existsSync(tscBin)) {
  console.warn(
    'ghost-qa: TypeScript not installed and dist/ missing — skipping build ' +
      '(install from a full clone if you need to compile from source).',
  );
  process.exit(0);
}

const result = spawnSync(process.execPath, [tscBin, '-p', 'tsconfig.json'], {
  cwd: root,
  stdio: 'inherit',
});
process.exit(result.status ?? 0);
