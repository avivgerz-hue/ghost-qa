import type { Page } from 'playwright';
import { type InteractionAction, type QAIssue, type ViewportName } from '../types.js';
/**
 * True when an anchor points at a different route than the page under test.
 * The crawler already covers those routes with their own traps attached.
 */
export declare function isOtherRouteLink(href: string, currentRoute: string, currentUrl: string): boolean;
export declare function isDestructiveLabel(label: string): boolean;
/** Pure safety gate for a candidate interactive element. */
export declare function isSafeInteraction(input: {
    label: string;
    href?: string | null;
    type?: string | null;
    disabled?: boolean;
}): {
    safe: boolean;
    reason?: string;
};
export interface InteractionRunResult {
    actions: InteractionAction[];
    issues: QAIssue[];
    /** Hrefs visible after interactions (modals/menus may reveal new routes). */
    discoveredHrefs: string[];
}
/**
 * Safely exercises the interactive surface of one loaded page:
 * fills form fields with inert test data, clicks non-destructive buttons,
 * opens tabs and modals, then closes dialogs / navigates back so the page is
 * left roughly as it was found. Never submits destructive flows.
 */
export declare class InteractionRunner {
    private readonly maxInteractions;
    private readonly settleMs;
    constructor(maxInteractions?: number, settleMs?: number);
    run(page: Page, route: string, viewport: ViewportName): Promise<InteractionRunResult>;
    private fillField;
    private clickElement;
    /** Close any dialog we opened and return from accidental navigations. */
    private recover;
}
//# sourceMappingURL=interaction-runner.d.ts.map