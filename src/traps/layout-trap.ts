import type { Page } from 'playwright';
import { VIEWPORT_PROFILES } from '../engine/browser-session.js';
import { makeIssue, type QAIssue, type ViewportName } from '../types.js';

export interface OffendingElement {
  descriptor: string;
  right: number;
  width: number;
}

export interface ElementFinding {
  descriptor: string;
  selector: string;
  box: { x: number; y: number; width: number; height: number };
}

export interface CollisionFinding {
  first: string;
  second: string;
  selector: string;
  box: { x: number; y: number; width: number; height: number };
}

export interface LayoutMetrics {
  innerWidth: number;
  scrollWidth: number;
  hasViewportMeta: boolean;
  /** Interactive elements rendered at 0×0 (or effectively invisible). */
  zeroSizeInteractives: string[];
  /** Images that finished loading but decoded to nothing. */
  brokenImages: string[];
  /** Inline SVGs rendered with a 0×0 bounding box. */
  brokenSvgs: string[];
  /** Elements extending past the right edge of the viewport. */
  overflowingElements: OffendingElement[];
  /** Visible interactive elements overlapping each other (collision math). */
  collisions: CollisionFinding[];
  /** Touch targets below 44×44px on touch viewports (WCAG 2.5.5 / Apple HIG). */
  smallTouchTargets: ElementFinding[];
  /** Text containers whose content is unintentionally clipped. */
  clippedText: ElementFinding[];
  /** Interactive elements positioned entirely off-screen. */
  offscreenInteractives: ElementFinding[];
}

export const EMPTY_METRICS: LayoutMetrics = {
  innerWidth: 0,
  scrollWidth: 0,
  hasViewportMeta: false,
  zeroSizeInteractives: [],
  brokenImages: [],
  brokenSvgs: [],
  overflowingElements: [],
  collisions: [],
  smallTouchTargets: [],
  clippedText: [],
  offscreenInteractives: [],
};

/**
 * Pure evaluator: DOM geometry in, structured layout issues out.
 * This is the heart of the Layout Trap and is fully unit-testable.
 */
export function evaluateLayoutMetrics(
  metrics: LayoutMetrics,
  route: string,
  viewport: ViewportName,
): QAIssue[] {
  const issues: QAIssue[] = [];
  const tolerancePx = 1;

  if (metrics.innerWidth > 0 && metrics.scrollWidth > metrics.innerWidth + tolerancePx) {
    const overflowPx = metrics.scrollWidth - metrics.innerWidth;
    const offenders = metrics.overflowingElements
      .slice(0, 3)
      .map((el) => el.descriptor)
      .join(', ');
    issues.push(
      makeIssue({
        category: 'layout',
        severity: viewport === 'mobile' ? 'critical' : 'major',
        type: 'horizontal-overflow',
        message:
          `Horizontal overflow on ${viewport}: page scrolls sideways by ${overflowPx}px ` +
          `(scrollWidth ${metrics.scrollWidth} > viewport ${metrics.innerWidth}).` +
          (offenders ? ` Likely culprits: ${offenders}.` : '') +
          ' Common causes: 100vw widths, fixed-width children, negative margins, unshrunk flex/grid items.',
        route,
        viewport,
        details: {
          scrollWidth: metrics.scrollWidth,
          innerWidth: metrics.innerWidth,
          overflowPx,
        },
      }),
    );
  }

  for (const descriptor of metrics.zeroSizeInteractives.slice(0, 5)) {
    issues.push(
      makeIssue({
        category: 'layout',
        severity: 'major',
        type: 'zero-size-interactive',
        message: `Interactive element has zero size and cannot be tapped/clicked: ${descriptor}. Check for display/width/height CSS collapsing it or content that never rendered.`,
        route,
        viewport,
        details: { element: descriptor },
      }),
    );
  }

  for (const src of metrics.brokenImages.slice(0, 5)) {
    issues.push(
      makeIssue({
        category: 'layout',
        severity: 'major',
        type: 'broken-image',
        message: `Broken image (naturalWidth === 0): ${src}. Verify the asset path exists and is served with a 200.`,
        route,
        viewport,
        details: { src },
      }),
    );
  }

  for (const src of metrics.brokenSvgs.slice(0, 5)) {
    issues.push(
      makeIssue({
        category: 'network',
        severity: 'major',
        type: 'broken-svg',
        message: `Broken inline SVG (0×0 bounding box): ${src}. Give the <svg> explicit width/height or a viewBox with CSS size so it actually renders.`,
        route,
        viewport,
        details: { element: src },
        selector: src,
      }),
    );
  }

  for (const hit of metrics.collisions.slice(0, 5)) {
    issues.push(
      makeIssue({
        category: 'layout',
        severity: 'major',
        type: 'element-collision',
        message: `Overlapping interactive elements: ${hit.first} overlaps ${hit.second}. Overlapping tap/click targets cause mis-taps — fix stacking (z-index), absolute positioning, or flow layout.`,
        route,
        viewport,
        details: { first: hit.first, second: hit.second },
        selector: hit.selector,
        boundingBox: hit.box,
      }),
    );
  }

  if (viewport !== 'desktop') {
    for (const target of metrics.smallTouchTargets.slice(0, 5)) {
      issues.push(
        makeIssue({
          category: 'layout',
          severity: 'major',
          type: 'small-touch-target',
          message: `Touch target too small on ${viewport}: ${target.descriptor} is ${Math.round(target.box.width)}×${Math.round(target.box.height)}px (minimum 44×44px per WCAG 2.5.5 / Apple HIG). Increase padding or min-height/min-width.`,
          route,
          viewport,
          details: { element: target.descriptor, width: Math.round(target.box.width), height: Math.round(target.box.height) },
          selector: target.selector,
          boundingBox: target.box,
        }),
      );
    }
  }

  for (const clipped of metrics.clippedText.slice(0, 5)) {
    issues.push(
      makeIssue({
        category: 'layout',
        severity: 'minor',
        type: 'clipped-text',
        message: `Text may be unintentionally clipped: ${clipped.descriptor} (content overflows its box with overflow hidden). Allow the container to grow, wrap, or scroll intentionally.`,
        route,
        viewport,
        details: { element: clipped.descriptor },
        selector: clipped.selector,
        boundingBox: clipped.box,
      }),
    );
  }

  for (const off of metrics.offscreenInteractives.slice(0, 5)) {
    issues.push(
      makeIssue({
        category: 'layout',
        severity: 'major',
        type: 'offscreen-interactive',
        message: `Interactive element is positioned off-screen and unreachable: ${off.descriptor}. Check transforms, absolute positioning and negative offsets.`,
        route,
        viewport,
        details: { element: off.descriptor },
        selector: off.selector,
        boundingBox: off.box,
      }),
    );
  }

  if (viewport === 'mobile' && !metrics.hasViewportMeta) {
    issues.push(
      makeIssue({
        category: 'layout',
        severity: 'major',
        type: 'missing-viewport-meta',
        message:
          'Missing <meta name="viewport"> — mobile browsers will render at a desktop width and scale down. Add <meta name="viewport" content="width=device-width, initial-scale=1">.',
        route,
        viewport,
      }),
    );
  }

  return issues;
}

/** In-page probe: measures live DOM geometry. Executed inside Chromium. */
function probeLayout(): LayoutMetrics {
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

  const interactiveSelector =
    'a[href], button, input, select, textarea, [role="button"], [role="tab"], [tabindex]';
  const zeroSizeInteractives: string[] = [];
  document.querySelectorAll(interactiveSelector).forEach((el) => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el as HTMLElement);
    const intentionallyHidden =
      style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
    if (!intentionallyHidden && (rect.width === 0 || rect.height === 0)) {
      zeroSizeInteractives.push(describe(el));
    }
  });

  const cssPath = (el: Element): string => {
    if (el.id) return `#${el.id}`;
    const testid = el.getAttribute('data-testid');
    if (testid) return `[data-testid="${testid}"]`;
    const parts: string[] = [];
    let node: Element | null = el;
    while (node && node !== document.body && parts.length < 4) {
      const tag = node.tagName.toLowerCase();
      const parent: Element | null = node.parentElement;
      if (!parent) {
        parts.unshift(tag);
        break;
      }
      const siblings = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
      parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${siblings.indexOf(node) + 1})` : tag);
      node = parent;
    }
    return parts.join(' > ');
  };

  const boxOf = (el: Element): { x: number; y: number; width: number; height: number } => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
  };

  const brokenImages: string[] = [];
  document.querySelectorAll('img').forEach((img) => {
    if (img.complete && img.naturalWidth === 0) {
      brokenImages.push(img.currentSrc || img.src || img.alt || '(image without src)');
    }
  });

  const brokenSvgs: string[] = [];
  document.querySelectorAll('svg').forEach((svg) => {
    const rect = svg.getBoundingClientRect();
    const style = window.getComputedStyle(svg);
    if (style.display !== 'none' && (rect.width === 0 || rect.height === 0)) {
      brokenSvgs.push(cssPath(svg));
    }
  });

  // Geometry pass over visible interactives: collisions, touch targets,
  // off-screen elements. Capped — this runs on every route/viewport.
  const visibleInteractives: Element[] = [];
  document.querySelectorAll(interactiveSelector).forEach((el) => {
    const style = window.getComputedStyle(el as HTMLElement);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    visibleInteractives.push(el);
  });

  const smallTouchTargets: ElementFinding[] = [];
  const offscreenInteractives: ElementFinding[] = [];
  for (const el of visibleInteractives.slice(0, 120)) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)) {
      smallTouchTargets.push({ descriptor: describe(el), selector: cssPath(el), box: boxOf(el) });
    }
    if (rect.right <= 0 || rect.left >= window.innerWidth) {
      offscreenInteractives.push({ descriptor: describe(el), selector: cssPath(el), box: boxOf(el) });
    }
  }

  const collisions: CollisionFinding[] = [];
  const collisionPool = visibleInteractives.slice(0, 80);
  for (let i = 0; i < collisionPool.length && collisions.length < 5; i++) {
    for (let j = i + 1; j < collisionPool.length && collisions.length < 5; j++) {
      const a = collisionPool[i]!;
      const b = collisionPool[j]!;
      if (a.contains(b) || b.contains(a)) continue;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      if (ra.width === 0 || rb.width === 0) continue;
      const overlapW = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const overlapH = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (overlapW > 4 && overlapH > 4) {
        const overlapArea = overlapW * overlapH;
        const minArea = Math.min(ra.width * ra.height, rb.width * rb.height);
        if (overlapArea < minArea * 0.9) {
          collisions.push({
            first: describe(a),
            second: describe(b),
            selector: cssPath(a),
            box: boxOf(a),
          });
        }
      }
    }
  }

  const clippedText: ElementFinding[] = [];
  document.querySelectorAll('body *').forEach((el) => {
    if (clippedText.length >= 5) return;
    const html = el as HTMLElement;
    if (!html.textContent?.trim()) return;
    const style = window.getComputedStyle(html);
    if (style.overflow !== 'hidden' && style.overflowX !== 'hidden' && style.overflowY !== 'hidden') return;
    if (html.scrollHeight > html.clientHeight + 2 || html.scrollWidth > html.clientWidth + 2) {
      if (html.clientHeight > 0 && html.clientWidth > 0) {
        clippedText.push({ descriptor: describe(el), selector: cssPath(el), box: boxOf(el) });
      }
    }
  });

  const overflowingElements: OffendingElement[] = [];
  const innerWidth = window.innerWidth;
  document.querySelectorAll('body *').forEach((el) => {
    if (overflowingElements.length >= 10) return;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.right > innerWidth + 1) {
      overflowingElements.push({
        descriptor: describe(el),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
      });
    }
  });

  return {
    innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    hasViewportMeta: Boolean(document.querySelector('meta[name="viewport"]')),
    zeroSizeInteractives,
    brokenImages,
    brokenSvgs,
    overflowingElements,
    collisions,
    smallTouchTargets,
    clippedText,
    offscreenInteractives,
  };
}

/** Runs the in-page probe against a live Playwright page and evaluates it. */
export class LayoutTrap {
  private readonly viewport: ViewportName;

  constructor(viewport: ViewportName) {
    this.viewport = viewport;
  }

  async collect(page: Page, route: string): Promise<QAIssue[]> {
    let metrics: LayoutMetrics;
    try {
      metrics = await page.evaluate(probeLayout);
    } catch {
      return [];
    }
    // Judge overflow against the intended profile width, not just the live
    // innerWidth: mobile emulation (and some headless builds) can let the
    // layout viewport grow with wide content, which would mask exactly the
    // overflow this trap exists to catch.
    const expectedWidth = VIEWPORT_PROFILES[this.viewport].width;
    if (metrics.innerWidth > expectedWidth) {
      metrics = { ...metrics, innerWidth: expectedWidth };
    }
    return evaluateLayoutMetrics(metrics, route, this.viewport);
  }
}
