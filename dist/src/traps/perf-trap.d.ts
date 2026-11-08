import type { Page } from 'playwright';
import { type QAIssue, type ViewportName } from '../types.js';
export interface ResourceSize {
    url: string;
    transferBytes: number;
    /** Resource Timing initiatorType (img, script, link, fetch…). */
    kind?: string;
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
    /** Time to first byte (navigation responseStart). */
    ttfbMs: number;
    /** First Contentful Paint. */
    fcpMs: number;
    /** Largest Contentful Paint (observed, buffered). */
    lcpMs: number;
    /** Cumulative Layout Shift (layout-shift entries, buffered). */
    cls: number;
    /** Deepest DOM nesting level. */
    maxDomDepth: number;
}
export declare const EMPTY_PERF_METRICS: PerfMetrics;
export declare const PERF_THRESHOLDS: {
    readonly domContentLoadedMs: 3000;
    readonly loadMs: 5000;
    readonly singleResourceBytes: 1000000;
    readonly unoptimizedResourceBytes: 500000;
    readonly totalTransferBytes: 3000000;
    readonly renderBlockingCount: 5;
    readonly domNodeCount: 1500;
    readonly domDepth: 32;
    readonly longTaskCount: 5;
    readonly longTaskTotalMs: 500;
    readonly ttfbMs: 800;
    readonly fcpMs: 1800;
    readonly lcpMs: 2500;
    readonly cls: 0.1;
};
/**
 * Pure evaluator: Navigation/Resource Timing facts in, perf issues out.
 * Fully unit-testable without a browser.
 */
export declare function evaluatePerfMetrics(metrics: PerfMetrics, route: string, viewport: ViewportName): QAIssue[];
/** Runs the in-page perf probe against a live page and evaluates it. */
export declare class PerfTrap {
    private readonly viewport;
    constructor(viewport: ViewportName);
    collect(page: Page, route: string): Promise<QAIssue[]>;
}
//# sourceMappingURL=perf-trap.d.ts.map