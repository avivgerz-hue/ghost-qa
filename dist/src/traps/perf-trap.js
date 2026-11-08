import { makeIssue } from '../types.js';
export const EMPTY_PERF_METRICS = {
    domContentLoadedMs: 0,
    loadMs: 0,
    resourceCount: 0,
    totalTransferBytes: 0,
    oversizedResources: [],
    renderBlockingCount: 0,
    domNodeCount: 0,
    longTaskCount: 0,
    longTaskTotalMs: 0,
    ttfbMs: 0,
    fcpMs: 0,
    lcpMs: 0,
    cls: 0,
    maxDomDepth: 0,
};
export const PERF_THRESHOLDS = {
    domContentLoadedMs: 3_000,
    loadMs: 5_000,
    singleResourceBytes: 1_000_000,
    unoptimizedResourceBytes: 500_000,
    totalTransferBytes: 3_000_000,
    renderBlockingCount: 5,
    domNodeCount: 1_500,
    domDepth: 32,
    longTaskCount: 5,
    longTaskTotalMs: 500,
    ttfbMs: 800,
    fcpMs: 1_800,
    lcpMs: 2_500,
    cls: 0.1,
};
const kb = (bytes) => `${Math.round(bytes / 1024)}KB`;
const ms = (value) => `${Math.round(value)}ms`;
/**
 * Pure evaluator: Navigation/Resource Timing facts in, perf issues out.
 * Fully unit-testable without a browser.
 */
export function evaluatePerfMetrics(metrics, route, viewport) {
    const issues = [];
    if (metrics.domContentLoadedMs > PERF_THRESHOLDS.domContentLoadedMs ||
        metrics.loadMs > PERF_THRESHOLDS.loadMs) {
        const critical = metrics.domContentLoadedMs > PERF_THRESHOLDS.domContentLoadedMs * 2 ||
            metrics.loadMs > PERF_THRESHOLDS.loadMs * 2;
        issues.push(makeIssue({
            category: 'performance',
            severity: critical ? 'critical' : 'major',
            type: 'slow-page-load',
            message: `Slow page load on ${viewport}: DOMContentLoaded ${ms(metrics.domContentLoadedMs)}, full load ${ms(metrics.loadMs)} ` +
                `(budgets: ${ms(PERF_THRESHOLDS.domContentLoadedMs)} / ${ms(PERF_THRESHOLDS.loadMs)}). ` +
                'Profile render-blocking scripts, server response time and hydration cost before adding more UI.',
            route,
            viewport,
            details: {
                domContentLoadedMs: Math.round(metrics.domContentLoadedMs),
                loadMs: Math.round(metrics.loadMs),
            },
        }));
    }
    for (const resource of metrics.oversizedResources.slice(0, 5)) {
        if (resource.transferBytes > PERF_THRESHOLDS.singleResourceBytes) {
            issues.push(makeIssue({
                category: 'performance',
                severity: 'major',
                type: 'oversized-resource',
                message: `Oversized resource (${kb(resource.transferBytes)}): ${resource.url}. Compress, resize, lazy-load or code-split it — a single asset should stay under ${kb(PERF_THRESHOLDS.singleResourceBytes)}.`,
                route,
                viewport,
                url: resource.url,
                details: { transferBytes: resource.transferBytes },
            }));
        }
        else if (resource.transferBytes > PERF_THRESHOLDS.unoptimizedResourceBytes &&
            (resource.kind === 'img' || resource.kind === 'script' || resource.kind === 'link')) {
            issues.push(makeIssue({
                category: 'performance',
                severity: 'minor',
                type: 'unoptimized-resource',
                message: `Unoptimized payload (${kb(resource.transferBytes)}, ${resource.kind}): ${resource.url}. Images/scripts over ${kb(PERF_THRESHOLDS.unoptimizedResourceBytes)} should be compressed, resized to display size, modern-formatted (WebP/AVIF) or code-split.`,
                route,
                viewport,
                url: resource.url,
                details: { transferBytes: resource.transferBytes, kind: resource.kind },
            }));
        }
    }
    if (metrics.ttfbMs > PERF_THRESHOLDS.ttfbMs) {
        issues.push(makeIssue({
            category: 'performance',
            severity: metrics.ttfbMs > PERF_THRESHOLDS.ttfbMs * 2 ? 'major' : 'minor',
            type: 'slow-ttfb',
            message: `Slow time-to-first-byte: ${ms(metrics.ttfbMs)} (budget ${ms(PERF_THRESHOLDS.ttfbMs)}). Profile server rendering, middleware and database calls — no client optimisation can hide a slow first byte.`,
            route,
            viewport,
            details: { ttfbMs: Math.round(metrics.ttfbMs) },
        }));
    }
    if (metrics.fcpMs > PERF_THRESHOLDS.fcpMs) {
        issues.push(makeIssue({
            category: 'performance',
            severity: metrics.fcpMs > PERF_THRESHOLDS.fcpMs * 1.7 ? 'major' : 'minor',
            type: 'slow-fcp',
            message: `Slow First Contentful Paint: ${ms(metrics.fcpMs)} (budget ${ms(PERF_THRESHOLDS.fcpMs)}). Reduce render-blocking CSS/JS and inline critical styles.`,
            route,
            viewport,
            details: { fcpMs: Math.round(metrics.fcpMs) },
        }));
    }
    if (metrics.lcpMs > PERF_THRESHOLDS.lcpMs) {
        issues.push(makeIssue({
            category: 'performance',
            severity: metrics.lcpMs > 4_000 ? 'critical' : 'major',
            type: 'slow-lcp',
            message: `Slow Largest Contentful Paint: ${ms(metrics.lcpMs)} (budget ${ms(PERF_THRESHOLDS.lcpMs)}). Optimise the hero element: preload it, serve responsive image sizes, and remove render-blocking work ahead of it.`,
            route,
            viewport,
            details: { lcpMs: Math.round(metrics.lcpMs) },
        }));
    }
    if (metrics.cls > PERF_THRESHOLDS.cls) {
        issues.push(makeIssue({
            category: 'performance',
            severity: metrics.cls > 0.25 ? 'critical' : 'major',
            type: 'high-cls',
            message: `High Cumulative Layout Shift: ${metrics.cls.toFixed(3)} (budget ${PERF_THRESHOLDS.cls}). Reserve space for images/ads/embeds with width/height or aspect-ratio so content stops jumping while it loads.`,
            route,
            viewport,
            details: { cls: Math.round(metrics.cls * 1000) / 1000 },
        }));
    }
    if (metrics.maxDomDepth > PERF_THRESHOLDS.domDepth) {
        issues.push(makeIssue({
            category: 'performance',
            severity: 'minor',
            type: 'deep-dom',
            message: `Deeply nested DOM: ${metrics.maxDomDepth} levels (budget ${PERF_THRESHOLDS.domDepth}). Flatten wrapper-div pyramids — deep trees slow style recalculation, layout and hydration.`,
            route,
            viewport,
            details: { maxDomDepth: metrics.maxDomDepth },
        }));
    }
    if (metrics.totalTransferBytes > PERF_THRESHOLDS.totalTransferBytes) {
        issues.push(makeIssue({
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
        }));
    }
    if (metrics.renderBlockingCount > PERF_THRESHOLDS.renderBlockingCount) {
        issues.push(makeIssue({
            category: 'performance',
            severity: 'minor',
            type: 'render-blocking-resources',
            message: `${metrics.renderBlockingCount} render-blocking scripts/stylesheets in <head> delay first paint. Add defer/async, inline critical CSS, or move non-critical tags to the end of <body>.`,
            route,
            viewport,
            details: { renderBlockingCount: metrics.renderBlockingCount },
        }));
    }
    if (metrics.longTaskCount > PERF_THRESHOLDS.longTaskCount || metrics.longTaskTotalMs > PERF_THRESHOLDS.longTaskTotalMs) {
        issues.push(makeIssue({
            category: 'performance',
            severity: 'major',
            type: 'layout-thrashing',
            message: `Main-thread jank: ${metrics.longTaskCount} long tasks totalling ${ms(metrics.longTaskTotalMs)} (>50ms each) — a layout-thrashing / heavy-JS indicator. ` +
                'Break up synchronous work, memoise renders, and avoid forced synchronous layouts (reading offsetWidth in loops after DOM writes).',
            route,
            viewport,
            details: {
                longTaskCount: metrics.longTaskCount,
                longTaskTotalMs: Math.round(metrics.longTaskTotalMs),
            },
        }));
    }
    if (metrics.domNodeCount > PERF_THRESHOLDS.domNodeCount) {
        issues.push(makeIssue({
            category: 'performance',
            severity: 'minor',
            type: 'excessive-dom-size',
            message: `Excessive DOM size: ${metrics.domNodeCount} nodes (budget ${PERF_THRESHOLDS.domNodeCount}). Deep/wide DOMs slow style recalculation, layout and hydration — virtualise long lists and prune wrapper divs.`,
            route,
            viewport,
            details: { domNodeCount: metrics.domNodeCount },
        }));
    }
    return issues;
}
/** In-page probe: reads Navigation Timing + Resource Timing from the live page. */
async function probePerf() {
    const nav = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource');
    let totalTransferBytes = 0;
    const oversizedResources = [];
    for (const resource of resources) {
        const bytes = resource.transferSize || resource.encodedBodySize || 0;
        totalTransferBytes += bytes;
        if (bytes > 250_000) {
            oversizedResources.push({
                url: resource.name.slice(0, 200),
                transferBytes: bytes,
                kind: resource.initiatorType || 'other',
            });
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
        const longTasks = await new Promise((resolvePromise) => {
            const collected = [];
            try {
                const observer = new PerformanceObserver((list) => {
                    collected.push(...list.getEntries());
                });
                observer.observe({ type: 'longtask', buffered: true });
                setTimeout(() => {
                    observer.disconnect();
                    resolvePromise(collected);
                }, 30);
            }
            catch {
                resolvePromise(collected);
            }
        });
        for (const entry of longTasks) {
            longTaskCount += 1;
            longTaskTotalMs += entry.duration;
        }
    }
    catch {
        /* Long Tasks API unsupported in this browser */
    }
    // Core Web Vitals: paint timing is synchronous; LCP/CLS need buffered
    // PerformanceObserver entries (same pattern as longtask above).
    const paint = performance.getEntriesByType('paint');
    const fcp = paint.find((entry) => entry.name === 'first-contentful-paint');
    let lcpMs = 0;
    let cls = 0;
    try {
        const vitals = await new Promise((resolvePromise) => {
            let lcp = 0;
            let shift = 0;
            const observers = [];
            try {
                const lcpObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries())
                        lcp = Math.max(lcp, entry.startTime);
                });
                lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
                observers.push(lcpObserver);
                const clsObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        const shiftEntry = entry;
                        if (!shiftEntry.hadRecentInput)
                            shift += shiftEntry.value ?? 0;
                    }
                });
                clsObserver.observe({ type: 'layout-shift', buffered: true });
                observers.push(clsObserver);
                setTimeout(() => {
                    observers.forEach((o) => o.disconnect());
                    resolvePromise({ lcp, cls: shift });
                }, 30);
            }
            catch {
                resolvePromise({ lcp, cls: shift });
            }
        });
        lcpMs = vitals.lcp;
        cls = vitals.cls;
    }
    catch {
        /* Web Vitals APIs unsupported in this browser */
    }
    let maxDomDepth = 0;
    const walkDepth = (el, depth) => {
        if (depth > maxDomDepth)
            maxDomDepth = depth;
        if (depth > 64)
            return;
        for (const child of Array.from(el.children))
            walkDepth(child, depth + 1);
    };
    walkDepth(document.documentElement, 1);
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
        ttfbMs: nav ? nav.responseStart : 0,
        fcpMs: fcp ? fcp.startTime : 0,
        lcpMs,
        cls,
        maxDomDepth,
    };
}
/** Runs the in-page perf probe against a live page and evaluates it. */
export class PerfTrap {
    viewport;
    constructor(viewport) {
        this.viewport = viewport;
    }
    async collect(page, route) {
        let metrics;
        try {
            metrics = await page.evaluate(probePerf);
        }
        catch {
            return [];
        }
        return evaluatePerfMetrics(metrics, route, this.viewport);
    }
}
//# sourceMappingURL=perf-trap.js.map