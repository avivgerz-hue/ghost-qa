import type { Page } from 'playwright';
import { makeIssue, type QAIssue, type ViewportName } from '../types.js';

export interface A11yMetrics {
  /** Buttons with no text content, aria-label, aria-labelledby or title. */
  buttonsWithoutName: string[];
  /** Links with no accessible name (icon-only links are the usual culprit). */
  linksWithoutName: string[];
  /** Images with no `alt` attribute at all (alt="" for decorative is fine). */
  imagesMissingAlt: string[];
  /** Form inputs with no <label>, aria-label or aria-labelledby. */
  inputsMissingLabel: string[];
  hasDocumentTitle: boolean;
  hasHtmlLang: boolean;
}

export const EMPTY_A11Y_METRICS: A11yMetrics = {
  buttonsWithoutName: [],
  linksWithoutName: [],
  imagesMissingAlt: [],
  inputsMissingLabel: [],
  hasDocumentTitle: true,
  hasHtmlLang: true,
};

const MAX_PER_KIND = 5;

/**
 * Pure evaluator: DOM accessibility facts in, structured issues out.
 * Fully unit-testable without a browser.
 */
export function evaluateA11yMetrics(
  metrics: A11yMetrics,
  route: string,
  viewport: ViewportName,
): QAIssue[] {
  const issues: QAIssue[] = [];

  for (const descriptor of metrics.buttonsWithoutName.slice(0, MAX_PER_KIND)) {
    issues.push(
      makeIssue({
        category: 'accessibility',
        severity: 'major',
        type: 'missing-accessible-name',
        message: `Button has no accessible name: ${descriptor}. Add visible text, aria-label, or aria-labelledby so screen readers and voice control can identify it.`,
        route,
        viewport,
        details: { element: descriptor },
      }),
    );
  }

  for (const descriptor of metrics.linksWithoutName.slice(0, MAX_PER_KIND)) {
    issues.push(
      makeIssue({
        category: 'accessibility',
        severity: 'major',
        type: 'missing-accessible-name',
        message: `Link has no accessible name: ${descriptor}. Add text content or aria-label describing where the link goes.`,
        route,
        viewport,
        details: { element: descriptor },
      }),
    );
  }

  for (const src of metrics.imagesMissingAlt.slice(0, MAX_PER_KIND)) {
    issues.push(
      makeIssue({
        category: 'accessibility',
        severity: 'major',
        type: 'img-missing-alt',
        message: `Image is missing an alt attribute: ${src}. Add descriptive alt text, or alt="" if the image is purely decorative.`,
        route,
        viewport,
        details: { src },
      }),
    );
  }

  for (const descriptor of metrics.inputsMissingLabel.slice(0, MAX_PER_KIND)) {
    issues.push(
      makeIssue({
        category: 'accessibility',
        severity: 'major',
        type: 'input-missing-label',
        message: `Form input has no associated label: ${descriptor}. Connect a <label for="…">, wrap the input in a <label>, or add aria-label/aria-labelledby. A placeholder is not a label.`,
        route,
        viewport,
        details: { element: descriptor },
      }),
    );
  }

  if (!metrics.hasDocumentTitle) {
    issues.push(
      makeIssue({
        category: 'accessibility',
        severity: 'major',
        type: 'missing-document-title',
        message:
          'Document has no <title> (or it is empty). Screen readers announce it first, tabs and search results depend on it. Add a unique, descriptive title per route.',
        route,
        viewport,
      }),
    );
  }

  if (!metrics.hasHtmlLang) {
    issues.push(
      makeIssue({
        category: 'accessibility',
        severity: 'minor',
        type: 'missing-html-lang',
        message:
          'Missing lang attribute on <html>. Screen readers cannot pick the right pronunciation rules without it, e.g. <html lang="en">.',
        route,
        viewport,
      }),
    );
  }

  return issues;
}

/** In-page probe: collects the accessibility facts from the live DOM. */
function probeA11y(): A11yMetrics {
  const describe = (el: Element): string => {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const cls =
      typeof el.className === 'string' && el.className.trim()
        ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
        : '';
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return `${tag}${id}${cls}${text ? ` "${text}"` : ''}`;
  };

  const accessibleName = (el: Element): string => {
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ')
        .trim();
      if (text) return text;
    }
    return (
      el.getAttribute('aria-label') ||
      el.getAttribute('title') ||
      (el as HTMLElement).innerText ||
      el.textContent ||
      ''
    )
      .replace(/\s+/g, ' ')
      .trim();
  };

  const visible = (el: Element): boolean => {
    const style = window.getComputedStyle(el as HTMLElement);
    return style.display !== 'none' && style.visibility !== 'hidden';
  };

  const buttonsWithoutName: string[] = [];
  document.querySelectorAll('button, [role="button"]').forEach((el) => {
    if (visible(el) && !accessibleName(el)) buttonsWithoutName.push(describe(el));
  });

  const linksWithoutName: string[] = [];
  document.querySelectorAll('a[href]').forEach((el) => {
    if (visible(el) && !accessibleName(el)) linksWithoutName.push(describe(el));
  });

  const imagesMissingAlt: string[] = [];
  document.querySelectorAll('img').forEach((img) => {
    if (!img.hasAttribute('alt')) {
      imagesMissingAlt.push(img.currentSrc || img.src || img.id || '(image without src)');
    }
  });

  const labelTargetIds = new Set(
    Array.from(document.querySelectorAll('label[for]')).map((l) => l.getAttribute('for')),
  );
  const inputsMissingLabel: string[] = [];
  document
    .querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select')
    .forEach((el) => {
      if (!visible(el)) return;
      const hasLabel =
        (el.id !== '' && labelTargetIds.has(el.id)) ||
        el.closest('label') !== null ||
        Boolean(el.getAttribute('aria-label')) ||
        Boolean(el.getAttribute('aria-labelledby'));
      if (!hasLabel) inputsMissingLabel.push(describe(el));
    });

  return {
    buttonsWithoutName,
    linksWithoutName,
    imagesMissingAlt,
    inputsMissingLabel,
    hasDocumentTitle: document.title.trim().length > 0,
    hasHtmlLang: (document.documentElement.getAttribute('lang') ?? '').trim().length > 0,
  };
}

/** Runs the in-page a11y probe against a live page and evaluates it. */
export class A11yTrap {
  private readonly viewport: ViewportName;

  constructor(viewport: ViewportName) {
    this.viewport = viewport;
  }

  async collect(page: Page, route: string): Promise<QAIssue[]> {
    let metrics: A11yMetrics;
    try {
      metrics = await page.evaluate(probeA11y);
    } catch {
      return [];
    }
    return evaluateA11yMetrics(metrics, route, this.viewport);
  }
}
