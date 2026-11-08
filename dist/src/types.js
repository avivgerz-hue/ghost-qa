/**
 * Shared contracts for ghost-qa.
 *
 * Every trap, crawler and reporter speaks in these types so a run can be
 * rendered for a human (terminal), serialised for CI (JSON), or fed back to a
 * coding agent (Markdown diagnostic) without any translation layer.
 */
export const TRAP_LABELS = {
    console: 'Console & Framework Runtime',
    network: 'Network & Asset Integrity',
    layout: 'Layout, Responsive Geometry & Collision',
    accessibility: 'Accessibility (WCAG 2.1 AA) & Keyboard Focus',
    performance: 'Performance & Core Web Vitals',
    links: 'Safe Interactive & Link Integrity',
    seo: 'SEO, Metadata & Social Graph',
    theme: 'Dark / Light Theme Emulation',
};
/** Which trap owns a category (interaction/navigation fold into Links/UX). */
export const CATEGORY_TO_TRAP = {
    console: 'console',
    network: 'network',
    layout: 'layout',
    accessibility: 'accessibility',
    performance: 'performance',
    interaction: 'links',
    navigation: 'links',
    links: 'links',
    seo: 'seo',
    theme: 'theme',
};
export const DEFAULT_OPTIONS = {
    maxDepth: 2,
    maxRoutes: 25,
    maxInteractionsPerPage: 12,
    timeoutMs: 15_000,
    settleMs: 600,
    headless: true,
    viewports: ['desktop', 'tablet', 'mobile'],
    interactions: true,
    failOn: 'major',
    colorSchemes: ['light', 'dark'],
    screenshots: false,
};
export const SEVERITY_ORDER = {
    critical: 3,
    major: 2,
    minor: 1,
};
export function severityAtOrAbove(severity, threshold) {
    return SEVERITY_ORDER[severity] >= SEVERITY_ORDER[threshold];
}
/** Small deterministic hash used for stable issue ids. */
export function fingerprint(input) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}
export function makeIssue(input) {
    const detailString = input.details ? JSON.stringify(input.details) : '';
    const id = fingerprint([input.category, input.type, input.route, input.viewport, input.colorScheme ?? '', input.message, detailString].join('|'));
    return {
        ...input,
        id,
        timestamp: input.timestamp ?? new Date().toISOString(),
    };
}
/** De-duplicate identical findings (the same error often fires per viewport listener). */
export function dedupeIssues(issues) {
    const seen = new Map();
    for (const issue of issues) {
        if (!seen.has(issue.id))
            seen.set(issue.id, issue);
    }
    return [...seen.values()];
}
export function summarise(routes, interactions, issues, failOn) {
    const bySeverity = { critical: 0, major: 0, minor: 0 };
    const byCategory = {
        console: 0,
        network: 0,
        layout: 0,
        accessibility: 0,
        performance: 0,
        interaction: 0,
        navigation: 0,
        links: 0,
        seo: 0,
        theme: 0,
    };
    for (const issue of issues) {
        bySeverity[issue.severity] += 1;
        byCategory[issue.category] += 1;
    }
    return {
        routesCrawled: routes.length,
        interactionsTested: interactions.filter((a) => a.outcome === 'passed').length,
        interactionsSkipped: interactions.filter((a) => a.outcome === 'skipped').length,
        interactionsFailed: interactions.filter((a) => a.outcome === 'failed').length,
        totalIssues: issues.length,
        bySeverity,
        byCategory,
        passed: !issues.some((i) => severityAtOrAbove(i.severity, failOn)),
    };
}
//# sourceMappingURL=types.js.map