import type { Page } from 'playwright';
import { makeIssue, type QAIssue, type ViewportName } from '../types.js';

/**
 * Trap 7 — SEO, Metadata & Social Graph.
 *
 * What search engines and link unfurlers see, audited on the live DOM
 * (post-hydration, exactly as a crawler rendering the page would).
 */
export interface SeoMetrics {
  title: string;
  hasDescription: boolean;
  hasLang: boolean;
  hasViewportMeta: boolean;
  hasCanonical: boolean;
  ogTitle: boolean;
  ogDescription: boolean;
  ogImage: boolean;
  /** id attribute values used more than once. */
  duplicateIds: string[];
}

export const EMPTY_SEO_METRICS: SeoMetrics = {
  title: '',
  hasDescription: false,
  hasLang: false,
  hasViewportMeta: false,
  hasCanonical: false,
  ogTitle: false,
  ogDescription: false,
  ogImage: false,
  duplicateIds: [],
};

export const TITLE_MIN_LENGTH = 10;
export const TITLE_MAX_LENGTH = 60;

export function evaluateSeoMetrics(
  metrics: SeoMetrics,
  route: string,
  viewport: ViewportName,
): QAIssue[] {
  const issues: QAIssue[] = [];
  const push = (severity: 'major' | 'minor', type: QAIssue['type'], message: string) =>
    issues.push(makeIssue({ category: 'seo', severity, type, message, route, viewport }));

  const title = metrics.title.trim();
  if (title.length === 0) {
    push('major', 'missing-document-title', 'Missing <title>: search results, tabs and screen readers all start here. Add a unique descriptive title per route.');
  } else if (title.length < TITLE_MIN_LENGTH) {
    push('minor', 'title-too-short', `<title> is only ${title.length} characters ("${title}"). Aim for ${TITLE_MIN_LENGTH}–${TITLE_MAX_LENGTH} descriptive characters.`);
  } else if (title.length > TITLE_MAX_LENGTH) {
    push('minor', 'title-too-long', `<title> is ${title.length} characters — it will be truncated in search results (~${TITLE_MAX_LENGTH} shown). Shorten it and move detail into the description.`);
  }

  if (!metrics.hasDescription) {
    push('minor', 'missing-meta-description', 'Missing <meta name="description">: search engines will improvise a snippet from page text. Add a 120–160 character summary.');
  }
  if (!metrics.hasLang) {
    push('minor', 'missing-html-lang', 'Missing lang attribute on <html> (e.g. <html lang="en">) — hurts both SEO locale signals and screen-reader pronunciation.');
  }
  if (!metrics.hasViewportMeta) {
    push('major', 'missing-viewport-meta', 'Missing <meta name="viewport">: mobile search ranking and rendering both depend on it. Add content="width=device-width, initial-scale=1".');
  }
  if (!metrics.hasCanonical) {
    push('minor', 'missing-canonical', 'Missing <link rel="canonical">: duplicate URLs (query params, trailing slashes) can split ranking. Point canonical at the clean route URL.');
  }

  const missingOg = [
    !metrics.ogTitle && 'og:title',
    !metrics.ogDescription && 'og:description',
    !metrics.ogImage && 'og:image',
  ].filter(Boolean) as string[];
  if (missingOg.length > 0) {
    push('minor', 'missing-opengraph', `Missing OpenGraph tags: ${missingOg.join(', ')}. Links shared to Slack/X/LinkedIn will unfurl with no (or scraped) preview. Add the full og: set.`);
  }

  for (const id of metrics.duplicateIds.slice(0, 5)) {
    issues.push(
      makeIssue({
        category: 'seo',
        severity: 'major',
        type: 'duplicate-id',
        message: `Duplicate id attribute in the live DOM: #${id} appears more than once. ids must be unique — anchors, aria-labelledby and getElementById all silently target the first match.`,
        route,
        viewport,
        details: { id },
        selector: `#${id}`,
      }),
    );
  }

  return issues;
}

/** In-page probe: metadata facts from the live (post-hydration) DOM. */
function probeSeo(): SeoMetrics {
  const meta = (selector: string): boolean => Boolean(document.querySelector(selector));
  const idCounts = new Map<string, number>();
  document.querySelectorAll('[id]').forEach((el) => {
    if (el.id) idCounts.set(el.id, (idCounts.get(el.id) ?? 0) + 1);
  });
  return {
    title: document.title ?? '',
    hasDescription: meta('meta[name="description"]'),
    hasLang: (document.documentElement.getAttribute('lang') ?? '').trim().length > 0,
    hasViewportMeta: meta('meta[name="viewport"]'),
    hasCanonical: meta('link[rel="canonical"]'),
    ogTitle: meta('meta[property="og:title"]'),
    ogDescription: meta('meta[property="og:description"]'),
    ogImage: meta('meta[property="og:image"]'),
    duplicateIds: [...idCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id),
  };
}

export class SeoTrap {
  private readonly viewport: ViewportName;

  constructor(viewport: ViewportName) {
    this.viewport = viewport;
  }

  async collect(page: Page, route: string): Promise<QAIssue[]> {
    let metrics: SeoMetrics;
    try {
      metrics = await page.evaluate(probeSeo);
    } catch {
      return [];
    }
    return evaluateSeoMetrics(metrics, route, this.viewport);
  }
}
