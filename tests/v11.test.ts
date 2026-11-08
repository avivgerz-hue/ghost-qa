import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { evaluateA11yMetrics, EMPTY_A11Y_METRICS, type A11yMetrics } from '../src/traps/a11y-trap.js';
import { evaluatePerfMetrics, EMPTY_PERF_METRICS, PERF_THRESHOLDS, type PerfMetrics } from '../src/traps/perf-trap.js';
import {
  handleJsonRpcLine,
  handleJsonRpcRequest,
  JSON_RPC_ERRORS,
  MCP_TOOLS,
  mcpServerConfig,
  startMcpServer,
  type McpHandlers,
} from '../src/mcp/server.js';
import { escapeHtml, formatHtmlReport } from '../src/reporter/html-report.js';
import { ManagedDevServer, waitForUrl, withManagedDevServer } from '../src/engine/server-lifecycle.js';
import { installMcpConfig } from '../bin/ghost-qa.js';
import { summarise, type GhostQAReport } from '../src/types.js';
import { GHOST_QA_VERSION } from '../src/engine/audit-runner.js';

const a11y = (overrides: Partial<A11yMetrics> = {}): A11yMetrics => ({ ...EMPTY_A11Y_METRICS, ...overrides });
const perf = (overrides: Partial<PerfMetrics> = {}): PerfMetrics => ({ ...EMPTY_PERF_METRICS, ...overrides });

function sampleReport(): GhostQAReport {
  const routes = [{
    url: 'http://localhost:3000/', path: '/', depth: 0,
    title: 'Home <script>alert(1)</script>', httpStatus: 200,
    viewports: ['desktop', 'mobile'] as GhostQAReport['routes'][number]['viewports'],
    issueCount: 1,
  }];
  const issues = evaluateA11yMetrics(a11y({ imagesMissingAlt: ['http://x/hero.png'] }), '/', 'mobile');
  const summary = summarise(routes, [], issues, 'major');
  return {
    tool: 'ghost-qa', version: '1.1.0', targetUrl: 'http://localhost:3000/',
    startedAt: new Date(0).toISOString(), finishedAt: new Date(1500).toISOString(), durationMs: 1500,
    passed: summary.passed,
    options: {
      maxDepth: 2, maxRoutes: 25, maxInteractionsPerPage: 12, timeoutMs: 15000, settleMs: 600,
      headless: true, viewports: ['desktop', 'mobile'], interactions: true, failOn: 'major',
    },
    routes,
    interactions: [{ kind: 'click', target: 'button "Open"', route: '/', viewport: 'desktop', outcome: 'passed' }],
    issues,
    summary: {
      routesCrawled: 1, interactionsTested: 1, interactionsSkipped: 0, interactionsFailed: 0,
      totalIssues: summary.totalIssues, bySeverity: summary.bySeverity, byCategory: summary.byCategory,
    },
  };
}

const fakeHandlers: McpHandlers = {
  audit: async () => sampleReport(),
  doctor: async () => ({
    ready: true, node: '22.0.0', nodeOk: true, chromiumPath: '/usr/bin/chromium', chromiumFound: true,
    smokeTest: 'Chromium launched and rendered about:blank successfully.',
  }),
};

describe('AccessibilityTrap evaluation', () => {
  it('passes an accessible page', () => {
    expect(evaluateA11yMetrics(a11y(), '/', 'desktop')).toEqual([]);
  });

  it('flags buttons and links without accessible names', () => {
    const issues = evaluateA11yMetrics(a11y({ buttonsWithoutName: ['button.icon'], linksWithoutName: ['a#social'] }), '/', 'mobile');
    expect(issues).toHaveLength(2);
    expect(issues.every((i) => i.category === 'accessibility' && i.type === 'missing-accessible-name' && i.severity === 'major')).toBe(true);
  });

  it('flags images missing alt, but alt="" (decorative) is not in the metrics', () => {
    const issues = evaluateA11yMetrics(a11y({ imagesMissingAlt: ['http://x/a.png'] }), '/p', 'desktop');
    expect(issues[0]).toMatchObject({ type: 'img-missing-alt', route: '/p' });
    expect(issues[0]?.message).toContain('alt=""');
  });

  it('flags unlabelled inputs and explains a placeholder is not a label', () => {
    const issues = evaluateA11yMetrics(a11y({ inputsMissingLabel: ['input#email'] }), '/', 'desktop');
    expect(issues[0]?.type).toBe('input-missing-label');
    expect(issues[0]?.message).toContain('placeholder is not a label');
  });

  it('flags missing title as major and missing lang as minor', () => {
    const issues = evaluateA11yMetrics(a11y({ hasDocumentTitle: false, hasHtmlLang: false }), '/', 'desktop');
    expect(issues.find((i) => i.type === 'missing-document-title')?.severity).toBe('major');
    expect(issues.find((i) => i.type === 'missing-html-lang')?.severity).toBe('minor');
  });

  it('caps findings per kind at 5', () => {
    const many = Array.from({ length: 12 }, (_, i) => `button.b${i}`);
    expect(evaluateA11yMetrics(a11y({ buttonsWithoutName: many }), '/', 'desktop')).toHaveLength(5);
  });
});

describe('PerformanceTrap evaluation', () => {
  it('passes a fast, light page', () => {
    expect(evaluatePerfMetrics(perf({ domContentLoadedMs: 400, loadMs: 900, totalTransferBytes: 200_000 }), '/', 'desktop')).toEqual([]);
  });

  it('flags slow loads as major, doubling the budget as critical', () => {
    const major = evaluatePerfMetrics(perf({ domContentLoadedMs: PERF_THRESHOLDS.domContentLoadedMs + 1 }), '/', 'mobile');
    expect(major[0]).toMatchObject({ type: 'slow-page-load', severity: 'major', category: 'performance' });
    const critical = evaluatePerfMetrics(perf({ loadMs: PERF_THRESHOLDS.loadMs * 2 + 1 }), '/', 'mobile');
    expect(critical[0]?.severity).toBe('critical');
  });

  it('flags oversized individual resources and excessive total payload', () => {
    const issues = evaluatePerfMetrics(perf({
      totalTransferBytes: PERF_THRESHOLDS.totalTransferBytes + 1, resourceCount: 42,
      oversizedResources: [{ url: 'http://x/hero.mp4', transferBytes: PERF_THRESHOLDS.singleResourceBytes + 1 }],
    }), '/', 'desktop');
    expect(issues.map((i) => i.type)).toEqual(expect.arrayContaining(['oversized-resource', 'excessive-payload']));
  });

  it('ignores sub-threshold resources in the oversized list', () => {
    const issues = evaluatePerfMetrics(perf({ oversizedResources: [{ url: 'http://x/a.js', transferBytes: 300_000 }] }), '/', 'desktop');
    expect(issues.filter((i) => i.type === 'oversized-resource')).toEqual([]);
  });

  it('flags layout thrashing (long tasks), render-blocking tags and DOM size', () => {
    const issues = evaluatePerfMetrics(perf({
      longTaskCount: 9, longTaskTotalMs: 900, renderBlockingCount: 8, domNodeCount: 2400,
    }), '/', 'desktop');
    expect(issues.map((i) => i.type)).toEqual(
      expect.arrayContaining(['layout-thrashing', 'render-blocking-resources', 'excessive-dom-size']),
    );
    expect(issues.find((i) => i.type === 'layout-thrashing')?.severity).toBe('major');
  });
});

describe('MCP JSON-RPC protocol handler', () => {
  it('answers initialize with protocol version, capabilities and server info', async () => {
    const res = await handleJsonRpcRequest(
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05' } },
      fakeHandlers,
    );
    const result = res?.result as { protocolVersion: string; serverInfo: { name: string; version: string } };
    expect(result.protocolVersion).toBe('2024-11-05');
    expect(result.serverInfo).toEqual({ name: 'ghost-qa', version: GHOST_QA_VERSION });
  });

  it('lists both ghost-qa tools with input schemas', async () => {
    const res = await handleJsonRpcRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, fakeHandlers);
    const tools = (res?.result as { tools: typeof MCP_TOOLS }).tools;
    expect(tools.map((t) => t.name)).toEqual(['ghost_qa_audit_url', 'ghost_qa_compare', 'ghost_qa_doctor']);
    expect(tools[0]?.inputSchema.required).toEqual(['url']);
  });

  it('ghost_qa_doctor returns a readable readiness summary + structured content', async () => {
    const res = await handleJsonRpcRequest(
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'ghost_qa_doctor', arguments: {} } },
      fakeHandlers,
    );
    const result = res?.result as { content: Array<{ text: string }>; structuredContent: { ready: boolean }; isError: boolean };
    expect(result.isError).toBe(false);
    expect(result.content[0]?.text).toContain('READY');
    expect(result.structuredContent.ready).toBe(true);
  });

  it('ghost_qa_audit_url runs the audit and returns the self-healing diagnostic', async () => {
    const res = await handleJsonRpcRequest(
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'ghost_qa_audit_url', arguments: { url: 'http://localhost:3000' } } },
      fakeHandlers,
    );
    const result = res?.result as { content: Array<{ text: string }>; structuredContent: { passed: boolean; totalIssues: number } };
    expect(result.content[0]?.text).toContain('Self-Healing Bug Report');
    expect(result.structuredContent.totalIssues).toBe(1);
  });

  it('rejects a non-URL audit argument as a tool error, not a crash', async () => {
    const res = await handleJsonRpcRequest(
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'ghost_qa_audit_url', arguments: { url: 'not a url' } } },
      fakeHandlers,
    );
    expect((res?.result as { isError: boolean }).isError).toBe(true);
  });

  it('maps unknown tools and unknown methods to JSON-RPC errors', async () => {
    const tool = await handleJsonRpcRequest(
      { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'nope', arguments: {} } },
      fakeHandlers,
    );
    expect(tool?.error?.code).toBe(JSON_RPC_ERRORS.invalidParams);
    const method = await handleJsonRpcRequest({ jsonrpc: '2.0', id: 7, method: 'bogus/method' }, fakeHandlers);
    expect(method?.error?.code).toBe(JSON_RPC_ERRORS.methodNotFound);
  });

  it('never responds to notifications, and handles parse errors + ping by line', async () => {
    expect(await handleJsonRpcRequest({ jsonrpc: '2.0', method: 'notifications/initialized' }, fakeHandlers)).toBeNull();
    expect(await handleJsonRpcLine('   ', fakeHandlers)).toBeNull();
    const parse = JSON.parse((await handleJsonRpcLine('{oops', fakeHandlers))!) as { error: { code: number } };
    expect(parse.error.code).toBe(JSON_RPC_ERRORS.parseError);
    const ping = JSON.parse((await handleJsonRpcLine('{"jsonrpc":"2.0","id":9,"method":"ping"}', fakeHandlers))!) as { id: number; result: unknown };
    expect(ping).toMatchObject({ id: 9, result: {} });
  });

  it('serves a full stdio session through startMcpServer', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    let received = '';
    output.on('data', (chunk) => { received += chunk.toString(); });
    const done = startMcpServer(input, output, fakeHandlers);
    input.write('{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}\n');
    input.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n');
    input.write('{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"ghost_qa_doctor","arguments":{}}}\n');
    input.end();
    await done;
    const lines = received.trim().split('\n').map((l) => JSON.parse(l) as { id: number });
    expect(lines.map((l) => l.id)).toEqual([1, 2]);
  });

  it('exposes the ready-to-paste mcpServers config', () => {
    expect(mcpServerConfig()).toEqual({ mcpServers: { 'ghost-qa': { command: 'npx', args: ['-y', 'ghost-qa', 'mcp'] } } });
  });
});

describe('HTML visual evidence report', () => {
  it('is a self-contained dark-mode dashboard with all run sections', () => {
    const html = formatHtmlReport(sampleReport());
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('color-scheme: dark');
    expect(html).toContain('Routes crawled');
    expect(html).toContain('Interactions executed');
    expect(html).toContain('Failures caught');
    expect(html).toContain('img-missing-alt'.length ? 'alt attribute' : '');
    expect(html).not.toMatch(/<script src=|<link rel="stylesheet"/);
  });

  it('escapes hostile route titles and targets (no markup injection)', () => {
    const html = formatHtmlReport(sampleReport());
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(escapeHtml(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  });
});

describe('Dev-server lifecycle wrapper', () => {
  it('spawns a server, waits for readiness, runs, and tears the tree down', async () => {
    const port = 43_217;
    const server = new ManagedDevServer(
      `node -e "require('http').createServer((q,r)=>{r.end('ok')}).listen(${port})"`,
    );
    server.start();
    expect(server.isRunning).toBe(true);
    await server.waitUntilReady(`http://127.0.0.1:${port}/`, 10_000);
    await expect(waitForUrl(`http://127.0.0.1:${port}/`, 1_000)).resolves.toBeUndefined();
    await server.stop();
    expect(server.isRunning).toBe(false);
    await expect(waitForUrl(`http://127.0.0.1:${port}/`, 600, 100)).rejects.toThrow(/Timed out/);
  }, 20_000);

  it('fails fast with captured output when the server exits early', async () => {
    const server = new ManagedDevServer('node -e "console.error(\'boom on start\'); process.exit(3)"');
    server.start();
    await expect(server.waitUntilReady('http://127.0.0.1:43_218/', 5_000)).rejects.toThrow(/boom on start/);
    await server.stop();
  }, 20_000);

  it('withManagedDevServer always terminates the server, even on throw', async () => {
    const port = 43_219;
    await expect(
      withManagedDevServer(
        `node -e "require('http').createServer((q,r)=>{r.end('ok')}).listen(${port})"`,
        `http://127.0.0.1:${port}/`,
        async () => { throw new Error('audit exploded'); },
        { readyTimeoutMs: 10_000 },
      ),
    ).rejects.toThrow('audit exploded');
    await expect(waitForUrl(`http://127.0.0.1:${port}/`, 600, 100)).rejects.toThrow(/Timed out/);
  }, 20_000);
});

describe('ghost-qa init MCP config', () => {
  it('writes .mcp.json and merges without clobbering other servers', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ghost-qa-init-'));
    const file = join(dir, '.mcp.json');
    expect(await installMcpConfig(file)).toBe('installed');
    let parsed = JSON.parse(await readFile(file, 'utf8')) as { mcpServers: Record<string, unknown> };
    expect(parsed.mcpServers['ghost-qa']).toEqual({ command: 'npx', args: ['-y', 'ghost-qa', 'mcp'] });
    expect(await installMcpConfig(file)).toBe('already configured');

    parsed.mcpServers['other-tool'] = { command: 'other' };
    const { writeFile } = await import('node:fs/promises');
    await writeFile(file, JSON.stringify(parsed));
    expect(await installMcpConfig(file)).toBe('already configured');
    parsed = JSON.parse(await readFile(file, 'utf8')) as { mcpServers: Record<string, unknown> };
    expect(parsed.mcpServers['other-tool']).toEqual({ command: 'other' });
    expect(parsed.mcpServers['ghost-qa']).toBeDefined();
  });
});
