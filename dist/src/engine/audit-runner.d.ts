import { type GhostQAOptions, type GhostQAReport } from '../types.js';
export declare const GHOST_QA_VERSION = "1.3.1";
/**
 * The full ghost-qa audit: crawl + all five traps (console, network, layout,
 * accessibility, performance) + safe interactions, on every configured
 * viewport. Shared verbatim by the CLI (`ghost-qa test`), the MCP server
 * (`ghost_qa_audit_url`) and library consumers.
 */
export declare function runGhostQAAudit(target: string, options: GhostQAOptions): Promise<GhostQAReport>;
//# sourceMappingURL=audit-runner.d.ts.map