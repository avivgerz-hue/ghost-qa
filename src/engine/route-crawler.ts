import type { Page } from 'playwright';

/** Extensions and protocols that are never crawlable application routes. */
const SKIP_EXTENSIONS = /\.(?:png|jpe?g|gif|svg|webp|avif|ico|css|js|mjs|map|json|xml|txt|pdf|zip|gz|woff2?|ttf|otf|mp4|webm|mp3|wav)$/i;
const SKIP_PREFIXES = ['mailto:', 'tel:', 'javascript:', 'data:', 'blob:', '#'];

/**
 * Normalises a URL for de-duplication: strips the hash and trailing slash,
 * keeps the query string (query-driven views are distinct routes).
 * Returns `null` for unparseable input.
 */
export function normalizeUrl(raw: string, base?: string): string | null {
  try {
    const url = base ? new URL(raw, base) : new URL(raw);
    url.hash = '';
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.replace(/\/+$/, '');
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function isSameOrigin(candidate: string, origin: string): boolean {
  try {
    return new URL(candidate).origin === new URL(origin).origin;
  } catch {
    return false;
  }
}

/** True when an href points at a crawlable, same-origin application route. */
export function isCrawlableHref(href: string, origin: string): boolean {
  if (!href) return false;
  const trimmed = href.trim();
  if (SKIP_PREFIXES.some((p) => trimmed.toLowerCase().startsWith(p))) return false;
  const normalized = normalizeUrl(trimmed, origin);
  if (!normalized) return false;
  if (!/^https?:$/.test(new URL(normalized).protocol)) return false;
  if (!isSameOrigin(normalized, origin)) return false;
  if (SKIP_EXTENSIONS.test(new URL(normalized).pathname)) return false;
  return true;
}

export function pathOf(url: string): string {
  try {
    const parsed = new URL(url);
    return (parsed.pathname || '/') + parsed.search;
  } catch {
    return url;
  }
}

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
export class RouteCrawler {
  private readonly maxDepth: number;
  private readonly maxRoutes: number;

  constructor(maxDepth = 2, maxRoutes = 25) {
    this.maxDepth = maxDepth;
    this.maxRoutes = maxRoutes;
  }

  async crawl(
    startUrl: string,
    visit: (route: DiscoveredRoute) => Promise<string[]>,
  ): Promise<DiscoveredRoute[]> {
    const start = normalizeUrl(startUrl);
    if (!start) throw new Error(`Invalid target URL: ${startUrl}`);
    const origin = new URL(start).origin;

    const visited = new Set<string>();
    const completed: DiscoveredRoute[] = [];
    const queue: DiscoveredRoute[] = [{ url: start, path: pathOf(start), depth: 0 }];

    while (queue.length > 0 && completed.length < this.maxRoutes) {
      const route = queue.shift()!;
      if (visited.has(route.url)) continue;
      visited.add(route.url);
      completed.push(route);

      const hrefs = await visit(route);
      if (route.depth >= this.maxDepth) continue;

      for (const href of hrefs) {
        if (!isCrawlableHref(href, origin)) continue;
        const normalized = normalizeUrl(href, origin)!;
        if (visited.has(normalized) || queue.some((q) => q.url === normalized)) continue;
        if (completed.length + queue.length >= this.maxRoutes) break;
        queue.push({ url: normalized, path: pathOf(normalized), depth: route.depth + 1 });
      }
    }
    return completed;
  }

  /** Extracts every anchor href currently in the DOM of a loaded page. */
  static async extractLinks(page: Page): Promise<string[]> {
    try {
      return await page.evaluate(() =>
        Array.from(document.querySelectorAll('a[href]')).map(
          (a) => (a as HTMLAnchorElement).href,
        ),
      );
    } catch {
      return [];
    }
  }
}
