import { type GhostQAOptions, type GhostQAReport } from '../types.js';
export { GHOST_QA_VERSION } from './version.js';
/**
 * The full ghost-qa audit: crawl + the 8-Trap Deep Browser Inspection
 * Engine (console, network, layout, accessibility, performance, links,
 * SEO, theme) + safe interactions, on every configured viewport and
 * colour scheme. Shared verbatim by the CLI (`ghost-qa test`), the MCP
 * server (`ghost_qa_audit_url`) and library consumers.
 */
export declare function runGhostQAAudit(target: string, options: GhostQAOptions): Promise<GhostQAReport>;
//# sourceMappingURL=audit-runner.d.ts.map