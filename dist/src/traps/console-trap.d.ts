import type { Page } from 'playwright';
import { type QAIssue, type ViewportName } from '../types.js';
export type ConsoleClassification = 'hydration-mismatch' | 'unhandled-rejection' | 'page-error' | 'console-error' | 'console-warning' | 'benign';
export declare function isHydrationError(text: string): boolean;
export declare function isUnhandledRejection(text: string): boolean;
export declare function isBenignConsoleNoise(text: string): boolean;
/**
 * Pure classifier — maps a raw console/page-error string to a trap verdict.
 * Kept side-effect free so it is fully unit-testable without a browser.
 */
export declare function classifyConsoleText(text: string, source?: 'console-error' | 'console-warning' | 'pageerror'): ConsoleClassification;
export declare function consoleIssueFromText(text: string, route: string, viewport: ViewportName, source?: 'console-error' | 'console-warning' | 'pageerror', stack?: string): QAIssue | null;
/**
 * Attaches `pageerror` + `console` listeners to a Playwright page and
 * accumulates structured issues. One trap instance per page.
 */
export declare class ConsoleTrap {
    readonly issues: QAIssue[];
    private route;
    private readonly viewport;
    private detached;
    constructor(viewport: ViewportName);
    /** Tell the trap which route subsequent events belong to. */
    setRoute(route: string): void;
    attach(page: Page): void;
    detach(): void;
}
//# sourceMappingURL=console-trap.d.ts.map