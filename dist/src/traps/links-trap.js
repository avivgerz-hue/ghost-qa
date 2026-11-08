import { makeIssue } from '../types.js';
export const EMPTY_LINK_METRICS = {
    placeholderLinks: [],
    deadAnchors: [],
    formButtonsMissingType: [],
    stuckDisabled: [],
};
const MAX_PER_KIND = 5;
export function isPlaceholderHref(href) {
    if (href === null)
        return true;
    const value = href.trim().toLowerCase();
    return value === '' || value === '#' || value.startsWith('javascript:');
}
export function evaluateLinkMetrics(metrics, route, viewport) {
    const issues = [];
    for (const link of metrics.placeholderLinks.slice(0, MAX_PER_KIND)) {
        issues.push(makeIssue({
            category: 'links',
            severity: 'major',
            type: 'placeholder-link',
            message: `Placeholder link that goes nowhere: ${link.descriptor} (href="${link.href}"). Point it at a real route or render a <button> for actions.`,
            route,
            viewport,
            details: { element: link.descriptor, href: link.href },
            selector: link.selector,
        }));
    }
    for (const link of metrics.deadAnchors.slice(0, MAX_PER_KIND)) {
        issues.push(makeIssue({
            category: 'links',
            severity: 'major',
            type: 'dead-link',
            message: `Dead anchor link: ${link.descriptor} points at ${link.href}, but no element with that id exists on the page. Fix the href or add the missing section id.`,
            route,
            viewport,
            details: { element: link.descriptor, href: link.href },
            selector: link.selector,
        }));
    }
    for (const button of metrics.formButtonsMissingType.slice(0, MAX_PER_KIND)) {
        issues.push(makeIssue({
            category: 'links',
            severity: 'minor',
            type: 'form-button-missing-type',
            message: `Button inside <form> has no type attribute: ${button.descriptor}. It defaults to type="submit" and will submit the form on click — set type="button" (or "submit" if that is truly intended).`,
            route,
            viewport,
            details: { element: button.descriptor },
            selector: button.selector,
        }));
    }
    for (const control of metrics.stuckDisabled.slice(0, MAX_PER_KIND)) {
        issues.push(makeIssue({
            category: 'links',
            severity: 'minor',
            type: 'stuck-disabled',
            message: `Interactive control is disabled with no obvious way to enable it: ${control.descriptor}. If it unlocks after input, make that discoverable; otherwise remove the disabled state.`,
            route,
            viewport,
            details: { element: control.descriptor },
            selector: control.selector,
        }));
    }
    return issues;
}
/** In-page probe: link & interactive-state facts from the live DOM. */
function probeLinks() {
    const describe = (el) => {
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : '';
        const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
        return `${tag}${id}${text ? ` "${text}"` : ''}`;
    };
    const cssPath = (el) => {
        if (el.id)
            return `#${el.id}`;
        const testid = el.getAttribute('data-testid');
        if (testid)
            return `[data-testid="${testid}"]`;
        const parts = [];
        let node = el;
        while (node && node !== document.body && parts.length < 4) {
            parts.unshift(node.tagName.toLowerCase());
            node = node.parentElement;
        }
        return parts.join(' > ');
    };
    const placeholderLinks = [];
    const deadAnchors = [];
    document.querySelectorAll('a').forEach((anchor) => {
        const href = anchor.getAttribute('href');
        if (href === null || href.trim() === '' || href.trim() === '#' || href.trim().toLowerCase().startsWith('javascript:')) {
            placeholderLinks.push({ descriptor: describe(anchor), selector: cssPath(anchor), href: href ?? '' });
        }
        else if (href.startsWith('#') && href.length > 1) {
            const targetId = href.slice(1);
            if (!document.getElementById(targetId)) {
                deadAnchors.push({ descriptor: describe(anchor), selector: cssPath(anchor), href });
            }
        }
    });
    const formButtonsMissingType = [];
    document.querySelectorAll('form button').forEach((button) => {
        if (!button.getAttribute('type')) {
            formButtonsMissingType.push({ descriptor: describe(button), selector: cssPath(button), href: '' });
        }
    });
    const stuckDisabled = [];
    document
        .querySelectorAll('button[disabled], input[disabled], select[disabled], textarea[disabled], [aria-disabled="true"]')
        .forEach((el) => {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden')
            return;
        stuckDisabled.push({ descriptor: describe(el), selector: cssPath(el), href: '' });
    });
    return { placeholderLinks, deadAnchors, formButtonsMissingType, stuckDisabled };
}
export class LinksTrap {
    viewport;
    constructor(viewport) {
        this.viewport = viewport;
    }
    async collect(page, route) {
        let metrics;
        try {
            metrics = await page.evaluate(probeLinks);
        }
        catch {
            return [];
        }
        return evaluateLinkMetrics(metrics, route, this.viewport);
    }
}
//# sourceMappingURL=links-trap.js.map