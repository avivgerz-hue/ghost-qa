import { describe, expect, it } from 'vitest';
import {
  classifyConsoleText,
  consoleIssueFromText,
  isBenignConsoleNoise,
  isHydrationError,
} from '../src/traps/console-trap.js';
import {
  evaluateLayoutMetrics,
  EMPTY_METRICS,
  type LayoutMetrics,
} from '../src/traps/layout-trap.js';
import {
  evaluateHttpResponse,
  evaluateRequestFailure,
  isAssetUrl,
  isCorsFailure,
} from '../src/traps/network-trap.js';
import { isCrawlableHref, isSameOrigin, normalizeUrl, pathOf, RouteCrawler } from '../src/engine/route-crawler.js';
import { isDestructiveLabel, isOtherRouteLink, isSafeInteraction } from '../src/engine/interaction-runner.js';
import { VIEWPORT_PROFILES } from '../src/engine/browser-session.js';
import { formatAgentDiagnostic, formatAgentDiagnosticJson, FIX_PLAYBOOK } from '../src/reporter/agent-diagnostic.js';
import { formatTerminalSummary } from '../src/reporter/terminal-summary.js';
import {
  dedupeIssues,
  makeIssue,
  summarise,
  type GhostQAReport,
  type QAIssue,
} from '../src/types.js';

const metrics = (overrides: Partial<LayoutMetrics> = {}): LayoutMetrics => ({
  ...EMPTY_METRICS,
  innerWidth: 390,
  scrollWidth: 390,
  hasViewportMeta: true,
  ...overrides,
});

function sampleReport(issues: QAIssue[]): GhostQAReport {
  const routes = [{ url: 'http://localhost:3000/', path: '/', depth: 0, title: 'Home', httpStatus: 200, viewports: ['desktop', 'mobile'] as const as GhostQAReport['routes'][number]['viewports'], issueCount: issues.length }];
  const summary = summarise(routes, [], issues, 'major');
  return {
    tool: 'ghost-qa',
    version: '1.0.0',
    targetUrl: 'http://localhost:3000/',
    startedAt: new Date(0).toISOString(),
    finishedAt: new Date(1000).toISOString(),
    durationMs: 1000,
    passed: summary.passed,
    options: {
      maxDepth: 2, maxRoutes: 25, maxInteractionsPerPage: 12, timeoutMs: 15000,
      settleMs: 600, headless: true, viewports: ['desktop', 'mobile'], interactions: true, failOn: 'major',
    },
    routes,
    interactions: [],
    issues,
    summary: {
      routesCrawled: summary.routesCrawled,
      interactionsTested: summary.interactionsTested,
      interactionsSkipped: summary.interactionsSkipped,
      interactionsFailed: summary.interactionsFailed,
      totalIssues: summary.totalIssues,
      bySeverity: summary.bySeverity,
      byCategory: summary.byCategory,
    },
  };
}

describe('ConsoleTrap classification', () => {
  it('detects React hydration mismatches as critical', () => {
    expect(isHydrationError('Warning: Text content did not match. Server: "a" Client: "b"')).toBe(true);
    expect(classifyConsoleText('Hydration failed because the initial UI does not match')).toBe('hydration-mismatch');
    const issue = consoleIssueFromText('A tree hydrated but some attributes of the server rendered HTML did not match', '/', 'desktop');
    expect(issue?.severity).toBe('critical');
    expect(issue?.type).toBe('hydration-mismatch');
  });

  it('classifies uncaught page errors as critical page-error', () => {
    const issue = consoleIssueFromText('Cannot read properties of undefined (reading "map")', '/dashboard', 'mobile', 'pageerror', 'Error: boom\n at App');
    expect(issue).toMatchObject({ severity: 'critical', type: 'page-error', route: '/dashboard', viewport: 'mobile' });
    expect(issue?.stack).toContain('at App');
  });

  it('classifies unhandled promise rejections as critical', () => {
    expect(classifyConsoleText('Unhandled Promise Rejection: NetworkError')).toBe('unhandled-rejection');
    expect(consoleIssueFromText('Uncaught (in promise) TypeError: Failed to fetch', '/', 'desktop')?.type).toBe('unhandled-rejection');
  });

  it('classifies console.error as major and warnings as minor', () => {
    expect(consoleIssueFromText('Failed to load resource', '/', 'desktop')?.severity).toBe('major');
    expect(consoleIssueFromText('Deprecated prop used', '/', 'desktop', 'console-warning')).toMatchObject({ severity: 'minor', type: 'console-warning' });
  });

  it('ignores benign dev-server noise', () => {
    expect(isBenignConsoleNoise('[vite] connecting...')).toBe(true);
    expect(consoleIssueFromText('Download the React DevTools for a better development experience', '/', 'desktop')).toBeNull();
    expect(consoleIssueFromText('[HMR] Waiting for update signal from WDS...', '/', 'desktop')).toBeNull();
    // Duplicates the Network Trap's precise issue for the same request.
    expect(consoleIssueFromText('Failed to load resource: the server responded with a status of 404 (Not Found)', '/', 'desktop')).toBeNull();
  });

  it('truncates very long messages and collapses whitespace', () => {
    const issue = consoleIssueFromText(`Error ${'x'.repeat(900)}\n\n  boom`, '/', 'desktop');
    expect(issue!.message.length).toBeLessThanOrEqual(530);
    expect(issue!.message).not.toContain('\n');
  });
});

describe('NetworkTrap evaluation', () => {
  it('passes healthy responses', () => {
    expect(evaluateHttpResponse(200, 'http://localhost:3000/api/users', '/', 'desktop', 'xhr')).toBeNull();
    expect(evaluateHttpResponse(302, 'http://localhost:3000/old', '/', 'desktop')).toBeNull();
    expect(evaluateHttpResponse(399, 'http://localhost:3000/x', '/', 'desktop')).toBeNull();
  });

  it('flags 5xx API crashes as critical http-error', () => {
    const issue = evaluateHttpResponse(500, 'http://localhost:3000/api/checkout', '/cart', 'desktop', 'xhr');
    expect(issue).toMatchObject({ severity: 'critical', type: 'http-error', route: '/cart' });
    expect(issue?.details).toMatchObject({ status: 500 });
  });

  it('flags 4xx assets as broken-asset and document 404s as http-error', () => {
    expect(evaluateHttpResponse(404, 'http://localhost:3000/assets/hero.png', '/', 'mobile', 'image')?.type).toBe('broken-asset');
    expect(evaluateHttpResponse(404, 'http://localhost:3000/missing-page', '/', 'mobile', 'document')?.type).toBe('http-error');
    expect(evaluateHttpResponse(403, 'http://localhost:3000/api/admin', '/', 'desktop', 'fetch')?.severity).toBe('major');
  });

  it('downgrades a missing favicon to minor', () => {
    const issue = evaluateHttpResponse(404, 'http://localhost:3000/favicon.ico', '/', 'desktop', 'image');
    expect(issue).toMatchObject({ severity: 'minor', type: 'broken-asset' });
  });

  it('detects CORS request failures as critical', () => {
    expect(isCorsFailure('Access to fetch blocked by CORS policy')).toBe(true);
    const issue = evaluateRequestFailure('net::ERR_FAILED — CORS', 'http://api.local/data', '/', 'desktop', 'fetch');
    expect(issue).toMatchObject({ severity: 'critical', type: 'cors-error' });
  });

  it('ignores aborted requests but flags real connection failures', () => {
    expect(evaluateRequestFailure('net::ERR_ABORTED', 'http://localhost:3000/api', '/', 'desktop')).toBeNull();
    expect(evaluateRequestFailure('net::ERR_CONNECTION_REFUSED', 'http://localhost:3000/api', '/', 'desktop')?.type).toBe('request-failed');
  });

  it('recognises asset URLs', () => {
    expect(isAssetUrl('http://x/app.js?v=1')).toBe(true);
    expect(isAssetUrl('http://x/logo.svg')).toBe(true);
    expect(isAssetUrl('http://x/api/users')).toBe(false);
  });
});

describe('LayoutTrap evaluation', () => {
  it('passes a clean mobile page', () => {
    expect(evaluateLayoutMetrics(metrics(), '/', 'mobile')).toEqual([]);
  });

  it('flags horizontal overflow as critical on mobile, major on desktop', () => {
    const bad = metrics({ scrollWidth: 520, overflowingElements: [{ descriptor: 'div.hero', right: 520, width: 400 }] });
    const mobile = evaluateLayoutMetrics(bad, '/', 'mobile');
    expect(mobile[0]).toMatchObject({ type: 'horizontal-overflow', severity: 'critical' });
    expect(mobile[0]?.message).toContain('130px');
    expect(mobile[0]?.message).toContain('div.hero');
    expect(evaluateLayoutMetrics({ ...bad, innerWidth: 1440, scrollWidth: 1600 }, '/', 'desktop')[0]?.severity).toBe('major');
  });

  it('tolerates 1px sub-pixel rounding but not real overflow', () => {
    expect(evaluateLayoutMetrics(metrics({ scrollWidth: 391 }), '/', 'mobile')).toEqual([]);
    expect(evaluateLayoutMetrics(metrics({ scrollWidth: 392 }), '/', 'mobile')).toHaveLength(1);
  });

  it('flags zero-size interactive elements', () => {
    const issues = evaluateLayoutMetrics(metrics({ zeroSizeInteractives: ['button#buy "Buy"'] }), '/shop', 'desktop');
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ type: 'zero-size-interactive', severity: 'major', route: '/shop' });
  });

  it('flags broken images and caps the number reported per route', () => {
    const broken = Array.from({ length: 9 }, (_, i) => `http://x/img-${i}.png`);
    const issues = evaluateLayoutMetrics(metrics({ brokenImages: broken }), '/', 'desktop');
    expect(issues.filter((i) => i.type === 'broken-image')).toHaveLength(5);
  });

  it('flags a missing viewport meta only on mobile', () => {
    expect(evaluateLayoutMetrics(metrics({ hasViewportMeta: false }), '/', 'mobile').map((i) => i.type)).toContain('missing-viewport-meta');
    expect(evaluateLayoutMetrics(metrics({ hasViewportMeta: false, innerWidth: 1440, scrollWidth: 1440 }), '/', 'desktop')).toEqual([]);
  });
});

describe('RouteCrawler helpers', () => {
  it('normalises URLs for de-duplication', () => {
    expect(normalizeUrl('http://localhost:3000/about/#team')).toBe('http://localhost:3000/about');
    expect(normalizeUrl('/pricing/', 'http://localhost:3000')).toBe('http://localhost:3000/pricing');
    expect(normalizeUrl('http://localhost:3000/')).toBe('http://localhost:3000/');
    expect(normalizeUrl(':::not a url')).toBeNull();
  });

  it('only crawls same-origin http(s) routes', () => {
    const origin = 'http://localhost:3000';
    expect(isCrawlableHref('/about', origin)).toBe(true);
    expect(isCrawlableHref('http://localhost:3000/blog?tag=qa', origin)).toBe(true);
    expect(isCrawlableHref('https://example.com/about', origin)).toBe(false);
    expect(isCrawlableHref('mailto:hi@example.com', origin)).toBe(false);
    expect(isCrawlableHref('#section', origin)).toBe(false);
    expect(isCrawlableHref('/logo.png', origin)).toBe(false);
    expect(isCrawlableHref('javascript:void(0)', origin)).toBe(false);
    expect(isSameOrigin('http://localhost:3000/a', origin)).toBe(true);
    expect(isSameOrigin('http://localhost:4000/a', origin)).toBe(false);
  });

  it('extracts paths with query strings', () => {
    expect(pathOf('http://localhost:3000/search?q=ghost')).toBe('/search?q=ghost');
    expect(pathOf('http://localhost:3000')).toBe('/');
  });

  it('crawls breadth-first, respects depth, cap and dedupe', async () => {
    const graph: Record<string, string[]> = {
      'http://localhost:3000/': ['/a', '/b', '/a', 'https://external.example/', '/img.png'],
      'http://localhost:3000/a': ['/deep'],
      'http://localhost:3000/b': [],
      'http://localhost:3000/deep': ['/deeper'],
    };
    const crawler = new RouteCrawler(1, 25);
    const routes = await crawler.crawl('http://localhost:3000/', async (route) => graph[route.url] ?? []);
    expect(routes.map((r) => r.path)).toEqual(['/', '/a', '/b']);
    expect(routes.find((r) => r.path === '/a')?.depth).toBe(1);

    const capped = await new RouteCrawler(5, 2).crawl('http://localhost:3000/', async (route) => graph[route.url] ?? []);
    expect(capped).toHaveLength(2);
  });
});

describe('InteractionRunner safety gate', () => {
  it('blocks destructive actions', () => {
    for (const label of ['Delete account', 'Remove item', 'Checkout', 'Pay now', 'Log out', 'Publish site', 'Place order']) {
      expect(isDestructiveLabel(label), label).toBe(true);
      expect(isSafeInteraction({ label }).safe).toBe(false);
    }
  });

  it('allows ordinary controls', () => {
    for (const label of ['Open menu', 'Next', 'Learn more', 'Toggle theme', 'Add to list', '']) {
      expect(isSafeInteraction({ label }).safe, label).toBe(true);
    }
  });

  it('leaves route links to the crawler', () => {
    expect(isOtherRouteLink('http://localhost:3000/about', '/', 'http://localhost:3000/')).toBe(true);
    expect(isOtherRouteLink('http://localhost:3000/#menu', '/', 'http://localhost:3000/')).toBe(false);
    expect(isOtherRouteLink('http://localhost:3000/about#team', '/about', 'http://localhost:3000/about')).toBe(false);
    expect(isOtherRouteLink('http://localhost:3000/search?q=x', '/search', 'http://localhost:3000/search')).toBe(true);
  });

  it('blocks disabled and file inputs, and non-localhost links', () => {
    expect(isSafeInteraction({ label: 'Upload', type: 'file' }).safe).toBe(false);
    expect(isSafeInteraction({ label: 'Save', disabled: true }).safe).toBe(false);
    expect(isSafeInteraction({ label: 'Docs', href: 'https://example.com/docs' }).safe).toBe(false);
    expect(isSafeInteraction({ label: 'About', href: 'http://localhost:3000/about' }).safe).toBe(true);
  });
});

describe('BrowserSession viewport profiles', () => {
  it('matches the spec: desktop 1440x900, mobile 390x844', () => {
    expect(VIEWPORT_PROFILES.desktop).toMatchObject({ width: 1440, height: 900 });
    expect(VIEWPORT_PROFILES.mobile).toMatchObject({ width: 390, height: 844, isMobile: true, hasTouch: true });
  });
});

describe('Reporters', () => {
  it('de-duplicates identical issues and keeps stable ids', () => {
    const a = consoleIssueFromText('Boom', '/', 'desktop')!;
    const b = consoleIssueFromText('Boom', '/', 'desktop')!;
    expect(a.id).toBe(b.id);
    expect(dedupeIssues([a, b])).toHaveLength(1);
    expect(dedupeIssues([a, consoleIssueFromText('Boom', '/', 'mobile')!])).toHaveLength(2);
  });

  it('summarise counts severity/category and applies the fail-on gate', () => {
    const minor = makeIssue({ category: 'layout', severity: 'minor', type: 'console-warning', message: 'w', route: '/', viewport: 'mobile' });
    expect(summarise([], [], [minor], 'major').passed).toBe(true);
    expect(summarise([], [], [minor], 'minor').passed).toBe(false);
    const critical = makeIssue({ category: 'console', severity: 'critical', type: 'page-error', message: 'x', route: '/', viewport: 'desktop' });
    const s = summarise([], [], [minor, critical], 'major');
    expect(s.bySeverity).toEqual({ critical: 1, major: 0, minor: 1 });
    expect(s.passed).toBe(false);
  });

  it('agent diagnostic leads with the verdict and groups bugs by route', () => {
    const issue = evaluateHttpResponse(500, 'http://localhost:3000/api/users', '/dashboard', 'desktop', 'xhr')!;
    const md = formatAgentDiagnostic(sampleReport([issue]));
    expect(md).toContain('❌ FAIL');
    expect(md).toContain('### /dashboard');
    expect(md).toContain(`#${issue.id}`);
    expect(md).toContain('## Fix playbook');
    expect(md).toContain(FIX_PLAYBOOK.network.slice(0, 40));
    expect(md).toContain('npx github:avivgerz-hue/ghost-qa test http://localhost:3000');
  });

  it('agent diagnostic passes cleanly with no issues', () => {
    const md = formatAgentDiagnostic(sampleReport([]));
    expect(md).toContain('✅ PASS');
    expect(md).toContain('You may report the task complete.');
  });

  it('JSON diagnostic round-trips the full report', () => {
    const report = sampleReport([]);
    const parsed = JSON.parse(formatAgentDiagnosticJson(report)) as GhostQAReport;
    expect(parsed.tool).toBe('ghost-qa');
    expect(parsed.targetUrl).toBe(report.targetUrl);
    expect(parsed.summary.routesCrawled).toBe(1);
  });

  it('terminal summary shows coverage, failures and verdict', () => {
    process.env.NO_COLOR = '1';
    const issue = consoleIssueFromText('Boom in render', '/', 'desktop')!;
    const failing = formatTerminalSummary(sampleReport([issue]));
    expect(failing).toContain('Routes crawled');
    expect(failing).toContain('GHOST-QA FAIL');
    expect(failing).toContain('Boom in render');
    expect(formatTerminalSummary(sampleReport([]))).toContain('GHOST-QA PASS');
  });
});
