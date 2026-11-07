import { VIEWPORT_PROFILES } from '../engine/browser-session.js';
import { makeIssue } from '../types.js';
export const EMPTY_METRICS = {
    innerWidth: 0,
    scrollWidth: 0,
    hasViewportMeta: false,
    zeroSizeInteractives: [],
    brokenImages: [],
    overflowingElements: [],
};
/**
 * Pure evaluator: DOM geometry in, structured layout issues out.
 * This is the heart of the Layout Trap and is fully unit-testable.
 */
export function evaluateLayoutMetrics(metrics, route, viewport) {
    const issues = [];
    const tolerancePx = 1;
    if (metrics.innerWidth > 0 && metrics.scrollWidth > metrics.innerWidth + tolerancePx) {
        const overflowPx = metrics.scrollWidth - metrics.innerWidth;
        const offenders = metrics.overflowingElements
            .slice(0, 3)
            .map((el) => el.descriptor)
            .join(', ');
        issues.push(makeIssue({
            category: 'layout',
            severity: viewport === 'mobile' ? 'critical' : 'major',
            type: 'horizontal-overflow',
            message: `Horizontal overflow on ${viewport}: page scrolls sideways by ${overflowPx}px ` +
                `(scrollWidth ${metrics.scrollWidth} > viewport ${metrics.innerWidth}).` +
                (offenders ? ` Likely culprits: ${offenders}.` : '') +
                ' Common causes: 100vw widths, fixed-width children, negative margins, unshrunk flex/grid items.',
            route,
            viewport,
            details: {
                scrollWidth: metrics.scrollWidth,
                innerWidth: metrics.innerWidth,
                overflowPx,
            },
        }));
    }
    for (const descriptor of metrics.zeroSizeInteractives.slice(0, 5)) {
        issues.push(makeIssue({
            category: 'layout',
            severity: 'major',
            type: 'zero-size-interactive',
            message: `Interactive element has zero size and cannot be tapped/clicked: ${descriptor}. Check for display/width/height CSS collapsing it or content that never rendered.`,
            route,
            viewport,
            details: { element: descriptor },
        }));
    }
    for (const src of metrics.brokenImages.slice(0, 5)) {
        issues.push(makeIssue({
            category: 'layout',
            severity: 'major',
            type: 'broken-image',
            message: `Broken image (naturalWidth === 0): ${src}. Verify the asset path exists and is served with a 200.`,
            route,
            viewport,
            details: { src },
        }));
    }
    if (viewport === 'mobile' && !metrics.hasViewportMeta) {
        issues.push(makeIssue({
            category: 'layout',
            severity: 'major',
            type: 'missing-viewport-meta',
            message: 'Missing <meta name="viewport"> — mobile browsers will render at a desktop width and scale down. Add <meta name="viewport" content="width=device-width, initial-scale=1">.',
            route,
            viewport,
        }));
    }
    return issues;
}
/** In-page probe: measures live DOM geometry. Executed inside Chromium. */
function probeLayout() {
    const describe = (el) => {
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : '';
        const cls = typeof el.className === 'string' && el.className.trim()
            ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
            : '';
        const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
        return `${tag}${id}${cls}${text ? ` "${text}"` : ''}`;
    };
    const interactiveSelector = 'a[href], button, input, select, textarea, [role="button"], [role="tab"], [tabindex]';
    const zeroSizeInteractives = [];
    document.querySelectorAll(interactiveSelector).forEach((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const intentionallyHidden = style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
        if (!intentionallyHidden && (rect.width === 0 || rect.height === 0)) {
            zeroSizeInteractives.push(describe(el));
        }
    });
    const brokenImages = [];
    document.querySelectorAll('img').forEach((img) => {
        if (img.complete && img.naturalWidth === 0) {
            brokenImages.push(img.currentSrc || img.src || img.alt || '(image without src)');
        }
    });
    const overflowingElements = [];
    const innerWidth = window.innerWidth;
    document.querySelectorAll('body *').forEach((el) => {
        if (overflowingElements.length >= 10)
            return;
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.right > innerWidth + 1) {
            overflowingElements.push({
                descriptor: describe(el),
                right: Math.round(rect.right),
                width: Math.round(rect.width),
            });
        }
    });
    return {
        innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        hasViewportMeta: Boolean(document.querySelector('meta[name="viewport"]')),
        zeroSizeInteractives,
        brokenImages,
        overflowingElements,
    };
}
/** Runs the in-page probe against a live Playwright page and evaluates it. */
export class LayoutTrap {
    viewport;
    constructor(viewport) {
        this.viewport = viewport;
    }
    async collect(page, route) {
        let metrics;
        try {
            metrics = await page.evaluate(probeLayout);
        }
        catch {
            return [];
        }
        // Judge overflow against the intended profile width, not just the live
        // innerWidth: mobile emulation (and some headless builds) can let the
        // layout viewport grow with wide content, which would mask exactly the
        // overflow this trap exists to catch.
        const expectedWidth = VIEWPORT_PROFILES[this.viewport].width;
        if (metrics.innerWidth > expectedWidth) {
            metrics = { ...metrics, innerWidth: expectedWidth };
        }
        return evaluateLayoutMetrics(metrics, route, this.viewport);
    }
}
//# sourceMappingURL=layout-trap.js.map