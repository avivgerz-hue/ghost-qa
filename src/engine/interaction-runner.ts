import type { Page } from 'playwright';
import { makeIssue, type InteractionAction, type QAIssue, type ViewportName } from '../types.js';

/**
 * Labels whose click could mutate real data, spend money, end a session or
 * leave the test environment. The runner never clicks these — ghost-qa tests
 * locally, but habits formed here should be safe anywhere.
 */
const DESTRUCTIVE_PATTERNS: RegExp[] = [
  /\b(delete|remove|destroy|erase|wipe|purge|drop)\b/i,
  /\b(checkout|pay(ment)?|purchase|buy now|place order|subscribe|donate)\b/i,
  /\b(log ?out|sign ?out|sign ?in|log ?in|register|sign ?up)\b/i,
  /\b(send|submit order|confirm order|publish|deploy|release)\b/i,
  /\b(unsubscribe|close account|deactivate)\b/i,
  /\b(github|google|apple|facebook|twitter|x\.com)\b.*\b(continue|login|sign)/i,
];

const EXTERNAL_HREF = /^https?:\/\//i;

/**
 * True when an anchor points at a different route than the page under test.
 * The crawler already covers those routes with their own traps attached.
 */
export function isOtherRouteLink(href: string, currentRoute: string, currentUrl: string): boolean {
  try {
    const target = new URL(href, currentUrl);
    const targetRoute = (target.pathname || '/') + target.search;
    const normalizedCurrent = currentRoute === '' ? '/' : currentRoute;
    return targetRoute !== normalizedCurrent;
  } catch {
    return false;
  }
}

export function isDestructiveLabel(label: string): boolean {
  return DESTRUCTIVE_PATTERNS.some((p) => p.test(label));
}

/** Pure safety gate for a candidate interactive element. */
export function isSafeInteraction(input: {
  label: string;
  href?: string | null;
  type?: string | null;
  disabled?: boolean;
}): { safe: boolean; reason?: string } {
  if (input.disabled) return { safe: false, reason: 'element is disabled' };
  const label = (input.label ?? '').trim();
  if (isDestructiveLabel(label)) {
    return { safe: false, reason: `destructive label blocked: "${label.slice(0, 60)}"` };
  }
  if (input.type === 'file') return { safe: false, reason: 'file inputs are never exercised' };
  if (input.href && EXTERNAL_HREF.test(input.href)) {
    try {
      // External navigations are exercised only by the crawler's origin check
      // upstream; the interaction runner stays on-page.
      const url = new URL(input.href);
      if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
        return { safe: false, reason: 'external link not exercised' };
      }
    } catch {
      return { safe: false, reason: 'unparseable href' };
    }
  }
  return { safe: true };
}

interface CandidateElement {
  index: number;
  descriptor: string;
  label: string;
  kind: InteractionAction['kind'];
  href: string | null;
  inputType: string | null;
  disabled: boolean;
}

function collectCandidates(): CandidateElement[] {
  const describe = (el: Element): string => {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const role = el.getAttribute('role');
    return `${tag}${id}${role ? `[role=${role}]` : ''}`;
  };
  const labelOf = (el: Element): string =>
    (
      el.getAttribute('aria-label') ||
      (el as HTMLElement).innerText ||
      el.getAttribute('value') ||
      el.getAttribute('placeholder') ||
      ''
    )
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);

  const results: CandidateElement[] = [];
  const seen = new Set<Element>();

  const push = (el: Element, kind: CandidateElement['kind']) => {
    if (seen.has(el) || results.length >= 60) return;
    seen.add(el);
    // Tag the live node so the runner can re-locate this exact element with
    // a Playwright locator, regardless of how the DOM re-renders afterwards.
    el.setAttribute('data-ghost-qa-target', String(results.length));
    const style = window.getComputedStyle(el as HTMLElement);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    results.push({
      index: results.length,
      descriptor: describe(el),
      label: labelOf(el),
      kind,
      href: el instanceof HTMLAnchorElement ? el.href : null,
      inputType: el instanceof HTMLInputElement ? el.type : null,
      disabled:
        (el as HTMLButtonElement).disabled === true || el.getAttribute('aria-disabled') === 'true',
    });
  };

  document
    .querySelectorAll('input:not([type="hidden"]), textarea, select')
    .forEach((el) => push(el, 'fill'));
  document
    .querySelectorAll('[role="tab"], [data-toggle="tab"], .tab')
    .forEach((el) => push(el, 'tab'));
  document
    .querySelectorAll('button, [role="button"], a[href], summary, [data-toggle="modal"]')
    .forEach((el) => push(el, el.tagName.toLowerCase() === 'a' ? 'click' : 'click'));
  return results;
}

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
export class InteractionRunner {
  private readonly maxInteractions: number;
  private readonly settleMs: number;

  constructor(maxInteractions = 12, settleMs = 300) {
    this.maxInteractions = maxInteractions;
    this.settleMs = settleMs;
  }

  async run(page: Page, route: string, viewport: ViewportName): Promise<InteractionRunResult> {
    const actions: InteractionAction[] = [];
    const issues: QAIssue[] = [];
    const startUrl = page.url();
    const attempted = new Set<string>();
    const candidateKey = (c: CandidateElement): string =>
      [c.kind, c.descriptor, c.label, c.href ?? '', c.inputType ?? ''].join('|');

    // Candidates are re-collected before every action: clicks can navigate,
    // re-render or open dialogs, which invalidates both element handles and
    // the data-ghost-qa-target tags from the previous snapshot.
    for (let step = 0; step < this.maxInteractions * 3; step++) {
      if (actions.filter((a) => a.outcome !== 'skipped').length >= this.maxInteractions) break;

      let candidates: CandidateElement[] = [];
      try {
        candidates = await page.evaluate(collectCandidates);
      } catch {
        break;
      }
      const candidate = candidates.find((c) => !attempted.has(candidateKey(c)));
      if (!candidate) break;
      attempted.add(candidateKey(candidate));

      const target = candidate.label
        ? `${candidate.descriptor} "${candidate.label}"`
        : candidate.descriptor;

      // Route links are the crawler's job — clicking them here would load a
      // different page under this route's traps and pollute its report.
      if (candidate.href && isOtherRouteLink(candidate.href, route, startUrl)) {
        actions.push({
          kind: candidate.kind,
          target,
          route,
          viewport,
          outcome: 'skipped',
          reason: 'route link covered by the crawler',
        });
        continue;
      }

      const safety = isSafeInteraction({
        label: candidate.label,
        href: candidate.href,
        type: candidate.inputType,
        disabled: candidate.disabled,
      });
      if (!safety.safe) {
        actions.push({
          kind: candidate.kind,
          target,
          route,
          viewport,
          outcome: 'skipped',
          ...(safety.reason ? { reason: safety.reason } : {}),
        });
        continue;
      }

      try {
        if (candidate.kind === 'fill') {
          await this.fillField(page, candidate);
        } else {
          await this.clickElement(page, candidate);
        }
        actions.push({ kind: candidate.kind, target, route, viewport, outcome: 'passed' });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        actions.push({
          kind: candidate.kind,
          target,
          route,
          viewport,
          outcome: 'failed',
          reason: message.slice(0, 200),
        });
        issues.push(
          makeIssue({
            category: 'interaction',
            severity: 'major',
            type: 'interaction-failed',
            message: `Interaction failed on ${target}: ${message.replace(/\s+/g, ' ').slice(0, 240)}`,
            route,
            viewport,
            details: { target },
          }),
        );
      }

      await page.waitForTimeout(this.settleMs).catch(() => undefined);
      await this.recover(page, startUrl);
    }

    let discoveredHrefs: string[] = [];
    try {
      discoveredHrefs = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a[href]')).map((a) => (a as HTMLAnchorElement).href),
      );
    } catch {
      /* page navigated away mid-run */
    }

    return { actions, issues, discoveredHrefs };
  }

  private async fillField(page: Page, candidate: CandidateElement): Promise<void> {
    const locator = page.locator(`[data-ghost-qa-target="${candidate.index}"]`).first();
    const tag = await locator.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');
    if (tag === 'select') {
      const value = await locator
        .evaluate((el) => {
          const select = el as HTMLSelectElement;
          const option = Array.from(select.options).find((o) => o.value);
          return option?.value ?? null;
        })
        .catch(() => null);
      if (value) await locator.selectOption(value, { timeout: 2000 });
      return;
    }
    const type = candidate.inputType ?? 'text';
    if (['checkbox', 'radio'].includes(type)) {
      await locator.click({ timeout: 2000 });
      return;
    }
    if (['password', 'file'].includes(type)) return;
    const sample =
      type === 'email'
        ? 'ghost-qa@example.com'
        : type === 'number'
          ? '42'
          : type === 'tel'
            ? '5550100'
            : type === 'url'
              ? 'https://example.com'
              : type === 'date'
                ? '2026-01-15'
                : 'ghost-qa test';
    await locator.fill(sample, { timeout: 2000 });
  }

  private async clickElement(page: Page, candidate: CandidateElement): Promise<void> {
    await page
      .locator(`[data-ghost-qa-target="${candidate.index}"]`)
      .first()
      .click({ timeout: 2500 });
  }

  /** Close any dialog we opened and return from accidental navigations. */
  private async recover(page: Page, startUrl: string): Promise<void> {
    await page.keyboard.press('Escape').catch(() => undefined);
    const closeButton = page
      .locator('[role="dialog"] button[aria-label*="close" i], [role="dialog"] .close, dialog button')
      .first();
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click({ timeout: 1000 }).catch(() => undefined);
    }
    if (page.url() !== startUrl) {
      await page.goBack({ timeout: 5000 }).catch(async () => {
        await page.goto(startUrl, { timeout: 5000 }).catch(() => undefined);
      });
    }
  }
}
