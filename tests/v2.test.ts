import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GHOST_QA_VERSION } from '../src/engine/audit-runner.js';
import { FALLBACK_VERSION } from '../src/engine/version.js';
import { computeHealthScore, gradeForScore } from '../src/engine/health-score.js';
import { compareReports, formatCompareReport } from '../src/engine/compare.js';
import { classifyConsoleText, consoleIssueFromText } from '../src/traps/console-trap.js';
import { evaluateRequestFailure } from '../src/traps/network-trap.js';
import { evaluateLayoutMetrics, EMPTY_METRICS, type LayoutMetrics } from '../src/traps/layout-trap.js';
import { contrastRatio, evaluateA11yMetrics, EMPTY_A11Y_METRICS } from '../src/traps/a11y-trap.js';
import { evaluatePerfMetrics, EMPTY_PERF_METRICS } from '../src/traps/perf-trap.js';
import { evaluateLinkMetrics, EMPTY_LINK_METRICS, isPlaceholderHref } from '../src/traps/links-trap.js';
import { evaluateSeoMetrics, EMPTY_SEO_METRICS } from '../src/traps/seo-trap.js';
import { evaluateThemeMetrics } from '../src/traps/theme-trap.js';
import { handleJsonRpcRequest, type McpHandlers } from '../src/mcp/server.js';
import { formatPatchPrompt } from '../src/reporter/agent-diagnostic.js';
import { formatHtmlReport } from '../src/reporter/html-report.js';
import { parseCompareArgs, parseTestArgs } from '../bin/ghost-qa.js';
import { makeIssue, summarise, type GhostQAReport, type QAIssue } from '../src/types.js';

const issue = (partial: Partial<QAIssue> & Pick<QAIssue, 'category' | 'severity' | 'type' | 'message'>): QAIssue =>
  makeIssue({ route: '/', viewport: 'desktop', ...partial });

function reportWith(issues: QAIssue[]): GhostQAReport {
  const routes = [
    { url: 'http://localhost:3000/', path: '/', depth: 0, title: 'Home', httpStatus: 200, viewports: ['desktop', 'tablet', 'mobile'] as GhostQAReport['routes'][number]['viewports'], issueCount: issues.length },
  ];
  const summary = summarise(routes, [], issues, 'major');
  const health = computeHealthScore(issues);
  return {
    tool: 'ghost-qa',
    version: GHOST_QA_VERSION,
    targetUrl: 'http://localhost:3000/',
    startedAt: '2026-11-08T00:00:00.000Z',
    finishedAt: '2026-11-08T00:00:01.000Z',
    durationMs: 1000,
    passed: summary.passed,
    options: { maxDepth: 2, maxRoutes: 25, maxInteractionsPerPage: 12, timeoutMs: 15000, settleMs: 600, headless: true, viewports: ['desktop', 'tablet', 'mobile'], interactions: true, failOn: 'major', colorSchemes: ['light', 'dark'] },
    routes,
    interactions: [],
    issues,
    health,
    summary: { ...summary, healthScore: health.score, grade: health.grade },
  };
}

describe('dynamic version loading (never lags package.json again)', () => {
  it('GHOST_QA_VERSION is read from package.json and equals 2.1.1', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as { version: string };
    expect(GHOST_QA_VERSION).toBe(pkg.version);
    expect(GHOST_QA_VERSION).toBe('2.1.1');
    expect(FALLBACK_VERSION).toBe('2.1.1');
  });
});

describe('Trap 1 — console & framework runtime (v2 additions)', () => {
  it('classifies React duplicate-key warnings', () => {
    expect(classifyConsoleText('Warning: Encountered two children with the same key, "abc".')).toBe('duplicate-key-warning');
    expect(consoleIssueFromText('Encountered two children with the same key', '/', 'desktop')?.type).toBe('duplicate-key-warning');
  });

  it('classifies CSP violations', () => {
    expect(classifyConsoleText('Refused to load the script because it violates the following Content Security Policy directive')).toBe('csp-violation');
    expect(consoleIssueFromText('Content Security Policy blocked inline script', '/', 'mobile')?.severity).toBe('major');
  });
});

describe('Trap 2 — network & asset integrity (v2 additions)', () => {
  it('flags timed-out requests distinctly from aborts', () => {
    expect(evaluateRequestFailure('net::ERR_TIMED_OUT', 'http://x/api', '/', 'desktop')?.type).toBe('request-timeout');
    expect(evaluateRequestFailure('net::ERR_ABORTED', 'http://x/api', '/', 'desktop')).toBeNull();
  });

  it('flags failed CORS preflights as critical', () => {
    const found = evaluateRequestFailure('net::ERR_FAILED', 'http://x/api', '/', 'desktop', 'other', { preflight: true });
    expect(found?.type).toBe('cors-preflight-failed');
    expect(found?.severity).toBe('critical');
  });
});

describe('Trap 3 — layout geometry (v2 additions)', () => {
  const metrics = (partial: Partial<LayoutMetrics>): LayoutMetrics => ({ ...EMPTY_METRICS, innerWidth: 375, scrollWidth: 375, hasViewportMeta: true, ...partial });
  const box = { x: 0, y: 0, width: 30, height: 30 };

  it('detects overlapping interactive elements with selector + bounding box', () => {
    const found = evaluateLayoutMetrics(metrics({ collisions: [{ first: 'button#a', second: 'a#b', selector: '#a', box }] }), '/', 'mobile');
    expect(found[0]?.type).toBe('element-collision');
    expect(found[0]?.selector).toBe('#a');
    expect(found[0]?.boundingBox).toEqual(box);
  });

  it('flags sub-44px touch targets on touch viewports only', () => {
    const small = [{ descriptor: 'button.icon', selector: '.icon', box }];
    expect(evaluateLayoutMetrics(metrics({ smallTouchTargets: small }), '/', 'mobile').map((i) => i.type)).toContain('small-touch-target');
    expect(evaluateLayoutMetrics(metrics({ smallTouchTargets: small }), '/', 'desktop')).toEqual([]);
  });

  it('flags clipped text, off-screen interactives and broken SVGs', () => {
    const found = evaluateLayoutMetrics(
      metrics({
        clippedText: [{ descriptor: 'p.note', selector: '.note', box }],
        offscreenInteractives: [{ descriptor: 'button.cta', selector: '.cta', box }],
        brokenSvgs: ['#logo'],
      }),
      '/',
      'desktop',
    );
    expect(found.map((i) => i.type)).toEqual(expect.arrayContaining(['clipped-text', 'offscreen-interactive', 'broken-svg']));
    expect(found.find((i) => i.type === 'broken-svg')?.category).toBe('network');
  });
});

describe('Trap 4 — accessibility (v2 additions)', () => {
  it('computes real WCAG contrast ratios', () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 0);
    expect(contrastRatio([255, 255, 255], [255, 255, 255])).toBeCloseTo(1, 5);
    expect(contrastRatio([119, 119, 119], [255, 255, 255])).toBeLessThan(4.5);
  });

  it('flags contrast failures, heading skips and invisible focus', () => {
    const found = evaluateA11yMetrics(
      {
        ...EMPTY_A11Y_METRICS,
        contrastFailures: [{ descriptor: 'p.dim', selector: '.dim', ratio: 2.1, required: 4.5 }],
        headingProblems: ['level skip h1 → h3 at "Pricing"'],
        focusProblems: ['3 focused elements show no visible focus indicator'],
      },
      '/',
      'desktop',
    );
    expect(found.map((i) => i.type)).toEqual(expect.arrayContaining(['contrast-insufficient', 'heading-hierarchy', 'focus-not-visible']));
  });
});

describe('Trap 5 — performance & Core Web Vitals (v2 additions)', () => {
  it('flags slow TTFB/FCP/LCP, high CLS and deep DOM', () => {
    const found = evaluatePerfMetrics(
      { ...EMPTY_PERF_METRICS, ttfbMs: 2000, fcpMs: 4000, lcpMs: 5000, cls: 0.3, maxDomDepth: 40 },
      '/',
      'desktop',
    );
    expect(found.map((i) => i.type)).toEqual(expect.arrayContaining(['slow-ttfb', 'slow-fcp', 'slow-lcp', 'high-cls', 'deep-dom']));
    expect(found.find((i) => i.type === 'slow-lcp')?.severity).toBe('critical');
  });

  it('flags >500KB unoptimized images/scripts below the oversized threshold', () => {
    const found = evaluatePerfMetrics(
      { ...EMPTY_PERF_METRICS, oversizedResources: [{ url: 'http://x/hero.png', transferBytes: 600_000, kind: 'img' }] },
      '/',
      'mobile',
    );
    expect(found.map((i) => i.type)).toContain('unoptimized-resource');
  });
});

describe('Trap 6 — safe interactive & link integrity', () => {
  it('recognises placeholder hrefs', () => {
    expect(isPlaceholderHref('')).toBe(true);
    expect(isPlaceholderHref('#')).toBe(true);
    expect(isPlaceholderHref('javascript:void(0)')).toBe(true);
    expect(isPlaceholderHref('/pricing')).toBe(false);
  });

  it('evaluates placeholder/dead/form-button/disabled findings', () => {
    const found = evaluateLinkMetrics(
      {
        ...EMPTY_LINK_METRICS,
        placeholderLinks: [{ descriptor: 'a "Click"', selector: 'a.x', href: '#' }],
        deadAnchors: [{ descriptor: 'a "Jump"', selector: 'a.y', href: '#missing' }],
        formButtonsMissingType: [{ descriptor: 'button "Save"', selector: 'form button', href: '' }],
        stuckDisabled: [{ descriptor: 'button "Pay"', selector: '#pay', href: '' }],
      },
      '/',
      'desktop',
    );
    expect(found.map((i) => i.type)).toEqual(
      expect.arrayContaining(['placeholder-link', 'dead-link', 'form-button-missing-type', 'stuck-disabled']),
    );
    expect(found.every((i) => i.category === 'links')).toBe(true);
  });
});

describe('Trap 7 — SEO, metadata & social graph', () => {
  it('flags missing metadata, OG gaps and duplicate ids', () => {
    const found = evaluateSeoMetrics({ ...EMPTY_SEO_METRICS, title: 'Hi', duplicateIds: ['root'] }, '/', 'desktop');
    const types = found.map((i) => i.type);
    expect(types).toEqual(
      expect.arrayContaining(['title-too-short', 'missing-meta-description', 'missing-canonical', 'missing-opengraph', 'duplicate-id']),
    );
    expect(found.find((i) => i.type === 'duplicate-id')?.selector).toBe('#root');
  });

  it('passes a fully-tagged page', () => {
    const found = evaluateSeoMetrics(
      { title: 'A descriptive page title', hasDescription: true, hasLang: true, hasViewportMeta: true, hasCanonical: true, ogTitle: true, ogDescription: true, ogImage: true, duplicateIds: [] },
      '/',
      'desktop',
    );
    expect(found).toEqual([]);
  });
});

describe('Trap 8 — dark/light theme emulation', () => {
  it('tags contrast failures with the failing colour scheme', () => {
    const found = evaluateThemeMetrics(
      { failures: [{ descriptor: 'p.copy', selector: '.copy', ratio: 1.4, required: 4.5 }] },
      '/',
      'mobile',
      'dark',
    );
    expect(found[0]?.type).toBe('theme-contrast');
    expect(found[0]?.category).toBe('theme');
    expect(found[0]?.colorScheme).toBe('dark');
  });
});

describe('QA Health Score (deterministic, A+ to F)', () => {
  it('scores a clean run 100 / A+', () => {
    const health = computeHealthScore([]);
    expect(health.score).toBe(100);
    expect(health.grade).toBe('A+');
    expect(health.byTrap).toHaveLength(8);
  });

  it('deducts per trap by severity and grades deterministically', () => {
    const issues = [
      issue({ category: 'console', severity: 'critical', type: 'page-error', message: 'boom' }),
      issue({ category: 'console', severity: 'major', type: 'console-error', message: 'bad' }),
      issue({ category: 'seo', severity: 'minor', type: 'missing-canonical', message: 'no canonical' }),
    ];
    const health = computeHealthScore(issues);
    expect(health.byTrap.find((t) => t.trap === 'console')?.score).toBe(65);
    expect(health.byTrap.find((t) => t.trap === 'seo')?.score).toBe(97);
    // mean of [65,100,100,100,100,100,97,100] = 95.25 -> 95
    expect(health.score).toBe(95);
    expect(computeHealthScore(issues)).toEqual(health);
  });

  it('maps grade boundaries', () => {
    expect(gradeForScore(97)).toBe('A+');
    expect(gradeForScore(93)).toBe('A');
    expect(gradeForScore(83)).toBe('B');
    expect(gradeForScore(73)).toBe('C');
    expect(gradeForScore(63)).toBe('D');
    expect(gradeForScore(59)).toBe('F');
    expect(gradeForScore(0)).toBe('F');
  });
});

describe('Regression & Verification Delta (compare engine)', () => {
  const bugA = issue({ category: 'console', severity: 'critical', type: 'hydration-mismatch', message: 'hydration broke' });
  const bugB = issue({ category: 'layout', severity: 'major', type: 'horizontal-overflow', message: 'overflow 40px' });
  const bugC = issue({ category: 'seo', severity: 'minor', type: 'missing-canonical', message: 'no canonical' });

  it('separates fixed, new regressions and remaining findings with scoreDelta', () => {
    const delta = compareReports(reportWith([bugA, bugB]), reportWith([bugB, bugC]));
    expect(delta.counts).toEqual({ before: 2, after: 2, fixed: 1, newRegressions: 1, remaining: 1 });
    expect(delta.fixedFindings.map((i) => i.id)).toEqual([bugA.id]);
    expect(delta.newRegressions.map((i) => i.id)).toEqual([bugC.id]);
    expect(delta.remainingFindings.map((i) => i.id)).toEqual([bugB.id]);
    expect(delta.scoreDelta).toBe(delta.afterScore - delta.beforeScore);
    expect(delta.verified).toBe(false);
    expect(formatCompareReport(delta)).toContain('Regression & Verification Delta Report');
  });

  it('verifies only at >=95 with zero regressions and no blocking remainder', () => {
    const delta = compareReports(reportWith([bugA]), reportWith([]));
    expect(delta.scoreDelta).toBeGreaterThan(0);
    expect(delta.afterScore).toBe(100);
    expect(delta.verified).toBe(true);
  });
});

describe('MCP ghost_qa_compare tool + CLI parsing (v2)', () => {
  const bugA = issue({ category: 'console', severity: 'critical', type: 'hydration-mismatch', message: 'hydration broke' });

  it('answers ghost_qa_compare over JSON-RPC with a structured delta', async () => {
    const handlers: McpHandlers = {
      audit: async () => reportWith([]),
      doctor: async () => ({ ready: true, node: '22', nodeOk: true, chromiumPath: '/x', chromiumFound: true, smokeTest: 'ok' }),
    };
    const res = await handleJsonRpcRequest(
      {
        jsonrpc: '2.0',
        id: 42,
        method: 'tools/call',
        params: { name: 'ghost_qa_compare', arguments: { before: reportWith([bugA]), after: reportWith([]) } },
      },
      handlers,
    );
    const result = res?.result as { structuredContent: { scoreDelta: number; verified: boolean }; content: Array<{ text: string }> };
    expect(result.structuredContent.scoreDelta).toBeGreaterThan(0);
    expect(result.structuredContent.verified).toBe(true);
    expect(result.content[0]?.text).toContain('Delta Report');
  });

  it('rejects ghost_qa_compare without report objects', async () => {
    const res = await handleJsonRpcRequest(
      { jsonrpc: '2.0', id: 43, method: 'tools/call', params: { name: 'ghost_qa_compare', arguments: { before: {} } } },
      { audit: async () => reportWith([]), doctor: async () => ({ ready: true, node: '22', nodeOk: true, chromiumPath: '/x', chromiumFound: true, smokeTest: 'ok' }) },
    );
    const result = res?.result as { isError: boolean };
    expect(result.isError).toBe(true);
  });

  it('parses the new test flags and compare args', () => {
    const parsed = parseTestArgs(['http://localhost:3000', '--viewport', 'tablet', '--color-scheme', 'dark', '--screenshots', '--out-dir', 'out']);
    expect(parsed.options.viewports).toEqual(['tablet']);
    expect(parsed.options.colorSchemes).toEqual(['dark']);
    expect(parsed.options.screenshots).toBe(true);
    expect(parsed.outDir).toBe('out');
    expect(parseTestArgs(['http://localhost:3000']).options.viewports).toEqual(['desktop', 'tablet', 'mobile']);
    expect(parseCompareArgs(['before.json', 'after.json', '--json'])).toMatchObject({ beforeFile: 'before.json', afterFile: 'after.json', json: true });
    expect(() => parseCompareArgs(['only.json'])).toThrow(/compare/);
  });
});

describe('v2 reporters (health, dashboard, patch prompt)', () => {
  const bug = issue({ category: 'layout', severity: 'major', type: 'small-touch-target', message: 'tiny tap target', selector: '#buy', boundingBox: { x: 1, y: 2, width: 30, height: 30 } });

  it('HTML dashboard shows grade hero, 8-trap scorecard, matrix, filters and screenshots', () => {
    const report = reportWith([bug]);
    report.screenshots = [{ route: '/', viewport: 'mobile', colorScheme: 'dark', dataUri: 'data:image/jpeg;base64,AAAA' }];
    const html = formatHtmlReport(report);
    expect(html).toContain('Grade');
    expect(html).toContain('8-Trap Scorecard');
    expect(html).toContain('Route &amp; Viewport Matrix');
    expect(html).toContain('data-filter="severity"');
    expect(html).toContain('data:image/jpeg;base64,AAAA');
    expect(html).not.toMatch(/<script src=|<link rel="stylesheet" href=/);
  });

  it('PATCH-PROMPT carries selectors, bounding boxes and the compare loop', () => {
    const prompt = formatPatchPrompt(reportWith([bug]));
    expect(prompt).toContain('#buy');
    expect(prompt).toContain('ghost-qa compare before.json after.json');
    expect(prompt).toContain('95');
  });
});
