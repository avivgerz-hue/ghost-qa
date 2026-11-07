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
    readonly version: "1.3.0";
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
    readonly description: "Run the full ghost-qa headless browser audit against a running localhost app: crawls internal routes on Desktop 1440x900 and Mobile 390x844, safely exercises interactive controls, and traps console/hydration errors, failed network requests, layout overflow, accessibility bugs and performance problems. Returns the Self-Healing Bug Report — fix every critical/major issue it reports before declaring the task done.";
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
                readonly enum: readonly ["both", "desktop", "mobile"];
                readonly description: "Viewports to test (default both)";
            };
        };
        readonly required: readonly ["url"];
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