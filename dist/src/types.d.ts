/**
 * Shared contracts for ghost-qa.
 *
 * Every trap, crawler and reporter speaks in these types so a run can be
 * rendered for a human (terminal), serialised for CI (JSON), or fed back to a
 * coding agent (Markdown diagnostic) without any translation layer.
 */
export type ViewportName = 'desktop' | 'mobile';
export type IssueCategory = 'console' | 'network' | 'layout' | 'accessibility' | 'performance' | 'interaction' | 'navigation';
export type IssueSeverity = 'critical' | 'major' | 'minor';
export type IssueType = 'page-error' | 'unhandled-rejection' | 'hydration-mismatch' | 'console-error' | 'console-warning' | 'http-error' | 'request-failed' | 'cors-error' | 'broken-asset' | 'horizontal-overflow' | 'zero-size-interactive' | 'broken-image' | 'missing-viewport-meta' | 'interaction-failed' | 'navigation-failed' | 'missing-accessible-name' | 'img-missing-alt' | 'input-missing-label' | 'missing-document-title' | 'missing-html-lang' | 'slow-page-load' | 'oversized-resource' | 'excessive-payload' | 'render-blocking-resources' | 'layout-thrashing' | 'excessive-dom-size';
export interface QAIssue {
    /** Stable, de-duplication-friendly identifier (hash of the fingerprint). */
    id: string;
    category: IssueCategory;
    severity: IssueSeverity;
    type: IssueType;
    /** Human / agent readable one-line description. */
    message: string;
    /** Path of the route the issue was observed on, e.g. `/pricing`. */
    route: string;
    viewport: ViewportName;
    /** Optional machine-readable context (status code, selector, geometry…). */
    details?: Record<string, string | number | boolean>;
    stack?: string;
    /** Fully-qualified URL related to the issue, when one exists. */
    url?: string;
    timestamp: string;
}
export interface InteractionAction {
    kind: 'click' | 'fill' | 'tab' | 'modal-open' | 'modal-close' | 'toggle';
    /** CSS-ish descriptor or visible label of the element exercised. */
    target: string;
    route: string;
    viewport: ViewportName;
    outcome: 'passed' | 'failed' | 'skipped';
    reason?: string;
}
export interface RouteRecord {
    url: string;
    path: string;
    depth: number;
    title: string;
    httpStatus?: number;
    viewports: ViewportName[];
    issueCount: number;
}
export interface GhostQAOptions {
    maxDepth: number;
    maxRoutes: number;
    maxInteractionsPerPage: number;
    timeoutMs: number;
    settleMs: number;
    headless: boolean;
    viewports: ViewportName[];
    interactions: boolean;
    /** Fail (exit 1) when an issue at or above this severity is found. */
    failOn: IssueSeverity;
}
export declare const DEFAULT_OPTIONS: GhostQAOptions;
export interface GhostQAReport {
    tool: 'ghost-qa';
    version: string;
    targetUrl: string;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    passed: boolean;
    options: GhostQAOptions;
    routes: RouteRecord[];
    interactions: InteractionAction[];
    issues: QAIssue[];
    summary: {
        routesCrawled: number;
        interactionsTested: number;
        interactionsSkipped: number;
        interactionsFailed: number;
        totalIssues: number;
        bySeverity: Record<IssueSeverity, number>;
        byCategory: Record<IssueCategory, number>;
    };
}
export declare const SEVERITY_ORDER: Record<IssueSeverity, number>;
export declare function severityAtOrAbove(severity: IssueSeverity, threshold: IssueSeverity): boolean;
/** Small deterministic hash used for stable issue ids. */
export declare function fingerprint(input: string): string;
export declare function makeIssue(input: Omit<QAIssue, 'id' | 'timestamp'> & {
    timestamp?: string;
}): QAIssue;
/** De-duplicate identical findings (the same error often fires per viewport listener). */
export declare function dedupeIssues(issues: QAIssue[]): QAIssue[];
export declare function summarise(routes: RouteRecord[], interactions: InteractionAction[], issues: QAIssue[], failOn: IssueSeverity): GhostQAReport['summary'] & {
    passed: boolean;
};
//# sourceMappingURL=types.d.ts.map