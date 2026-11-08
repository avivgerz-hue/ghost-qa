import type { Page } from 'playwright';
import { type QAIssue, type ViewportName } from '../types.js';
export interface ContrastFailure {
    descriptor: string;
    selector: string;
    /** Computed foreground/background contrast ratio (WCAG formula). */
    ratio: number;
    /** Required ratio for this text size (4.5 normal, 3 large). */
    required: number;
}
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
    /** Text whose computed contrast is below WCAG 2.1 AA. */
    contrastFailures: ContrastFailure[];
    /** Human-readable heading-structure problems (missing h1, level skips). */
    headingProblems: string[];
    /** Tab-focus problems found by keyboard simulation (filled by collect()). */
    focusProblems: string[];
}
export declare const EMPTY_A11Y_METRICS: A11yMetrics;
/** WCAG relative luminance of an sRGB colour. */
export declare function relativeLuminance(r: number, g: number, b: number): number;
/** WCAG contrast ratio (1–21) between two sRGB colours. */
export declare function contrastRatio(fg: [number, number, number], bg: [number, number, number]): number;
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
    /**
     * Automated keyboard tab-order verification: press Tab repeatedly and
     * confirm focus actually moves and lands somewhere visibly styled.
     */
    private probeKeyboardFocus;
}
//# sourceMappingURL=a11y-trap.d.ts.map