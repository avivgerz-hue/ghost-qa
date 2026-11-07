#!/usr/bin/env node
import { type GhostQAOptions } from '../src/types.js';
export declare const VERSION = "1.3.0";
export declare const AGENT_PROTOCOL = "<!-- ghost-qa:start -->\n## \uD83D\uDC7B ghost-qa \u2014 Browser Verification Protocol (MANDATORY)\n\nBefore reporting any task that touches frontend code as complete, you MUST verify it in a real browser:\n\n1. Ensure the app is running locally (e.g. `npm run dev`).\n2. Run: `npx ghost-qa test <local-url>` (e.g. `npx ghost-qa test http://localhost:3000`) \u2014 or call the `ghost_qa_audit_url` MCP tool if your host exposes it. Add `--server-cmd \"npm run dev\"` to let ghost-qa manage the dev server itself.\n3. If ghost-qa reports ANY critical or major issue (hydration errors, console errors, 4xx/5xx responses, mobile overflow, accessibility or performance failures, broken interactions), fix the root cause in source and re-run.\n4. Repeat until ghost-qa prints **PASS**. Only then may you tell the user the task is done.\n\nNever declare a UI task finished based only on code review, type-checking, or unit tests. The browser is the source of truth.\n<!-- ghost-qa:end -->";
export interface ParsedTestArgs {
    target: string;
    options: GhostQAOptions;
    json: boolean;
    quiet: boolean;
    reportFile?: string;
    htmlFile?: string;
    serverCmd?: string;
    serverTimeoutMs: number;
}
export declare function parseTestArgs(args: string[]): ParsedTestArgs;
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