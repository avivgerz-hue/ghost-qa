import type { Page } from 'playwright';
import { contrastRatio } from './a11y-trap.js';
import { makeIssue, type ColorScheme, type QAIssue, type ViewportName } from '../types.js';

/**
 * Trap 8 — Dark / Light Theme Emulation.
 *
 * The page is rendered twice per viewport, once per emulated colour scheme
 * (`colorScheme: 'light' | 'dark'` media emulation). Under each scheme the
 * trap recomputes real foreground/background contrast on visible text: the
 * classic invisible-dark-mode bug (near-black text on a near-black
 * background when the OS flips to dark) shows up as a theme-contrast
 * finding tagged with the failing scheme.
 */
export interface ThemeContrastFailure {
  descriptor: string;
  selector: string;
  ratio: number;
  required: number;
}

export interface ThemeMetrics {
  failures: ThemeContrastFailure[];
}

export const EMPTY_THEME_METRICS: ThemeMetrics = { failures: [] };

export function evaluateThemeMetrics(
  metrics: ThemeMetrics,
  route: string,
  viewport: ViewportName,
  colorScheme: ColorScheme,
): QAIssue[] {
  return metrics.failures.slice(0, 5).map((failure) =>
    makeIssue({
      category: 'theme',
      severity: 'major',
      type: 'theme-contrast',
      message:
        `Invisible/low-contrast text in ${colorScheme} mode: ${failure.descriptor} has contrast ${failure.ratio}:1 (needs ${failure.required}:1) ` +
        `when the OS colour scheme is ${colorScheme}. Use theme-aware tokens (CSS variables / dark: variants) instead of hard-coded colours.`,
      route,
      viewport,
      colorScheme,
      details: { element: failure.descriptor, ratio: failure.ratio, required: failure.required, colorScheme },
      selector: failure.selector,
    }),
  );
}

/** In-page probe: computed-contrast failures under the emulated scheme. */
function probeTheme(): ThemeMetrics {
  const describe = (el: Element): string => {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return `${tag}${id}${text ? ` "${text}"` : ''}`;
  };
  const visible = (el: Element): boolean => {
    const style = window.getComputedStyle(el as HTMLElement);
    return style.display !== 'none' && style.visibility !== 'hidden';
  };
  const parseRgb = (value: string): [number, number, number, number] | null => {
    const match = value.match(/rgba?\(([^)]+)\)/);
    if (!match) return null;
    const parts = match[1]!.split(',').map((p) => Number.parseFloat(p));
    if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
    return [parts[0]!, parts[1]!, parts[2]!, parts.length > 3 ? parts[3]! : 1];
  };
  const luminance = (rgb: [number, number, number]): number => {
    const linear = (channel: number): number => {
      const s = channel / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2]);
  };
  const effectiveBackground = (el: Element): [number, number, number] => {
    let node: Element | null = el;
    while (node) {
      const bg = parseRgb(window.getComputedStyle(node).backgroundColor);
      if (bg && bg[3] > 0) return [bg[0], bg[1], bg[2]];
      node = node.parentElement;
    }
    // No painted background anywhere: browsers still paint the default
    // white canvas (pages that never opt into dark styling render
    // identically in both schemes). Real dark-mode bugs set a dark
    // background via media query, which the walk above finds.
    return [255, 255, 255];
  };

  const failures: ThemeContrastFailure[] = [];
  for (const el of Array.from(document.querySelectorAll('body *')).slice(0, 400)) {
    if (failures.length >= 8) break;
    const html = el as HTMLElement;
    const ownText = Array.from(html.childNodes).some(
      (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0,
    );
    if (!ownText || !visible(el)) continue;
    const style = window.getComputedStyle(html);
    const fg = parseRgb(style.color);
    if (!fg) continue;
    const bg = effectiveBackground(el);
    const l1 = luminance([fg[0], fg[1], fg[2]]);
    const l2 = luminance(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const fontSize = Number.parseFloat(style.fontSize) || 16;
    const bold = Number.parseInt(style.fontWeight, 10) >= 700 || style.fontWeight === 'bold';
    const required = fontSize >= 24 || (fontSize >= 18.66 && bold) ? 3 : 4.5;
    if (ratio < required) {
      failures.push({
        descriptor: describe(el),
        selector: describe(el),
        ratio: Math.round(ratio * 100) / 100,
        required,
      });
    }
  }
  return { failures };
}

export class ThemeTrap {
  private readonly viewport: ViewportName;
  private readonly colorScheme: ColorScheme;

  constructor(viewport: ViewportName, colorScheme: ColorScheme) {
    this.viewport = viewport;
    this.colorScheme = colorScheme;
  }

  async collect(page: Page, route: string): Promise<QAIssue[]> {
    let metrics: ThemeMetrics;
    try {
      metrics = await page.evaluate(probeTheme);
    } catch {
      return [];
    }
    return evaluateThemeMetrics(metrics, route, this.viewport, this.colorScheme);
  }
}

export { contrastRatio };
