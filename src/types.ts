/**
 * Shared contracts for ghost-qa.
 *
 * Every trap, crawler and reporter speaks in these types so a run can be
 * rendered for a human (terminal), serialised for CI (JSON), or fed back to a
 * coding agent (Markdown diagnostic) without any translation layer.
 */

export type ViewportName = 'desktop' | 'mobile';

export type IssueCategory = 'console' | 'network' | 'layout' | 'interaction' | 'navigation';

export type IssueSeverity = 'critical' | 'major' | 'minor';

export type IssueType =
  | 'page-error'
  | 'unhandled-rejection'
  | 'hydration-mismatch'
  | 'console-error'
  | 'console-warning'
  | 'http-error'
  | 'request-failed'
  | 'cors-error'
  | 'broken-asset'
  | 'horizontal-overflow'
  | 'zero-size-interactive'
  | 'broken-image'
  | 'missing-viewport-meta'
  | 'interaction-failed'
  | 'navigation-failed';

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

export const DEFAULT_OPTIONS: GhostQAOptions = {
  maxDepth: 2,
  maxRoutes: 25,
  maxInteractionsPerPage: 12,
  timeoutMs: 15_000,
  settleMs: 600,
  headless: true,
  viewports: ['desktop', 'mobile'],
  interactions: true,
  failOn: 'major',
};

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

export const SEVERITY_ORDER: Record<IssueSeverity, number> = {
  critical: 3,
  major: 2,
  minor: 1,
};

export function severityAtOrAbove(severity: IssueSeverity, threshold: IssueSeverity): boolean {
  return SEVERITY_ORDER[severity] >= SEVERITY_ORDER[threshold];
}

/** Small deterministic hash used for stable issue ids. */
export function fingerprint(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function makeIssue(
  input: Omit<QAIssue, 'id' | 'timestamp'> & { timestamp?: string },
): QAIssue {
  const detailString = input.details ? JSON.stringify(input.details) : '';
  const id = fingerprint(
    [input.category, input.type, input.route, input.viewport, input.message, detailString].join('|'),
  );
  return {
    ...input,
    id,
    timestamp: input.timestamp ?? new Date().toISOString(),
  };
}

/** De-duplicate identical findings (the same error often fires per viewport listener). */
export function dedupeIssues(issues: QAIssue[]): QAIssue[] {
  const seen = new Map<string, QAIssue>();
  for (const issue of issues) {
    if (!seen.has(issue.id)) seen.set(issue.id, issue);
  }
  return [...seen.values()];
}

export function summarise(
  routes: RouteRecord[],
  interactions: InteractionAction[],
  issues: QAIssue[],
  failOn: IssueSeverity,
): GhostQAReport['summary'] & { passed: boolean } {
  const bySeverity: Record<IssueSeverity, number> = { critical: 0, major: 0, minor: 0 };
  const byCategory: Record<IssueCategory, number> = {
    console: 0,
    network: 0,
    layout: 0,
    interaction: 0,
    navigation: 0,
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
