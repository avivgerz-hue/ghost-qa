import { type CompareDelta } from '../engine/compare.js';
import { type GhostQAOptions, type GhostQAReport } from '../types.js';
/**
 * Native MCP (Model Context Protocol) server for ghost-qa.
 *
 * Standard JSON-RPC 2.0 over stdio, implemented with zero external SDKs:
 * newline-delimited JSON in, newline-delimited JSON out, diagnostics on
 * stderr only (stdout is the protocol channel). Compatible with Claude Code,
 * Claude Desktop, Cursor, Codex and any other MCP host:
 *
 *   { "mcpServers": { "ghost-qa": { "command": "npx", "args": ["-y", "ghost-qa", "mcp"] } } }
 */
export declare const MCP_PROTOCOL_VERSION = "2024-11-05";
export declare const MCP_SERVER_INFO: {
    readonly name: "ghost-qa";
    readonly version: string;
};
export interface JsonRpcRequest {
    jsonrpc: '2.0';
    id?: string | number | null;
    method: string;
    params?: Record<string, unknown>;
}
export interface JsonRpcResponse {
    jsonrpc: '2.0';
    id: string | number | null;
    result?: unknown;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
}
export declare const JSON_RPC_ERRORS: {
    readonly parseError: -32700;
    readonly invalidRequest: -32600;
    readonly methodNotFound: -32601;
    readonly invalidParams: -32602;
    readonly internalError: -32603;
};
export interface DoctorResult {
    ready: boolean;
    node: string;
    nodeOk: boolean;
    chromiumPath: string;
    chromiumFound: boolean;
    smokeTest: string;
}
export declare function runDoctorCheck(): Promise<DoctorResult>;
export declare const MCP_TOOLS: readonly [{
    readonly name: "ghost_qa_audit_url";
    readonly description: "Run the full ghost-qa Deep Browser Inspection against a running localhost app: crawls internal routes on Desktop 1440x900, Tablet 768x1024 and Mobile 375x812 under light + dark colour schemes, safely exercises interactive controls, and runs the 8-Trap Engine (console/framework runtime, network/asset integrity, layout/geometry/collision, WCAG accessibility + keyboard focus, Core Web Vitals performance, link integrity, SEO/metadata, theme parity). Returns the Self-Healing Bug Report plus the QA Health Score (0-100, grade A+ to F) — fix every critical/major issue and re-audit until the score is 95+ before declaring the task done. Save the returned report JSON as before.json for ghost_qa_compare.";
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {
            readonly url: {
                readonly type: "string";
                readonly description: "Target URL of the running app, e.g. http://localhost:3000";
            };
            readonly maxDepth: {
                readonly type: "number";
                readonly description: "Link-following depth (default 2)";
            };
            readonly maxRoutes: {
                readonly type: "number";
                readonly description: "Maximum routes to visit (default 25)";
            };
            readonly viewport: {
                readonly type: "string";
                readonly enum: readonly ["all", "desktop", "tablet", "mobile"];
                readonly description: "Viewports to test (default all: desktop + tablet + mobile)";
            };
        };
        readonly required: readonly ["url"];
        readonly additionalProperties: false;
    };
}, {
    readonly name: "ghost_qa_compare";
    readonly description: "Compare two ghost-qa JSON reports (the objects returned by ghost_qa_audit_url, or report.json files written by the CLI) and return the Regression & Verification Delta Report: scoreDelta, fixedFindings, newRegressions and remainingFindings. Use it after fixing bugs to prove the fix worked without introducing regressions; verified=true only at score >= 95 with zero regressions and no blocking findings left.";
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {
            readonly before: {
                readonly type: "object";
                readonly description: "Baseline ghost-qa report JSON (before fixes), e.g. the saved before.json object";
            };
            readonly after: {
                readonly type: "object";
                readonly description: "New ghost-qa report JSON (after fixes), e.g. the saved after.json object";
            };
        };
        readonly required: readonly ["before", "after"];
        readonly additionalProperties: false;
    };
}, {
    readonly name: "ghost_qa_doctor";
    readonly description: "Verify ghost-qa environment readiness: Node.js version, Chromium binary availability, and a live headless-browser smoke test. Run this first when an audit fails to start.";
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {};
        readonly additionalProperties: false;
    };
}];
export type McpToolName = (typeof MCP_TOOLS)[number]['name'];
export interface McpHandlers {
    audit: (target: string, options: GhostQAOptions) => Promise<GhostQAReport>;
    doctor: () => Promise<DoctorResult>;
    compare?: (before: GhostQAReport, after: GhostQAReport) => CompareDelta;
}
export declare const defaultHandlers: McpHandlers;
/**
 * Pure JSON-RPC dispatcher — one parsed request in, one response object (or
 * `null` for notifications) out. Fully unit-testable without stdio or a
 * browser when handlers are injected.
 */
export declare function handleJsonRpcRequest(request: JsonRpcRequest, handlers?: McpHandlers): Promise<JsonRpcResponse | null>;
/** Parses one raw line of stdio input into a response line (or null). */
export declare function handleJsonRpcLine(line: string, handlers?: McpHandlers): Promise<string | null>;
/** The ready-to-paste MCP host configuration installed by `ghost-qa init`. */
export declare function mcpServerConfig(): {
    mcpServers: Record<string, {
        command: string;
        args: string[];
    }>;
};
/**
 * Serves MCP over stdio until stdin closes. All human diagnostics go to
 * stderr — stdout carries protocol frames only.
 */
export declare function startMcpServer(input?: NodeJS.ReadableStream, output?: NodeJS.WritableStream, handlers?: McpHandlers): Promise<void>;
//# sourceMappingURL=server.d.ts.map