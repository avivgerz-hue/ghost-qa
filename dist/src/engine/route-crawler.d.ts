import type { Page } from 'playwright';
/**
 * Normalises a URL for de-duplication: strips the hash and trailing slash,
 * keeps the query string (query-driven views are distinct routes).
 * Returns `null` for unparseable input.
 */
export declare function normalizeUrl(raw: string, base?: string): string | null;
export declare function isSameOrigin(candidate: string, origin: string): boolean;
/** True when an href points at a crawlable, same-origin application route. */
export declare function isCrawlableHref(href: string, origin: string): boolean;
export declare function pathOf(url: string): string;
export interface DiscoveredRoute {
    url: string;
    path: string;
    depth: number;
}
/**
 * Breadth-first route discovery. The `visit` callback loads a URL (with all
 * traps attached) and returns the raw hrefs found on it; the crawler owns the
 * queue, depth limit, route cap and de-duplication so traversal policy is
 * testable without a browser.
 */
export declare class RouteCrawler {
    private readonly maxDepth;
    private readonly maxRoutes;
    constructor(maxDepth?: number, maxRoutes?: number);
    crawl(startUrl: string, visit: (route: DiscoveredRoute) => Promise<string[]>): Promise<DiscoveredRoute[]>;
    /** Extracts every anchor href currently in the DOM of a loaded page. */
    static extractLinks(page: Page): Promise<string[]>;
}
//# sourceMappingURL=route-crawler.d.ts.map