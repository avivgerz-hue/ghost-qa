import type { Page } from 'playwright';
import { type QAIssue, type ViewportName } from '../types.js';
/**
 * Trap 7 — SEO, Metadata & Social Graph.
 *
 * What search engines and link unfurlers see, audited on the live DOM
 * (post-hydration, exactly as a crawler rendering the page would).
 */
export interface SeoMetrics {
    title: string;
    hasDescription: boolean;
    hasLang: boolean;
    hasViewportMeta: boolean;
    hasCanonical: boolean;
    ogTitle: boolean;
    ogDescription: boolean;
    ogImage: boolean;
    /** id attribute values used more than once. */
    duplicateIds: string[];
}
export declare const EMPTY_SEO_METRICS: SeoMetrics;
export declare const TITLE_MIN_LENGTH = 10;
export declare const TITLE_MAX_LENGTH = 60;
export declare function evaluateSeoMetrics(metrics: SeoMetrics, route: string, viewport: ViewportName): QAIssue[];
export declare class SeoTrap {
    private readonly viewport;
    constructor(viewport: ViewportName);
    collect(page: Page, route: string): Promise<QAIssue[]>;
}
//# sourceMappingURL=seo-trap.d.ts.map