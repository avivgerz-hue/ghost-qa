import { createInterface } from 'node:readline';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { runGhostQAAudit, GHOST_QA_VERSION } from '../engine/audit-runner.js';
import { compareReports, formatCompareReport, type CompareDelta } from '../engine/compare.js';
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
 *   { "mcpServers": { "ghost-qa": { "command": "npx", "args": ["-y", "ghost-qa", "mcp"] } } }
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
      'Run the full ghost-qa Deep Browser Inspection against a running localhost app: crawls internal routes on Desktop 1440x900, Tablet 768x1024 and Mobile 375x812 under light + dark colour schemes, safely exercises interactive controls, and runs the 8-Trap Engine (console/framework runtime, network/asset integrity, layout/geometry/collision, WCAG accessibility + keyboard focus, Core Web Vitals performance, link integrity, SEO/metadata, theme parity). Returns the Self-Healing Bug Report plus the QA Health Score (0-100, grade A+ to F) — fix every critical/major issue and re-audit until the score is 95+ before declaring the task done. Save the returned report JSON as before.json for ghost_qa_compare.',
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
          enum: ['all', 'desktop', 'tablet', 'mobile'],
          description: 'Viewports to test (default all: desktop + tablet + mobile)',
        },
      },
      required: ['url'],
      additionalProperties: false,
    },
  },
  {
    name: 'ghost_qa_compare',
    description:
      'Compare two ghost-qa JSON reports (the objects returned by ghost_qa_audit_url, or report.json files written by the CLI) and return the Regression & Verification Delta Report: scoreDelta, fixedFindings, newRegressions and remainingFindings. Use it after fixing bugs to prove the fix worked without introducing regressions; verified=true only at score >= 95 with zero regressions and no blocking findings left.',
    inputSchema: {
      type: 'object',
      properties: {
        before: {
          type: 'object',
          description: 'Baseline ghost-qa report JSON (before fixes), e.g. the saved before.json object',
        },
        after: {
          type: 'object',
          description: 'New ghost-qa report JSON (after fixes), e.g. the saved after.json object',
        },
      },
      required: ['before', 'after'],
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
  compare?: (before: GhostQAReport, after: GhostQAReport) => CompareDelta;
}

export const defaultHandlers: McpHandlers = {
  audit: (target, options) => runGhostQAAudit(target, options),
  doctor: () => runDoctorCheck(),
  compare: (before, after) => compareReports(before, after),
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
  if (args.viewport === 'desktop' || args.viewport === 'tablet' || args.viewport === 'mobile') {
    options.viewports = [args.viewport];
  } else if (args.viewport === 'both') {
    options.viewports = ['desktop', 'mobile'];
  } else if (args.viewport === 'all') {
    options.viewports = ['desktop', 'tablet', 'mobile'];
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
          healthScore: report.health?.score,
          grade: report.health?.grade,
          byTrap: report.health?.byTrap,
          report,
          issues: report.issues.map((issue) => ({
            id: issue.id,
            severity: issue.severity,
            category: issue.category,
            type: issue.type,
            route: issue.route,
            viewport: issue.viewport,
            ...(issue.colorScheme ? { colorScheme: issue.colorScheme } : {}),
            ...(issue.selector ? { selector: issue.selector } : {}),
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
    case 'ghost_qa_compare': {
      const isReport = (value: unknown): value is GhostQAReport =>
        typeof value === 'object' && value !== null && Array.isArray((value as GhostQAReport).issues);
      if (!isReport(args.before) || !isReport(args.after)) {
        return toolResult(
          'Invalid arguments: "before" and "after" must be ghost-qa report JSON objects (with an issues array), as returned by ghost_qa_audit_url or written to report.json by the CLI.',
          undefined,
          true,
        );
      }
      const delta = (handlers.compare ?? defaultHandlers.compare!)(args.before, args.after);
      return toolResult(formatCompareReport(delta), { ...delta });
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
          'Self-healing verification loop: (1) ghost_qa_doctor to confirm readiness, (2) ghost_qa_audit_url across desktop/tablet/mobile + light/dark and save the report as the baseline, (3) map selectors/stacks back to source components and fix root causes, (4) re-audit and call ghost_qa_compare(before, after). Report done only when the delta shows zero new regressions, zero blocking findings, and QA Health Score >= 95 (grade A+ band).',
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
      'ghost-qa': { command: 'npx', args: ['-y', 'ghost-qa', 'mcp'] },
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
