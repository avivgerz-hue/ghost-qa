import { mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isMainEntry } from '../bin/ghost-qa.js';

/**
 * Regression test: package managers run bins via a node_modules/.bin
 * symlink. The CLI's entry-point check must realpath-resolve that symlink,
 * otherwise `npx` (bin symlink) silently exits 0 with no output.
 */
describe('CLI entry-point detection (npx symlink regression)', () => {
  it('recognises invocation through a .bin-style symlink', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ghost-qa-entry-'));
    const real = join(dir, 'ghost-qa.js');
    const link = join(dir, '.bin-ghost-qa');
    await writeFile(real, 'export {};\n');
    await symlink(real, link);

    const moduleUrl = pathToFileURL(real).href;
    expect(isMainEntry(link, moduleUrl)).toBe(true);
    expect(isMainEntry(real, moduleUrl)).toBe(true);
  });

  it('rejects other entries and missing argv', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ghost-qa-entry-'));
    const real = join(dir, 'ghost-qa.js');
    await writeFile(real, 'export {};\n');
    const moduleUrl = pathToFileURL(real).href;

    expect(isMainEntry(join(dir, 'something-else.js'), moduleUrl)).toBe(false);
    expect(isMainEntry(undefined, moduleUrl)).toBe(false);
  });
});
