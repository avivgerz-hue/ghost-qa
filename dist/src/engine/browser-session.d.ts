import { type BrowserContext, type Page } from 'playwright';
import type { ColorScheme, ViewportName } from '../types.js';
export interface ViewportProfile {
    name: ViewportName;
    width: number;
    height: number;
    isMobile: boolean;
    hasTouch: boolean;
    deviceScaleFactor: number;
    userAgent?: string;
}
export declare const VIEWPORT_PROFILES: Record<ViewportName, ViewportProfile>;
export declare class BrowserNotInstalledError extends Error {
    constructor(cause?: unknown);
}
/**
 * Owns the headless Chromium lifecycle: one browser, one isolated context per
 * viewport profile, pages created on demand. Always `close()` (or use
 * `await using`-style try/finally) — leaked browsers hang CI.
 */
export declare class BrowserSession {
    private browser;
    private readonly contexts;
    private readonly headless;
    constructor(headless?: boolean);
    launch(): Promise<void>;
    get isLaunched(): boolean;
    contextFor(viewport: ViewportName, colorScheme?: ColorScheme): Promise<BrowserContext>;
    newPage(viewport: ViewportName, colorScheme?: ColorScheme): Promise<Page>;
    close(): Promise<void>;
}
/** Lightweight launch smoke-test used by `ghost-qa doctor`. */
export declare function smokeTestBrowser(): Promise<{
    ok: boolean;
    detail: string;
}>;
//# sourceMappingURL=browser-session.d.ts.map