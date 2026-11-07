import type { Page } from 'playwright';
import { makeIssue, type QAIssue, type ViewportName } from '../types.js';

export interface ResourceSize {
  url: string;
  transferBytes: number;
}

export interface PerfMetrics {
  domContentLoadedMs: number;
  loadMs: number;
  resourceCount: number;
  totalTransferBytes: number;
  oversizedResources: ResourceSize[];
  /** Scripts/stylesheets that block first paint (head, no async/defer/media tricks). */
  renderBlockingCount: number;
  domNodeCount: number;
  /** Long Tasks API (Chromium): tasks > 50ms that freeze the main thread. */
  longTaskCount: number;
  longTaskTotalMs: number;
}

export const EMPTY_PERF_METRICS: PerfMetrics = {
  domContentLoadedMs: 0,
  loadMs: 0,
  resourceCount: 0,
  totalTransferBytes: 0,
  oversizedResources: [],
  renderBlockingCount: 0,
  domNodeCount: 0,
  longTaskCount: 0,
  longTaskTotalMs: 0,
};

export const PERF_THRESHOLDS = {
  domContentLoadedMs: 3_000,
  loadMs: 5_000,
  singleResourceBytes: 1_000_000,
  totalTransferBytes: 3_000_000,
  renderBlockingCount: 5,
  domNodeCount: 1_500,
  longTaskCount: 5,
  longTaskTotalMs: 500,
} as const;

const kb = (bytes: number): string => `${Math.round(bytes / 1024)}KB`;
const ms = (value: number): string => `${Math.round(value)}ms`;

/**
 * Pure evaluator: Navigation/Resource Timing facts in, perf issues out.
 * Fully unit-testable without a browser.
 */
export function evaluatePerfMetrics(
  metrics: PerfMetrics,
  route: string,
  viewport: ViewportName,
): QAIssue[] {
  const issues: QAIssue[] = [];

  if (
    metrics.domContentLoadedMs > PERF_THRESHOLDS.domContentLoadedMs ||
    metrics.loadMs > PERF_THRESHOLDS.loadMs
  ) {
    const critical =
      metrics.domContentLoadedMs > PERF_THRESHOLDS.domContentLoadedMs * 2 ||
      metrics.loadMs > PERF_THRESHOLDS.loadMs * 2;
    issues.push(
      makeIssue({
        category: 'performance',
        severity: critical ? 'critical' : 'major',
        type: 'slow-page-load',
        message:
          `Slow page load on ${viewport}: DOMContentLoaded ${ms(metrics.domContentLoadedMs)}, full load ${ms(metrics.loadMs)} ` +
          `(budgets: ${ms(PERF_THRESHOLDS.domContentLoadedMs)} / ${ms(PERF_THRESHOLDS.loadMs)}). ` +
          'Profile render-blocking scripts, server response time and hydration cost before adding more UI.',
        route,
        viewport,
        details: {
          domContentLoadedMs: Math.round(metrics.domContentLoadedMs),
          loadMs: Math.round(metrics.loadMs),
        },
      }),
    );
  }

  for (const resource of metrics.oversizedResources.slice(0, 5)) {
    if (resource.transferBytes <= PERF_THRESHOLDS.singleResourceBytes) continue;
    issues.push(
      makeIssue({
        category: 'performance',
        severity: 'major',
        type: 'oversized-resource',
        message: `Oversized resource (${kb(resource.transferBytes)}): ${resource.url}. Compress, resize, lazy-load or code-split it — a single asset should stay under ${kb(PERF_THRESHOLDS.singleResourceBytes)}.`,
        route,
        viewport,
        url: resource.url,
        details: { transferBytes: resource.transferBytes },
      }),
    );
  }

  if (metrics.totalTransferBytes > PERF_THRESHOLDS.totalTransferBytes) {
    issues.push(
      makeIssue({
        category: 'performance',
        severity: 'major',
        type: 'excessive-payload',
        message: `Excessive page payload: ${kb(metrics.totalTransferBytes)} transferred across ${metrics.resourceCount} resources (budget ${kb(PERF_THRESHOLDS.totalTransferBytes)}). Audit bundles, images and fonts; defer anything below the fold.`,
        route,
        viewport,
        details: {
          totalTransferBytes: metrics.totalTransferBytes,
          resourceCount: metrics.resourceCount,
        },
      }),
    );
  }

  if (metrics.renderBlockingCount > PERF_THRESHOLDS.renderBlockingCount) {
    issues.push(
      makeIssue({
        category: 'performance',
        severity: 'minor',
        type: 'render-blocking-resources',
        message: `${metrics.renderBlockingCount} render-blocking scripts/stylesheets in <head> delay first paint. Add defer/async, inline critical CSS, or move non-critical tags to the end of <body>.`,
        route,
        viewport,
        details: { renderBlockingCount: metrics.renderBlockingCount },
      }),
    );
  }

  if (metrics.longTaskCount > PERF_THRESHOLDS.longTaskCount || metrics.longTaskTotalMs > PERF_THRESHOLDS.longTaskTotalMs) {
    issues.push(
      makeIssue({
        category: 'performance',
        severity: 'major',
        type: 'layout-thrashing',
        message:
          `Main-thread jank: ${metrics.longTaskCount} long tasks totalling ${ms(metrics.longTaskTotalMs)} (>50ms each) — a layout-thrashing / heavy-JS indicator. ` +
          'Break up synchronous work, memoise renders, and avoid forced synchronous layouts (reading offsetWidth in loops after DOM writes).',
        route,
        viewport,
        details: {
          longTaskCount: metrics.longTaskCount,
          longTaskTotalMs: Math.round(metrics.longTaskTotalMs),
        },
      }),
    );
  }

  if (metrics.domNodeCount > PERF_THRESHOLDS.domNodeCount) {
    issues.push(
      makeIssue({
        category: 'performance',
        severity: 'minor',
        type: 'excessive-dom-size',
        message: `Excessive DOM size: ${metrics.domNodeCount} nodes (budget ${PERF_THRESHOLDS.domNodeCount}). Deep/wide DOMs slow style recalculation, layout and hydration — virtualise long lists and prune wrapper divs.`,
        route,
        viewport,
        details: { domNodeCount: metrics.domNodeCount },
      }),
    );
  }

  return issues;
}

/** In-page probe: reads Navigation Timing + Resource Timing from the live page. */
async function probePerf(): Promise<PerfMetrics> {
  const nav = performance.getEntriesByType('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined;
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

  let totalTransferBytes = 0;
  const oversizedResources: ResourceSize[] = [];
  for (const resource of resources) {
    const bytes = resource.transferSize || resource.encodedBodySize || 0;
    totalTransferBytes += bytes;
    if (bytes > 250_000) {
      oversizedResources.push({ url: resource.name.slice(0, 200), transferBytes: bytes });
    }
  }
  oversizedResources.sort((a, b) => b.transferBytes - a.transferBytes);

  let renderBlockingCount = 0;
  document
    .querySelectorAll('head script[src]:not([async]):not([defer]), head link[rel="stylesheet"]')
    .forEach(() => {
      renderBlockingCount += 1;
    });

  let longTaskCount = 0;
  let longTaskTotalMs = 0;
  try {
    // PerformanceObserver with buffered entries — getEntriesByType('longtask')
    // logs a "Deprecated API" console warning in Chromium, which ghost-qa's
    // own Console Trap would then (correctly) flag on every page.
    const longTasks = await new Promise<PerformanceEntry[]>((resolvePromise) => {
      const collected: PerformanceEntry[] = [];
      try {
        const observer = new PerformanceObserver((list) => {
          collected.push(...list.getEntries());
        });
        observer.observe({ type: 'longtask', buffered: true });
        setTimeout(() => {
          observer.disconnect();
          resolvePromise(collected);
        }, 30);
      } catch {
        resolvePromise(collected);
      }
    });
    for (const entry of longTasks) {
      longTaskCount += 1;
      longTaskTotalMs += entry.duration;
    }
  } catch {
    /* Long Tasks API unsupported in this browser */
  }

  return {
    domContentLoadedMs: nav ? nav.domContentLoadedEventEnd : 0,
    loadMs: nav ? nav.loadEventEnd || nav.responseEnd : 0,
    resourceCount: resources.length,
    totalTransferBytes,
    oversizedResources: oversizedResources.slice(0, 10),
    renderBlockingCount,
    domNodeCount: document.querySelectorAll('*').length,
    longTaskCount,
    longTaskTotalMs,
  };
}

/** Runs the in-page perf probe against a live page and evaluates it. */
export class PerfTrap {
  private readonly viewport: ViewportName;

  constructor(viewport: ViewportName) {
    this.viewport = viewport;
  }

  async collect(page: Page, route: string): Promise<QAIssue[]> {
    let metrics: PerfMetrics;
    try {
      metrics = await page.evaluate(probePerf);
    } catch {
      return [];
    }
    return evaluatePerfMetrics(metrics, route, this.viewport);
  }
}
