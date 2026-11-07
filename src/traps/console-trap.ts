import type { Page } from 'playwright';
import { makeIssue, type QAIssue, type ViewportName } from '../types.js';

export type ConsoleClassification =
  | 'hydration-mismatch'
  | 'unhandled-rejection'
  | 'page-error'
  | 'console-error'
  | 'console-warning'
  | 'benign';

const HYDRATION_PATTERNS: RegExp[] = [
  /hydration/i,
  /did not match/i,
  /server rendered (html|markup)/i,
  /text content does not match/i,
  /a tree hydrated but some attributes/i,
  /prop `[^`]+` did not match/i,
];

const REJECTION_PATTERNS: RegExp[] = [
  /unhandled ?(promise ?)?rejection/i,
  /unhandledrejection/i,
  /promise rejection/i,
  /uncaught \(in promise\)/i,
];

/** Noise that ships in almost every dev server and tells the agent nothing. */
const BENIGN_PATTERNS: RegExp[] = [
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

export function isHydrationError(text: string): boolean {
  return HYDRATION_PATTERNS.some((p) => p.test(text));
}

export function isUnhandledRejection(text: string): boolean {
  return REJECTION_PATTERNS.some((p) => p.test(text));
}

export function isBenignConsoleNoise(text: string): boolean {
  return BENIGN_PATTERNS.some((p) => p.test(text));
}

/**
 * Pure classifier — maps a raw console/page-error string to a trap verdict.
 * Kept side-effect free so it is fully unit-testable without a browser.
 */
export function classifyConsoleText(
  text: string,
  source: 'console-error' | 'console-warning' | 'pageerror' = 'console-error',
): ConsoleClassification {
  if (isBenignConsoleNoise(text)) return 'benign';
  if (isHydrationError(text)) return 'hydration-mismatch';
  if (isUnhandledRejection(text)) return 'unhandled-rejection';
  if (source === 'pageerror') return 'page-error';
  if (source === 'console-warning') return 'console-warning';
  return 'console-error';
}

export function consoleIssueFromText(
  text: string,
  route: string,
  viewport: ViewportName,
  source: 'console-error' | 'console-warning' | 'pageerror' = 'console-error',
  stack?: string,
): QAIssue | null {
  const kind = classifyConsoleText(text, source);
  if (kind === 'benign') return null;

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
  readonly issues: QAIssue[] = [];
  private route = '/';
  private readonly viewport: ViewportName;
  private detached = false;

  constructor(viewport: ViewportName) {
    this.viewport = viewport;
  }

  /** Tell the trap which route subsequent events belong to. */
  setRoute(route: string): void {
    this.route = route;
  }

  attach(page: Page): void {
    page.on('pageerror', (error: Error) => {
      if (this.detached) return;
      const issue = consoleIssueFromText(
        error.message || String(error),
        this.route,
        this.viewport,
        'pageerror',
        error.stack,
      );
      if (issue) this.issues.push(issue);
    });

    page.on('console', (message) => {
      if (this.detached) return;
      const type = message.type();
      if (type !== 'error' && type !== 'warning') return;
      const text = message.text();
      const issue = consoleIssueFromText(
        text,
        this.route,
        this.viewport,
        type === 'error' ? 'console-error' : 'console-warning',
      );
      if (issue) this.issues.push(issue);
    });
  }

  detach(): void {
    this.detached = true;
  }
}
