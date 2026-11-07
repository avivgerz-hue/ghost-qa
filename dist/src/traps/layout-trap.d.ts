import type { Page } from 'playwright';
import { type QAIssue, type ViewportName } from '../types.js';
export interface OffendingElement {
    descriptor: string;
    right: number;
    width: number;
}
export interface LayoutMetrics {
    innerWidth: number;
    scrollWidth: number;
    hasViewportMeta: boolean;
    /** Interactive elements rendered at 0×0 (or effectively invisible). */
    zeroSizeInteractives: string[];
    /** Images that finished loading but decoded to nothing. */
    brokenImages: string[];
    /** Elements extending past the right edge of the viewport. */
    overflowingElements: OffendingElement[];
}
export declare const EMPTY_METRICS: LayoutMetrics;
/**
 * Pure evaluator: DOM geometry in, structured layout issues out.
 * This is the heart of the Layout Trap and is fully unit-testable.
 */
export declare function evaluateLayoutMetrics(metrics: LayoutMetrics, route: string, viewport: ViewportName): QAIssue[];
/** Runs the in-page probe against a live Playwright page and evaluates it. */
export declare class LayoutTrap {
    private readonly viewport;
    constructor(viewport: ViewportName);
    collect(page: Page, route: string): Promise<QAIssue[]>;
}
//# sourceMappingURL=layout-trap.d.ts.map