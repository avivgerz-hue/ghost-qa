import { makeIssue } from '../types.js';
const ASSET_EXTENSIONS = /\.(?:js|mjs|css|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|map|json|wasm)(?:\?|$)/i;
export function isAssetUrl(url) {
    return ASSET_EXTENSIONS.test(url);
}
export function isCorsFailure(errorText) {
    return /cors|cross-origin|access-control|ERR_FAILED|net::ERR_BLOCKED_BY/i.test(errorText);
}
/**
 * Pure evaluator for an HTTP response. Returns an issue for status >= 400,
 * or `null` for healthy responses. Unit-testable without a browser.
 */
export function evaluateHttpResponse(status, url, route, viewport, resourceType = 'document') {
    if (status < 400)
        return null;
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
/** Pure evaluator for a request that never completed (DNS, CORS, abort…). */
export function evaluateRequestFailure(errorText, url, route, viewport, resourceType = 'xhr') {
    // Aborted requests are usually the crawler navigating away — not a bug.
    if (/ERR_ABORTED/i.test(errorText))
        return null;
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
export function shortUrl(url) {
    try {
        const parsed = new URL(url);
        const path = parsed.pathname + parsed.search;
        return path.length > 120 ? `${path.slice(0, 117)}…` : path || '/';
    }
    catch {
        return url.slice(0, 120);
    }
}
/** Attaches `response` + `requestfailed` listeners to a page. */
export class NetworkTrap {
    issues = [];
    route = '/';
    viewport;
    detached = false;
    constructor(viewport) {
        this.viewport = viewport;
    }
    setRoute(route) {
        this.route = route;
    }
    attach(page) {
        page.on('response', (response) => {
            if (this.detached)
                return;
            try {
                const request = response.request();
                const issue = evaluateHttpResponse(response.status(), response.url(), this.route, this.viewport, request.resourceType());
                if (issue)
                    this.issues.push(issue);
            }
            catch {
                /* response already disposed — nothing actionable */
            }
        });
        page.on('requestfailed', (request) => {
            if (this.detached)
                return;
            const failure = request.failure();
            const issue = evaluateRequestFailure(failure?.errorText ?? 'unknown network failure', request.url(), this.route, this.viewport, request.resourceType());
            if (issue)
                this.issues.push(issue);
        });
    }
    detach() {
        this.detached = true;
    }
}
//# sourceMappingURL=network-trap.js.map