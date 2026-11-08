import { createInterface } from 'node:readline';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { runGhostQAAudit, GHOST_QA_VERSION } from '../engine/audit-runner.js';
import { smokeTestBrowser } from '../engine/browser-session.js';
import { formatAgentDiagnostic } from '../reporter/agent-diagnostic.js';
import { DEFAULT_OPTIONS, type GhostQAOptions, type GhostQAReport } from '../types.js';

/**
 * Native MCP (Model Context Protocol) server for ghost-qa.
 *
 * Standard JSON-RPC 2.0 over stdio, implemented with zero external SDKs:
 * newline-delimited JSON in, newline-delimited JSON out, diagnostics on
 * stderr only (stdout is the protocol channel). Compatible with Claude Code,
 * Claude Desktop, Cursor, Codex and any other MCP host:
 *
 *   { "mcpServers": { "ghost-qa": { "command": "npx", "args": ["-y", "github:avivgerz-hue/ghost-qa", "mcp"] } } }
 */

export const MCP_PROTOCOL_VERSION = '2024-11-05';
export const MCP_SERVER_INFO = { name: 'ghost-qa', version: GHOST_QA_VERSION } as const;

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
  error?: { code: number; message: string; data?: unknown };
}

export const JSON_RPC_ERRORS = {
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internalError: -32603,
} as const;

export interface DoctorResult {
  ready: boolean;
  node: string;
  nodeOk: boolean;
  chromiumPath: string;
  chromiumFound: boolean;
  smokeTest: string;
}

export async function runDoctorCheck(): Promise<DoctorResult> {
  const nodeMajor = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);
  const chromiumPath = process.env.GHOST_QA_CHROMIUM_PATH ?? safeExecutablePath();
  const chromiumFound = chromiumPath !== '' && existsSync(chromiumPath);
  let smokeTest = 'not run (Chromium binary not found)';
  let smokeOk = false;
  if (chromiumFound) {
    const smoke = await smokeTestBrowser();
    smokeOk = smoke.ok;
    smokeTest = smoke.detail.replace(/\s+/g, ' ').slice(0, 400);
  }
  return {
    ready: nodeMajor >= 20 && chromiumFound && smokeOk,
    node: process.versions.node,
    nodeOk: nodeMajor >= 20,
    chromiumPath,
    chromiumFound,
    smokeTest,
  };
}

function safeExecutablePath(): string {
  try {
    return chromium.executablePath();
  } catch {
    return '';
  }
}

export const MCP_TOOLS = [
  {
    name: 'ghost_qa_audit_url',
    description:
      'Run the full ghost-qa headless browser audit against a running localhost app: crawls internal routes on Desktop 1440x900 and Mobile 390x844, safely exercises interactive controls, and traps console/hydration errors, failed network requests, layout overflow, accessibility bugs and performance problems. Returns the Self-Healing Bug Report — fix every critical/major issue it reports before declaring the task done.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Target URL of the running app, e.g. http://localhost:3000',
        },
        maxDepth: { type: 'number', description: 'Link-following depth (default 2)' },
        maxRoutes: { type: 'number', description: 'Maximum routes to visit (default 25)' },
        viewport: {
          type: 'string',
          enum: ['both', 'desktop', 'mobile'],
          description: 'Viewports to test (default both)',
        },
      },
      required: ['url'],
      additionalProperties: false,
    },
  },
  {
    name: 'ghost_qa_doctor',
    description:
      'Verify ghost-qa environment readiness: Node.js version, Chromium binary availability, and a live headless-browser smoke test. Run this first when an audit fails to start.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
] as const;

export type McpToolName = (typeof MCP_TOOLS)[number]['name'];

export interface McpHandlers {
  audit: (target: string, options: GhostQAOptions) => Promise<GhostQAReport>;
  doctor: () => Promise<DoctorResult>;
}

export const defaultHandlers: McpHandlers = {
  audit: (target, options) => runGhostQAAudit(target, options),
  doctor: () => runDoctorCheck(),
};

function toolResult(text: string, structured?: Record<string, unknown>, isError = false) {
  return {
    content: [{ type: 'text', text }],
    ...(structured ? { structuredContent: structured } : {}),
    isError,
  };
}

function optionsFromArgs(args: Record<string, unknown>): GhostQAOptions {
  const options: GhostQAOptions = { ...DEFAULT_OPTIONS, viewports: [...DEFAULT_OPTIONS.viewports] };
  if (typeof args.maxDepth === 'number' && Number.isFinite(args.maxDepth) && args.maxDepth >= 0) {
    options.maxDepth = Math.floor(args.maxDepth);
  }
  if (typeof args.maxRoutes === 'number' && Number.isFinite(args.maxRoutes) && args.maxRoutes > 0) {
    options.maxRoutes = Math.floor(args.maxRoutes);
  }
  if (args.viewport === 'desktop' || args.viewport === 'mobile') {
    options.viewports = [args.viewport];
  } else if (args.viewport === 'both') {
    options.viewports = ['desktop', 'mobile'];
  }
  return options;
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
  handlers: McpHandlers,
): Promise<unknown> {
  switch (name) {
    case 'ghost_qa_audit_url': {
      const url = args.url;
      if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
        return toolResult(
          'Invalid argument: "url" must be an http(s) URL of a running app, e.g. http://localhost:3000',
          undefined,
          true,
        );
      }
      try {
        const report = await handlers.audit(url, optionsFromArgs(args));
        return toolResult(formatAgentDiagnostic(report), {
          passed: report.passed,
          targetUrl: report.targetUrl,
          routesCrawled: report.summary.routesCrawled,
          interactionsTested: report.summary.interactionsTested,
          totalIssues: report.summary.totalIssues,
          bySeverity: report.summary.bySeverity,
          byCategory: report.summary.byCategory,
          issues: report.issues.map((issue) => ({
            id: issue.id,
            severity: issue.severity,
            category: issue.category,
            type: issue.type,
            route: issue.route,
            viewport: issue.viewport,
            message: issue.message,
          })),
        });
      } catch (error) {
        return toolResult(
          `ghost-qa audit failed to run: ${error instanceof Error ? error.message : String(error)}\n` +
            'Check that the dev server is running and Chromium is installed (npx playwright install chromium), or call ghost_qa_doctor.',
          undefined,
          true,
        );
      }
    }
    case 'ghost_qa_doctor': {
      const result = await handlers.doctor();
      const lines = [
        `ghost-qa doctor — ${result.ready ? 'READY ✔' : 'NOT READY ✖'}`,
        `Node.js: ${result.node} ${result.nodeOk ? '(ok)' : '(requires >= 20)'}`,
        `Chromium: ${result.chromiumFound ? result.chromiumPath : 'not found — run: npx playwright install chromium'}`,
        `Smoke test: ${result.smokeTest}`,
      ];
      return toolResult(lines.join('\n'), { ...result });
    }
    default:
      return null;
  }
}

/**
 * Pure JSON-RPC dispatcher — one parsed request in, one response object (or
 * `null` for notifications) out. Fully unit-testable without stdio or a
 * browser when handlers are injected.
 */
export async function handleJsonRpcRequest(
  request: JsonRpcRequest,
  handlers: McpHandlers = defaultHandlers,
): Promise<JsonRpcResponse | null> {
  const id = request.id ?? null;
  const isNotification = request.id === undefined;

  const respond = (result: unknown): JsonRpcResponse | null =>
    isNotification ? null : { jsonrpc: '2.0', id, result };
  const fail = (code: number, message: string): JsonRpcResponse | null =>
    isNotification ? null : { jsonrpc: '2.0', id, error: { code, message } };

  if (!request || typeof request.method !== 'string') {
    return fail(JSON_RPC_ERRORS.invalidRequest, 'Invalid Request: "method" must be a string.');
  }

  switch (request.method) {
    case 'initialize': {
      const requested = request.params?.protocolVersion;
      return respond({
        protocolVersion:
          typeof requested === 'string' && requested ? requested : MCP_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { ...MCP_SERVER_INFO },
        instructions:
          'Use ghost_qa_audit_url to verify any frontend change in a real browser before reporting a task complete. Fix every critical/major issue it returns and re-run until it passes.',
      });
    }
    case 'ping':
      return respond({});
    case 'tools/list':
      return respond({ tools: MCP_TOOLS });
    case 'tools/call': {
      const name = request.params?.name;
      const args = (request.params?.arguments ?? {}) as Record<string, unknown>;
      if (typeof name !== 'string') {
        return fail(JSON_RPC_ERRORS.invalidParams, 'tools/call requires params.name (string).');
      }
      const result = await callTool(name, args, handlers);
      if (result === null) {
        return fail(JSON_RPC_ERRORS.invalidParams, `Unknown tool: ${name}`);
      }
      return respond(result);
    }
    case 'resources/list':
      return respond({ resources: [] });
    case 'prompts/list':
      return respond({ prompts: [] });
    default:
      // Notifications (notifications/initialized, notifications/cancelled…)
      // never get a response; unknown requests get Method Not Found.
      if (isNotification) return null;
      return fail(JSON_RPC_ERRORS.methodNotFound, `Method not found: ${request.method}`);
  }
}

/** Parses one raw line of stdio input into a response line (or null). */
export async function handleJsonRpcLine(
  line: string,
  handlers: McpHandlers = defaultHandlers,
): Promise<string | null> {
  const trimmed = line.trim();
  if (!trimmed) return null;
  let parsed: JsonRpcRequest;
  try {
    parsed = JSON.parse(trimmed) as JsonRpcRequest;
  } catch {
    return JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      error: { code: JSON_RPC_ERRORS.parseError, message: 'Parse error: invalid JSON.' },
    });
  }
  // Batch requests are answered as a batch, per JSON-RPC 2.0.
  if (Array.isArray(parsed)) {
    const responses: JsonRpcResponse[] = [];
    for (const item of parsed as JsonRpcRequest[]) {
      const response = await handleJsonRpcRequest(item, handlers);
      if (response) responses.push(response);
    }
    return responses.length > 0 ? JSON.stringify(responses) : null;
  }
  const response = await handleJsonRpcRequest(parsed, handlers);
  return response ? JSON.stringify(response) : null;
}

/** The ready-to-paste MCP host configuration installed by `ghost-qa init`. */
export function mcpServerConfig(): { mcpServers: Record<string, { command: string; args: string[] }> } {
  return {
    mcpServers: {
      'ghost-qa': { command: 'npx', args: ['-y', 'github:avivgerz-hue/ghost-qa', 'mcp'] },
    },
  };
}

/**
 * Serves MCP over stdio until stdin closes. All human diagnostics go to
 * stderr — stdout carries protocol frames only.
 */
export function startMcpServer(
  input: NodeJS.ReadableStream = process.stdin,
  output: NodeJS.WritableStream = process.stdout,
  handlers: McpHandlers = defaultHandlers,
): Promise<void> {
  process.stderr.write(`ghost-qa MCP server v${GHOST_QA_VERSION} listening on stdio\n`);
  const rl = createInterface({ input, crlfDelay: Infinity });
  return new Promise((resolvePromise) => {
    rl.on('line', (line) => {
      void handleJsonRpcLine(line, handlers)
        .then((responseLine) => {
          if (responseLine) output.write(`${responseLine}\n`);
        })
        .catch((error) => {
          process.stderr.write(
            `ghost-qa MCP handler error: ${error instanceof Error ? error.message : String(error)}\n`,
          );
        });
    });
    rl.on('close', () => resolvePromise());
  });
}
