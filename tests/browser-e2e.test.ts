import { createServer, type Server } from 'node:http';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runGhostQAAudit } from '../src/engine/audit-runner.js';
import { DEFAULT_OPTIONS, type GhostQAOptions } from '../src/types.js';

/**
 * Real-browser end-to-end test: serves a fixture app with planted bugs,
 * runs the complete audit (crawl + 5 traps + interactions, both viewports)
 * in headless Chromium, and asserts the traps catch exactly what was planted
 * while the clean route passes untouched.
 *
 * Skipped automatically when no Chromium binary is available locally
 * (run `npx playwright install chromium`, or set GHOST_QA_CHROMIUM_PATH).
 * CI installs Chromium before the test step, so it always runs there.
 */
const chromiumPath = process.env.GHOST_QA_CHROMIUM_PATH ?? safeExecutablePath();
const browserAvailable = chromiumPath !== '' && existsSync(chromiumPath);

function safeExecutablePath(): string {
  try {
    return chromium.executablePath();
  } catch {
    return '';
  }
}

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
);

const page = (title: string, body: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
  `<meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>` +
  `<body>${body}</body></html>`;

let server: Server;
let baseUrl = '';

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/pixel.png') {
      res.writeHead(200, { 'content-type': 'image/png' });
      return res.end(PIXEL);
    }
    if (url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end(
        page(
          'Buggy Fixture',
          `<nav><a href="/clean">Clean route</a></nav>
           <h1>Buggy</h1>
           <button onclick="void 0"><svg width="14" height="14"><circle cx="7" cy="7" r="7"/></svg></button>
           <img src="/pixel.png">
           <script>console.error('E2E planted console failure');</script>`,
        ),
      );
    }
    if (url.pathname === '/clean') {
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end(
        page(
          'Clean Fixture',
          `<nav><a href="/">Buggy route</a></nav>
           <h1>Clean</h1>
           <img src="/pixel.png" alt="A single pixel">
           <label>Email <input type="email"></label>
           <button onclick="void 0">Say hi</button>`,
        ),
      );
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    return res.end('not found');
  });
  await new Promise<void>((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
});

const auditOptions = (overrides: Partial<GhostQAOptions> = {}): GhostQAOptions => ({
  ...DEFAULT_OPTIONS,
  viewports: ['desktop', 'mobile'],
  settleMs: 300,
  ...overrides,
});

describe.skipIf(!browserAvailable)('ghost-qa browser E2E (fixture app)', () => {
  it('traps the planted console + accessibility bugs across both viewports', async () => {
    const report = await runGhostQAAudit(`${baseUrl}/`, auditOptions({ maxDepth: 1 }));
    expect(report.passed).toBe(false);
    expect(report.summary.routesCrawled).toBe(2);
    expect(report.routes.map((r) => r.path)).toEqual(expect.arrayContaining(['/', '/clean']));

    const types = new Set(report.issues.map((i) => i.type));
    expect(types.has('console-error')).toBe(true);
    expect(types.has('missing-accessible-name')).toBe(true);
    expect(types.has('img-missing-alt')).toBe(true);

    const viewports = new Set(report.issues.map((i) => i.viewport));
    expect(viewports.has('desktop')).toBe(true);
    expect(viewports.has('mobile')).toBe(true);
  }, 120_000);

  it('passes the clean route with zero issues', async () => {
    const report = await runGhostQAAudit(
      `${baseUrl}/clean`,
      auditOptions({ maxDepth: 0 }),
    );
    expect(report.passed).toBe(true);
    expect(report.summary.totalIssues).toBe(0);
    expect(report.summary.interactionsTested).toBeGreaterThan(0);
  }, 120_000);
});
