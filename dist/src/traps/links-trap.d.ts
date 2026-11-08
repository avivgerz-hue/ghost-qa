import type { Page } from 'playwright';
import { type QAIssue, type ViewportName } from '../types.js';
/**
 * Trap 6 — Safe Interactive & Link Integrity.
 *
 * Purely observational (it never clicks anything): audits anchors for
 * placeholder/dead hrefs, buttons inside <form> without an explicit type
 * (they silently become submit buttons), and disabled controls that can
 * never be re-enabled by the user in the current UI state.
 */
export interface LinkFinding {
    descriptor: string;
    selector: string;
    href: string;
}
export interface LinkMetrics {
    /** Anchors pointing at "", "#", "javascript:void(0)" etc. */
    placeholderLinks: LinkFinding[];
    /** Anchor links (#foo) whose target id does not exist in the DOM. */
    deadAnchors: LinkFinding[];
    /** <button> without type inside a <form> (implicit type="submit"). */
    formButtonsMissingType: LinkFinding[];
    /** Visible disabled buttons/inputs that present as stuck. */
    stuckDisabled: LinkFinding[];
}
export declare const EMPTY_LINK_METRICS: LinkMetrics;
export declare function isPlaceholderHref(href: string | null): boolean;
export declare function evaluateLinkMetrics(metrics: LinkMetrics, route: string, viewport: ViewportName): QAIssue[];
export declare class LinksTrap {
    private readonly viewport;
    constructor(viewport: ViewportName);
    collect(page: Page, route: string): Promise<QAIssue[]>;
}
//# sourceMappingURL=links-trap.d.ts.map