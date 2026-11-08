/**
 * Shared contracts for ghost-qa.
 *
 * Every trap, crawler and reporter speaks in these types so a run can be
 * rendered for a human (terminal), serialised for CI (JSON), or fed back to a
 * coding agent (Markdown diagnostic) without any translation layer.
 */

export type ViewportName = 'desktop' | 'tablet' | 'mobile';

export type ColorScheme = 'light' | 'dark';

export type IssueCategory =
  | 'console'
  | 'network'
  | 'layout'
  | 'accessibility'
  | 'performance'
  | 'interaction'
  | 'navigation'
  | 'links'
  | 'seo'
  | 'theme';

/** The eight specialised traps of the v2 Deep Browser Inspection Engine. */
export type TrapName =
  | 'console'
  | 'network'
  | 'layout'
  | 'accessibility'
  | 'performance'
  | 'links'
  | 'seo'
  | 'theme';

export const TRAP_LABELS: Record<TrapName, string> = {
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
export const CATEGORY_TO_TRAP: Record<IssueCategory, TrapName> = {
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

export type IssueSeverity = 'critical' | 'major' | 'minor';

export type IssueType =
  | 'page-error'
  | 'unhandled-rejection'
  | 'hydration-mismatch'
  | 'console-error'
  | 'console-warning'
  | 'duplicate-key-warning'
  | 'csp-violation'
  | 'http-error'
  | 'request-failed'
  | 'request-timeout'
  | 'cors-error'
  | 'cors-preflight-failed'
  | 'broken-asset'
  | 'broken-image'
  | 'broken-svg'
  | 'horizontal-overflow'
  | 'zero-size-interactive'
  | 'element-collision'
  | 'small-touch-target'
  | 'clipped-text'
  | 'offscreen-interactive'
  | 'interaction-failed'
  | 'navigation-failed'
  | 'missing-accessible-name'
  | 'img-missing-alt'
  | 'input-missing-label'
  | 'missing-document-title'
  | 'missing-html-lang'
  | 'contrast-insufficient'
  | 'heading-hierarchy'
  | 'focus-not-visible'
  | 'slow-page-load'
  | 'slow-ttfb'
  | 'slow-fcp'
  | 'slow-lcp'
  | 'high-cls'
  | 'oversized-resource'
  | 'unoptimized-resource'
  | 'excessive-payload'
  | 'render-blocking-resources'
  | 'layout-thrashing'
  | 'excessive-dom-size'
  | 'deep-dom'
  | 'missing-viewport-meta'
  | 'dead-link'
  | 'placeholder-link'
  | 'form-button-missing-type'
  | 'stuck-disabled'
  | 'title-too-short'
  | 'title-too-long'
  | 'missing-meta-description'
  | 'missing-canonical'
  | 'missing-opengraph'
  | 'duplicate-id'
  | 'theme-contrast';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

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
  /** Exact DOM selector (`#id`, `[data-testid=…]`, or CSS path) when known. */
  selector?: string;
  /** Live bounding box of the offending element, when geometry is relevant. */
  boundingBox?: BoundingBox;
  /** Which emulated colour scheme the finding belongs to, when relevant. */
  colorScheme?: ColorScheme;
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

export interface ScreenshotRecord {
  route: string;
  viewport: ViewportName;
  colorScheme: ColorScheme;
  /** Data URI (`data:image/jpeg;base64,…`) so reports stay self-contained. */
  dataUri: string;
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
  /** Colour schemes to emulate (Theme Trap runs under each). */
  colorSchemes?: ColorScheme[];
  /** Capture a JPEG screenshot per route/viewport for the HTML dashboard. */
  screenshots?: boolean;
}

export const DEFAULT_OPTIONS: GhostQAOptions = {
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

export interface TrapScore {
  trap: TrapName;
  label: string;
  /** 0–100, deterministic from that trap's findings. */
  score: number;
  grade: string;
  issues: number;
  bySeverity: Record<IssueSeverity, number>;
}

export interface HealthScore {
  /** Overall QA Health Score, 0–100 (mean of the eight trap scores). */
  score: number;
  /** Letter grade A+ … F. */
  grade: string;
  byTrap: TrapScore[];
}

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
  /** QA Health Score (0–100, grade A+…F) with per-trap sub-scores. */
  health?: HealthScore;
  /** Screenshots captured when `options.screenshots` was enabled. */
  screenshots?: ScreenshotRecord[];
  summary: {
    routesCrawled: number;
    interactionsTested: number;
    interactionsSkipped: number;
    interactionsFailed: number;
    totalIssues: number;
    bySeverity: Record<IssueSeverity, number>;
    byCategory: Record<IssueCategory, number>;
    /** Present on v2 reports: mirrors `health.score` / `health.grade`. */
    healthScore?: number;
    grade?: string;
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
    [input.category, input.type, input.route, input.viewport, input.colorScheme ?? '', input.message, detailString].join('|'),
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
