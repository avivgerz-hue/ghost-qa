#!/usr/bin/env node
import { type GhostQAOptions } from '../src/types.js';
export declare const VERSION: string;
export declare const AGENT_PROTOCOL = "<!-- ghost-qa:start -->\n## \uD83D\uDC7B ghost-qa \u2014 Browser Verification Protocol (MANDATORY)\n\nBefore reporting any task that touches frontend code as complete, you MUST verify it in a real browser \u2014 the closed-loop Self-Healing Browser Verification Protocol:\n\n1. **Readiness:** run `ghost-qa doctor` (or the `ghost_qa_doctor` MCP tool). Do not proceed on red.\n2. **Baseline audit:** ensure the app runs locally, then `npx -y ghost-qa test <local-url> --out-dir ghost-qa-out` (add `--server-cmd \"npm run dev\"` to let ghost-qa manage the server) \u2014 or call `ghost_qa_audit_url`. This runs the 8-Trap Engine on Desktop 1440\u00D7900, Tablet 768\u00D71024 and Mobile 375\u00D7812, light + dark. Save the baseline as `before.json` (it is `ghost-qa-out/report.json`).\n3. **Root-cause mapping:** for every critical/major finding, map the exact DOM selector, bounding box, stack trace or dark-mode contrast failure back to the component file that renders it.\n4. **Surgical remediation:** fix root causes in source (hydration, overflow, tap targets, ARIA/labels, dark-mode tokens\u2026). Never silence the checker or delete failing UI.\n5. **Delta verification:** re-run the audit to `after.json`, then `npx -y ghost-qa compare before.json after.json` (or `ghost_qa_compare`). Repeat until QA Health Score is **95\u2013100 (A+)**, zero critical/major remain, and the delta shows **zero new regressions**. Only then report done, citing score, routes, viewports and the delta.\n\nNever declare a UI task finished based only on code review, type-checking, or unit tests. The browser is the source of truth.\n<!-- ghost-qa:end -->";
export interface ParsedTestArgs {
    target: string;
    options: GhostQAOptions;
    json: boolean;
    quiet: boolean;
    reportFile?: string;
    htmlFile?: string;
    outDir?: string;
    serverCmd?: string;
    serverTimeoutMs: number;
}
export declare function parseTestArgs(args: string[]): ParsedTestArgs;
export interface ParsedCompareArgs {
    beforeFile: string;
    afterFile: string;
    json: boolean;
    outFile?: string;
}
export declare function parseCompareArgs(args: string[]): ParsedCompareArgs;
export declare function installSkill(targetDir: string, force?: boolean): Promise<Array<{
    file: string;
    action: string;
}>>;
/**
 * Writes (or merges into) `.mcp.json`, preserving any MCP servers the
 * project already configured. The ghost-qa entry is always refreshed so
 * hosts invoke the published CLI: `npx -y ghost-qa mcp`.
 */
export declare function installMcpConfig(mcpJsonPath: string, force?: boolean): Promise<string>;
export declare function main(argv?: string[]): Promise<number>;
/**
 * True when this module is the process entry point. The entry path MUST be
 * realpath-resolved first: package managers invoke bins through a
 * `node_modules/.bin/ghost-qa` symlink, while `import.meta.url` always
 * points at the real file — comparing unresolved paths would make the CLI
 * silently no-op (exit 0, no output) under `npx`.
 */
export declare function isMainEntry(argvEntry: string | undefined, moduleUrl?: string): boolean;
//# sourceMappingURL=ghost-qa.d.ts.map