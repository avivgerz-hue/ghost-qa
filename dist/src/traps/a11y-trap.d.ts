import type { Page } from 'playwright';
import { type QAIssue, type ViewportName } from '../types.js';
export interface A11yMetrics {
    /** Buttons with no text content, aria-label, aria-labelledby or title. */
    buttonsWithoutName: string[];
    /** Links with no accessible name (icon-only links are the usual culprit). */
    linksWithoutName: string[];
    /** Images with no `alt` attribute at all (alt="" for decorative is fine). */
    imagesMissingAlt: string[];
    /** Form inputs with no <label>, aria-label or aria-labelledby. */
    inputsMissingLabel: string[];
    hasDocumentTitle: boolean;
    hasHtmlLang: boolean;
}
export declare const EMPTY_A11Y_METRICS: A11yMetrics;
/**
 * Pure evaluator: DOM accessibility facts in, structured issues out.
 * Fully unit-testable without a browser.
 */
export declare function evaluateA11yMetrics(metrics: A11yMetrics, route: string, viewport: ViewportName): QAIssue[];
/** Runs the in-page a11y probe against a live page and evaluates it. */
export declare class A11yTrap {
    private readonly viewport;
    constructor(viewport: ViewportName);
    collect(page: Page, route: string): Promise<QAIssue[]>;
}
//# sourceMappingURL=a11y-trap.d.ts.map