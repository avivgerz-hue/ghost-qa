import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
/**
 * The single source of truth for the ghost-qa version is `package.json`.
 *
 * It is read dynamically at runtime (never hard-coded) so `ghost-qa
 * --version`, MCP `serverInfo`, report metadata and the npm package can
 * never drift apart again — the v1.3.1 npm tarball famously reported
 * "1.3.0" because its committed dist/ had been built before the bump.
 * Falls back to the current release line when package.json is unreachable
 * (exotic bundling), which keeps `GHOST_QA_VERSION` total and side-effect
 * safe.
 */
export const FALLBACK_VERSION = '2.0.0';
function readPackageVersion() {
    const candidates = [];
    try {
        // dist/src/engine/version.js -> <pkg>/package.json (../../..)
        // src/engine/version.ts (vitest/ts) -> <pkg>/package.json (../..)
        const here = dirname(fileURLToPath(import.meta.url));
        candidates.push(join(here, '..', '..', '..', 'package.json'));
        candidates.push(join(here, '..', '..', 'package.json'));
    }
    catch {
        /* import.meta unavailable — cwd candidate below still applies */
    }
    candidates.push(join(process.cwd(), 'package.json'));
    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(readFileSync(candidate, 'utf8'));
            if (parsed.name === 'ghost-qa' && typeof parsed.version === 'string' && parsed.version) {
                return parsed.version;
            }
        }
        catch {
            /* try next candidate */
        }
    }
    return FALLBACK_VERSION;
}
export const GHOST_QA_VERSION = readPackageVersion();
//# sourceMappingURL=version.js.map