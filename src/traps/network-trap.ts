import type { Page } from 'playwright';
import { makeIssue, type QAIssue, type ViewportName } from '../types.js';

const ASSET_EXTENSIONS = /\.(?:js|mjs|css|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|map|json|wasm)(?:\?|$)/i;

export function isAssetUrl(url: string): boolean {
  return ASSET_EXTENSIONS.test(url);
}

export function isCorsFailure(errorText: string): boolean {
  return /cors|cross-origin|access-control|ERR_FAILED|net::ERR_BLOCKED_BY/i.test(errorText);
}

/**
 * Pure evaluator for an HTTP response. Returns an issue for status >= 400,
 * or `null` for healthy responses. Unit-testable without a browser.
 */
export function evaluateHttpResponse(
  status: number,
  url: string,
  route: string,
  viewport: ViewportName,
  resourceType = 'document',
): QAIssue | null {
  if (status < 400) return null;

  const isFavicon = /favicon[^/]*$/i.test(url);
  if (isFavicon) {
    return makeIssue({
      category: 'network',
      severity: 'minor',
      type: 'broken-asset',
      message: `Missing favicon (HTTP ${status}): ${url}`,
      route,
      viewport,
      url,
      details: { status, resourceType },
    });
  }

  const asset = isAssetUrl(url) || ['script', 'stylesheet', 'image', 'font'].includes(resourceType);
  if (status >= 500) {
    return makeIssue({
      category: 'network',
      severity: 'critical',
      type: 'http-error',
      message: `Server error HTTP ${status} for ${shortUrl(url)} — backend/API is crashing on this route.`,
      route,
      viewport,
      url,
      details: { status, resourceType },
    });
  }
  return makeIssue({
    category: 'network',
    severity: asset ? 'major' : 'major',
    type: asset ? 'broken-asset' : 'http-error',
    message: asset
      ? `Broken asset HTTP ${status}: ${shortUrl(url)} (resource failed to load)`
      : `HTTP ${status} response for ${shortUrl(url)}`,
    route,
    viewport,
    url,
    details: { status, resourceType },
  });
}

export function isTimeoutFailure(errorText: string): boolean {
  return /ERR_TIMED_OUT|ERR_CONNECTION_TIMED_OUT|ERR_NETWORK_CHANGED|timeout/i.test(errorText);
}

/** Pure evaluator for a request that never completed (DNS, CORS, abort…). */
export function evaluateRequestFailure(
  errorText: string,
  url: string,
  route: string,
  viewport: ViewportName,
  resourceType = 'xhr',
  extras: { preflight?: boolean } = {},
): QAIssue | null {
  // Aborted requests are usually the crawler navigating away — not a bug.
  if (/ERR_ABORTED/i.test(errorText)) return null;

  if (extras.preflight || /preflight/i.test(errorText)) {
    return makeIssue({
      category: 'network',
      severity: 'critical',
      type: 'cors-preflight-failed',
      message: `CORS preflight failed: ${shortUrl(url)} (${errorText}). The API must answer OPTIONS with Access-Control-Allow-Origin/Methods/Headers for this origin.`,
      route,
      viewport,
      url,
      details: { errorText, resourceType },
    });
  }

  if (isTimeoutFailure(errorText)) {
    return makeIssue({
      category: 'network',
      severity: 'major',
      type: 'request-timeout',
      message: `Request timed out (${resourceType}): ${shortUrl(url)} — ${errorText}. Check server latency, hanging middleware, and client timeout/retry policy.`,
      route,
      viewport,
      url,
      details: { errorText, resourceType },
    });
  }

  if (isCorsFailure(errorText)) {
    return makeIssue({
      category: 'network',
      severity: 'critical',
      type: 'cors-error',
      message: `CORS / blocked request failed: ${shortUrl(url)} (${errorText}). Check API CORS headers and the fetch origin.`,
      route,
      viewport,
      url,
      details: { errorText, resourceType },
    });
  }
  return makeIssue({
    category: 'network',
    severity: isAssetUrl(url) ? 'major' : 'critical',
    type: 'request-failed',
    message: `Request failed (${resourceType}): ${shortUrl(url)} — ${errorText}`,
    route,
    viewport,
    url,
    details: { errorText, resourceType },
  });
}

export function shortUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname + parsed.search;
    return path.length > 120 ? `${path.slice(0, 117)}…` : path || '/';
  } catch {
    return url.slice(0, 120);
  }
}

/** Attaches `response` + `requestfailed` listeners to a page. */
export class NetworkTrap {
  readonly issues: QAIssue[] = [];
  private route = '/';
  private readonly viewport: ViewportName;
  private detached = false;

  constructor(viewport: ViewportName) {
    this.viewport = viewport;
  }

  setRoute(route: string): void {
    this.route = route;
  }

  attach(page: Page): void {
    page.on('response', (response) => {
      if (this.detached) return;
      try {
        const request = response.request();
        const issue = evaluateHttpResponse(
          response.status(),
          response.url(),
          this.route,
          this.viewport,
          request.resourceType(),
        );
        if (issue) this.issues.push(issue);
      } catch {
        /* response already disposed — nothing actionable */
      }
    });

    page.on('requestfailed', (request) => {
      if (this.detached) return;
      const failure = request.failure();
      const issue = evaluateRequestFailure(
        failure?.errorText ?? 'unknown network failure',
        request.url(),
        this.route,
        this.viewport,
        request.resourceType(),
        { preflight: request.method() === 'OPTIONS' },
      );
      if (issue) this.issues.push(issue);
    });
  }

  detach(): void {
    this.detached = true;
  }
}
