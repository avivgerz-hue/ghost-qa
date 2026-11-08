import { makeIssue } from '../types.js';
export const EMPTY_A11Y_METRICS = {
    buttonsWithoutName: [],
    linksWithoutName: [],
    imagesMissingAlt: [],
    inputsMissingLabel: [],
    hasDocumentTitle: true,
    hasHtmlLang: true,
    contrastFailures: [],
    headingProblems: [],
    focusProblems: [],
};
/** WCAG relative luminance of an sRGB colour. */
export function relativeLuminance(r, g, b) {
    const linear = (channel) => {
        const s = channel / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}
/** WCAG contrast ratio (1–21) between two sRGB colours. */
export function contrastRatio(fg, bg) {
    const l1 = relativeLuminance(...fg);
    const l2 = relativeLuminance(...bg);
    const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
    return (hi + 0.05) / (lo + 0.05);
}
const MAX_PER_KIND = 5;
/**
 * Pure evaluator: DOM accessibility facts in, structured issues out.
 * Fully unit-testable without a browser.
 */
export function evaluateA11yMetrics(metrics, route, viewport) {
    const issues = [];
    for (const descriptor of metrics.buttonsWithoutName.slice(0, MAX_PER_KIND)) {
        issues.push(makeIssue({
            category: 'accessibility',
            severity: 'major',
            type: 'missing-accessible-name',
            message: `Button has no accessible name: ${descriptor}. Add visible text, aria-label, or aria-labelledby so screen readers and voice control can identify it.`,
            route,
            viewport,
            details: { element: descriptor },
        }));
    }
    for (const descriptor of metrics.linksWithoutName.slice(0, MAX_PER_KIND)) {
        issues.push(makeIssue({
            category: 'accessibility',
            severity: 'major',
            type: 'missing-accessible-name',
            message: `Link has no accessible name: ${descriptor}. Add text content or aria-label describing where the link goes.`,
            route,
            viewport,
            details: { element: descriptor },
        }));
    }
    for (const src of metrics.imagesMissingAlt.slice(0, MAX_PER_KIND)) {
        issues.push(makeIssue({
            category: 'accessibility',
            severity: 'major',
            type: 'img-missing-alt',
            message: `Image is missing an alt attribute: ${src}. Add descriptive alt text, or alt="" if the image is purely decorative.`,
            route,
            viewport,
            details: { src },
        }));
    }
    for (const descriptor of metrics.inputsMissingLabel.slice(0, MAX_PER_KIND)) {
        issues.push(makeIssue({
            category: 'accessibility',
            severity: 'major',
            type: 'input-missing-label',
            message: `Form input has no associated label: ${descriptor}. Connect a <label for="…">, wrap the input in a <label>, or add aria-label/aria-labelledby. A placeholder is not a label.`,
            route,
            viewport,
            details: { element: descriptor },
        }));
    }
    for (const failure of metrics.contrastFailures.slice(0, MAX_PER_KIND)) {
        issues.push(makeIssue({
            category: 'accessibility',
            severity: 'major',
            type: 'contrast-insufficient',
            message: `Insufficient text contrast (WCAG 2.1 AA): ${failure.descriptor} has ratio ${failure.ratio}:1, needs ${failure.required}:1. Darken the text or lighten the background (or vice versa) — do not rely on opacity tricks.`,
            route,
            viewport,
            details: { element: failure.descriptor, ratio: failure.ratio, required: failure.required },
            selector: failure.selector,
        }));
    }
    for (const problem of metrics.headingProblems.slice(0, MAX_PER_KIND)) {
        issues.push(makeIssue({
            category: 'accessibility',
            severity: 'minor',
            type: 'heading-hierarchy',
            message: `Heading hierarchy problem: ${problem}. Keep one <h1> per page and never skip levels (h1 → h2 → h3) — screen-reader users navigate by headings.`,
            route,
            viewport,
            details: { problem },
        }));
    }
    for (const problem of metrics.focusProblems.slice(0, MAX_PER_KIND)) {
        issues.push(makeIssue({
            category: 'accessibility',
            severity: 'major',
            type: 'focus-not-visible',
            message: `Keyboard focus problem: ${problem}. Every interactive element needs a visible :focus-visible style (outline or ring) — keyboard users must always know where focus is.`,
            route,
            viewport,
            details: { problem },
        }));
    }
    if (!metrics.hasDocumentTitle) {
        issues.push(makeIssue({
            category: 'accessibility',
            severity: 'major',
            type: 'missing-document-title',
            message: 'Document has no <title> (or it is empty). Screen readers announce it first, tabs and search results depend on it. Add a unique, descriptive title per route.',
            route,
            viewport,
        }));
    }
    if (!metrics.hasHtmlLang) {
        issues.push(makeIssue({
            category: 'accessibility',
            severity: 'minor',
            type: 'missing-html-lang',
            message: 'Missing lang attribute on <html>. Screen readers cannot pick the right pronunciation rules without it, e.g. <html lang="en">.',
            route,
            viewport,
        }));
    }
    return issues;
}
/** In-page probe: collects the accessibility facts from the live DOM. */
function probeA11y() {
    const describe = (el) => {
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : '';
        const cls = typeof el.className === 'string' && el.className.trim()
            ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
            : '';
        const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
        return `${tag}${id}${cls}${text ? ` "${text}"` : ''}`;
    };
    const accessibleName = (el) => {
        const labelledBy = el.getAttribute('aria-labelledby');
        if (labelledBy) {
            const text = labelledBy
                .split(/\s+/)
                .map((id) => document.getElementById(id)?.textContent ?? '')
                .join(' ')
                .trim();
            if (text)
                return text;
        }
        return (el.getAttribute('aria-label') ||
            el.getAttribute('title') ||
            el.innerText ||
            el.textContent ||
            '')
            .replace(/\s+/g, ' ')
            .trim();
    };
    const visible = (el) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
    };
    const buttonsWithoutName = [];
    document.querySelectorAll('button, [role="button"]').forEach((el) => {
        if (visible(el) && !accessibleName(el))
            buttonsWithoutName.push(describe(el));
    });
    const linksWithoutName = [];
    document.querySelectorAll('a[href]').forEach((el) => {
        if (visible(el) && !accessibleName(el))
            linksWithoutName.push(describe(el));
    });
    const imagesMissingAlt = [];
    document.querySelectorAll('img').forEach((img) => {
        if (!img.hasAttribute('alt')) {
            imagesMissingAlt.push(img.currentSrc || img.src || img.id || '(image without src)');
        }
    });
    const labelTargetIds = new Set(Array.from(document.querySelectorAll('label[for]')).map((l) => l.getAttribute('for')));
    const inputsMissingLabel = [];
    document
        .querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select')
        .forEach((el) => {
        if (!visible(el))
            return;
        const hasLabel = (el.id !== '' && labelTargetIds.has(el.id)) ||
            el.closest('label') !== null ||
            Boolean(el.getAttribute('aria-label')) ||
            Boolean(el.getAttribute('aria-labelledby'));
        if (!hasLabel)
            inputsMissingLabel.push(describe(el));
    });
    // Heading hierarchy: exactly one h1, no skipped levels.
    const headingProblems = [];
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    const h1Count = headings.filter((h) => h.tagName === 'H1').length;
    if (headings.length > 0 && h1Count === 0)
        headingProblems.push('page has headings but no <h1>');
    if (h1Count > 1)
        headingProblems.push(`page has ${h1Count} <h1> elements (expected exactly one)`);
    let previousLevel = 0;
    for (const heading of headings) {
        const level = Number(heading.tagName.slice(1));
        if (previousLevel > 0 && level > previousLevel + 1) {
            headingProblems.push(`level skip h${previousLevel} → h${level} at "${(heading.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)}"`);
        }
        previousLevel = level;
    }
    // Computed contrast: sample visible text-bearing elements and compute the
    // real WCAG ratio between computed foreground and effective background.
    const parseRgb = (value) => {
        const match = value.match(/rgba?\(([^)]+)\)/);
        if (!match)
            return null;
        const parts = match[1].split(',').map((p) => Number.parseFloat(p));
        if (parts.length < 3 || parts.some((n) => Number.isNaN(n)))
            return null;
        return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
    };
    const luminance = (rgb) => {
        const linear = (channel) => {
            const s = channel / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2]);
    };
    const effectiveBackground = (el) => {
        let node = el;
        while (node) {
            const bg = parseRgb(window.getComputedStyle(node).backgroundColor);
            if (bg && bg[3] > 0)
                return [bg[0], bg[1], bg[2]];
            node = node.parentElement;
        }
        return [255, 255, 255];
    };
    const contrastFailures = [];
    const textCandidates = Array.from(document.querySelectorAll('body *')).slice(0, 400);
    for (const el of textCandidates) {
        if (contrastFailures.length >= 8)
            break;
        const html = el;
        const ownText = Array.from(html.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0);
        if (!ownText || !visible(el))
            continue;
        const style = window.getComputedStyle(html);
        const fg = parseRgb(style.color);
        if (!fg)
            continue;
        const bg = effectiveBackground(el);
        const l1 = luminance([fg[0], fg[1], fg[2]]);
        const l2 = luminance(bg);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        const fontSize = Number.parseFloat(style.fontSize) || 16;
        const bold = Number.parseInt(style.fontWeight, 10) >= 700 || style.fontWeight === 'bold';
        const large = fontSize >= 24 || (fontSize >= 18.66 && bold);
        const required = large ? 3 : 4.5;
        if (ratio < required) {
            contrastFailures.push({
                descriptor: describe(el),
                selector: describe(el),
                ratio: Math.round(ratio * 100) / 100,
                required,
            });
        }
    }
    return {
        buttonsWithoutName,
        linksWithoutName,
        imagesMissingAlt,
        inputsMissingLabel,
        hasDocumentTitle: document.title.trim().length > 0,
        hasHtmlLang: (document.documentElement.getAttribute('lang') ?? '').trim().length > 0,
        contrastFailures,
        headingProblems,
        focusProblems: [],
    };
}
/** In-page probe: describes the currently focused element + focus styling. */
function probeFocusStep() {
    const el = document.activeElement;
    if (!el || el === document.body) {
        return { descriptor: '(no element focused)', hasVisibleFocus: false, isBody: true };
    }
    const style = window.getComputedStyle(el);
    const outlineVisible = style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0;
    const shadowVisible = style.boxShadow !== 'none' && style.boxShadow !== '';
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 30);
    return {
        descriptor: `${tag}${id}${text ? ` "${text}"` : ''}`,
        hasVisibleFocus: outlineVisible || shadowVisible,
        isBody: false,
    };
}
/** Runs the in-page a11y probe against a live page and evaluates it. */
export class A11yTrap {
    viewport;
    constructor(viewport) {
        this.viewport = viewport;
    }
    async collect(page, route) {
        let metrics;
        try {
            metrics = await page.evaluate(probeA11y);
        }
        catch {
            return [];
        }
        metrics.focusProblems = await this.probeKeyboardFocus(page);
        return evaluateA11yMetrics(metrics, route, this.viewport);
    }
    /**
     * Automated keyboard tab-order verification: press Tab repeatedly and
     * confirm focus actually moves and lands somewhere visibly styled.
     */
    async probeKeyboardFocus(page) {
        const problems = [];
        try {
            const focusableCount = await page.evaluate(() => document.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])').length);
            if (focusableCount === 0)
                return problems;
            let stuckTabs = 0;
            let invisibleFocus = 0;
            const steps = Math.min(12, focusableCount + 2);
            for (let i = 0; i < steps; i++) {
                await page.keyboard.press('Tab');
                const step = await page.evaluate(probeFocusStep);
                if (step.isBody) {
                    stuckTabs += 1;
                }
                else {
                    stuckTabs = 0;
                    if (!step.hasVisibleFocus)
                        invisibleFocus += 1;
                }
            }
            if (stuckTabs >= 3) {
                problems.push(`Tab key never moves focus onto any of the ${focusableCount} focusable elements (dead focus state — check tabindex and focus management).`);
            }
            else if (invisibleFocus >= 3) {
                problems.push(`${invisibleFocus} focused elements show no visible focus indicator (no outline or focus ring) during Tab navigation.`);
            }
        }
        catch {
            /* keyboard simulation unsupported on this page — skip silently */
        }
        return problems;
    }
}
//# sourceMappingURL=a11y-trap.js.map