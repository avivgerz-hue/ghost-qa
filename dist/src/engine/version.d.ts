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
export declare const FALLBACK_VERSION = "2.1.0";
export declare const GHOST_QA_VERSION: string;
//# sourceMappingURL=version.d.ts.map