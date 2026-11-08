import type { Page } from 'playwright';
import { type QAIssue, type ViewportName } from '../types.js';
export declare function isAssetUrl(url: string): boolean;
export declare function isCorsFailure(errorText: string): boolean;
/**
 * Pure evaluator for an HTTP response. Returns an issue for status >= 400,
 * or `null` for healthy responses. Unit-testable without a browser.
 */
export declare function evaluateHttpResponse(status: number, url: string, route: string, viewport: ViewportName, resourceType?: string): QAIssue | null;
export declare function isTimeoutFailure(errorText: string): boolean;
/** Pure evaluator for a request that never completed (DNS, CORS, abort…). */
export declare function evaluateRequestFailure(errorText: string, url: string, route: string, viewport: ViewportName, resourceType?: string, extras?: {
    preflight?: boolean;
}): QAIssue | null;
export declare function shortUrl(url: string): string;
/** Attaches `response` + `requestfailed` listeners to a page. */
export declare class NetworkTrap {
    readonly issues: QAIssue[];
    private route;
    private readonly viewport;
    private detached;
    constructor(viewport: ViewportName);
    setRoute(route: string): void;
    attach(page: Page): void;
    detach(): void;
}
//# sourceMappingURL=network-trap.d.ts.map