import type { Page } from 'playwright';
import { contrastRatio } from './a11y-trap.js';
import { type ColorScheme, type QAIssue, type ViewportName } from '../types.js';
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
export declare const EMPTY_THEME_METRICS: ThemeMetrics;
export declare function evaluateThemeMetrics(metrics: ThemeMetrics, route: string, viewport: ViewportName, colorScheme: ColorScheme): QAIssue[];
export declare class ThemeTrap {
    private readonly viewport;
    private readonly colorScheme;
    constructor(viewport: ViewportName, colorScheme: ColorScheme);
    collect(page: Page, route: string): Promise<QAIssue[]>;
}
export { contrastRatio };
//# sourceMappingURL=theme-trap.d.ts.map