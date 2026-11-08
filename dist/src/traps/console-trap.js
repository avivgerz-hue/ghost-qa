import { makeIssue } from '../types.js';
const DUPLICATE_KEY_PATTERNS = [
    /encountered two children with the same key/i,
    /duplicate key/i,
    /same key.*twice/i,
];
const CSP_PATTERNS = [
    /content security policy/i,
    /violates the following content security policy/i,
    /refused to .* because it violates/i,
    /CSP violation/i,
];
export function isDuplicateKeyWarning(text) {
    return DUPLICATE_KEY_PATTERNS.some((p) => p.test(text));
}
export function isCspViolation(text) {
    return CSP_PATTERNS.some((p) => p.test(text));
}
const HYDRATION_PATTERNS = [
    /hydration/i,
    /did not match/i,
    /server rendered (html|markup)/i,
    /text content does not match/i,
    /a tree hydrated but some attributes/i,
    /prop `[^`]+` did not match/i,
];
const REJECTION_PATTERNS = [
    /unhandled ?(promise ?)?rejection/i,
    /unhandledrejection/i,
    /promise rejection/i,
    /uncaught \(in promise\)/i,
];
/** Noise that ships in almost every dev server and tells the agent nothing. */
const BENIGN_PATTERNS = [
    /download the react devtools/i,
    /\[vite\]/i,
    /\[hmr\]/i,
    /hot module replacement/i,
    /favicon/i,
    /devtools/i,
    // Chromium's generic resource-load console line duplicates the Network
    // Trap's precise per-request issue (status + URL), so it adds only noise.
    /failed to load resource: the server responded with a status of/i,
];
export function isHydrationError(text) {
    return HYDRATION_PATTERNS.some((p) => p.test(text));
}
export function isUnhandledRejection(text) {
    return REJECTION_PATTERNS.some((p) => p.test(text));
}
export function isBenignConsoleNoise(text) {
    return BENIGN_PATTERNS.some((p) => p.test(text));
}
/**
 * Pure classifier — maps a raw console/page-error string to a trap verdict.
 * Kept side-effect free so it is fully unit-testable without a browser.
 */
export function classifyConsoleText(text, source = 'console-error') {
    if (isBenignConsoleNoise(text))
        return 'benign';
    if (isHydrationError(text))
        return 'hydration-mismatch';
    if (isUnhandledRejection(text))
        return 'unhandled-rejection';
    if (isDuplicateKeyWarning(text))
        return 'duplicate-key-warning';
    if (isCspViolation(text))
        return 'csp-violation';
    if (source === 'pageerror')
        return 'page-error';
    if (source === 'console-warning')
        return 'console-warning';
    return 'console-error';
}
export function consoleIssueFromText(text, route, viewport, source = 'console-error', stack) {
    const kind = classifyConsoleText(text, source);
    if (kind === 'benign')
        return null;
    const clean = text.replace(/\s+/g, ' ').trim().slice(0, 500);
    switch (kind) {
        case 'hydration-mismatch':
            return makeIssue({
                category: 'console',
                severity: 'critical',
                type: 'hydration-mismatch',
                message: `React hydration mismatch: ${clean}`,
                route,
                viewport,
                ...(stack ? { stack: stack.slice(0, 2000) } : {}),
            });
        case 'unhandled-rejection':
            return makeIssue({
                category: 'console',
                severity: 'critical',
                type: 'unhandled-rejection',
                message: `Unhandled promise rejection: ${clean}`,
                route,
                viewport,
                ...(stack ? { stack: stack.slice(0, 2000) } : {}),
            });
        case 'page-error':
            return makeIssue({
                category: 'console',
                severity: 'critical',
                type: 'page-error',
                message: `Uncaught page error: ${clean}`,
                route,
                viewport,
                ...(stack ? { stack: stack.slice(0, 2000) } : {}),
            });
        case 'duplicate-key-warning':
            return makeIssue({
                category: 'console',
                severity: 'major',
                type: 'duplicate-key-warning',
                message: `React duplicate key warning: ${clean} Duplicate keys break reconciliation — keyed children can swap state, replay animations, or drop updates. Use a stable unique id per item.`,
                route,
                viewport,
                ...(stack ? { stack: stack.slice(0, 2000) } : {}),
            });
        case 'csp-violation':
            return makeIssue({
                category: 'console',
                severity: 'major',
                type: 'csp-violation',
                message: `Content-Security-Policy violation: ${clean} A resource was blocked by CSP — allowlist the origin in the policy or self-host the asset; never silence this by removing the CSP header.`,
                route,
                viewport,
                ...(stack ? { stack: stack.slice(0, 2000) } : {}),
            });
        case 'console-warning':
            return makeIssue({
                category: 'console',
                severity: 'minor',
                type: 'console-warning',
                message: `Console warning: ${clean}`,
                route,
                viewport,
            });
        default:
            return makeIssue({
                category: 'console',
                severity: 'major',
                type: 'console-error',
                message: `Console error: ${clean}`,
                route,
                viewport,
                ...(stack ? { stack: stack.slice(0, 2000) } : {}),
            });
    }
}
/**
 * Attaches `pageerror` + `console` listeners to a Playwright page and
 * accumulates structured issues. One trap instance per page.
 */
export class ConsoleTrap {
    issues = [];
    route = '/';
    viewport;
    detached = false;
    constructor(viewport) {
        this.viewport = viewport;
    }
    /** Tell the trap which route subsequent events belong to. */
    setRoute(route) {
        this.route = route;
    }
    attach(page) {
        page.on('pageerror', (error) => {
            if (this.detached)
                return;
            const issue = consoleIssueFromText(error.message || String(error), this.route, this.viewport, 'pageerror', error.stack);
            if (issue)
                this.issues.push(issue);
        });
        page.on('console', (message) => {
            if (this.detached)
                return;
            const type = message.type();
            if (type !== 'error' && type !== 'warning')
                return;
            const text = message.text();
            const issue = consoleIssueFromText(text, this.route, this.viewport, type === 'error' ? 'console-error' : 'console-warning');
            if (issue)
                this.issues.push(issue);
        });
    }
    detach() {
        this.detached = true;
    }
}
//# sourceMappingURL=console-trap.js.map