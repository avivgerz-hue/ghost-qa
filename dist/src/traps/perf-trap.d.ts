import type { Page } from 'playwright';
import { type QAIssue, type ViewportName } from '../types.js';
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
export declare const EMPTY_PERF_METRICS: PerfMetrics;
export declare const PERF_THRESHOLDS: {
    readonly domContentLoadedMs: 3000;
    readonly loadMs: 5000;
    readonly singleResourceBytes: 1000000;
    readonly totalTransferBytes: 3000000;
    readonly renderBlockingCount: 5;
    readonly domNodeCount: 1500;
    readonly longTaskCount: 5;
    readonly longTaskTotalMs: 500;
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