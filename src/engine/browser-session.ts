import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { ViewportName } from '../types.js';

export interface ViewportProfile {
  name: ViewportName;
  width: number;
  height: number;
  isMobile: boolean;
  hasTouch: boolean;
  deviceScaleFactor: number;
  userAgent?: string;
}

export const VIEWPORT_PROFILES: Record<ViewportName, ViewportProfile> = {
  desktop: {
    name: 'desktop',
    width: 1440,
    height: 900,
    isMobile: false,
    hasTouch: false,
    deviceScaleFactor: 1,
  },
  mobile: {
    name: 'mobile',
    width: 390,
    height: 844,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },
};

export class BrowserNotInstalledError extends Error {
  constructor(cause?: unknown) {
    super(
      'ghost-qa could not launch Chromium. Playwright browsers are not installed yet.\n' +
        'Fix (one-time):  npx playwright install chromium\n' +
        (cause instanceof Error ? `Underlying error: ${cause.message}` : ''),
    );
    this.name = 'BrowserNotInstalledError';
  }
}

/**
 * Owns the headless Chromium lifecycle: one browser, one isolated context per
 * viewport profile, pages created on demand. Always `close()` (or use
 * `await using`-style try/finally) — leaked browsers hang CI.
 */
export class BrowserSession {
  private browser: Browser | null = null;
  private readonly contexts = new Map<ViewportName, BrowserContext>();
  private readonly headless: boolean;

  constructor(headless = true) {
    this.headless = headless;
  }

  async launch(): Promise<void> {
    if (this.browser) return;
    // GHOST_QA_CHROMIUM_PATH lets CI / serverless environments point ghost-qa
    // at a pre-provisioned Chromium (e.g. @sparticuz/chromium) instead of the
    // Playwright-managed download.
    const executablePath = process.env.GHOST_QA_CHROMIUM_PATH;
    try {
      this.browser = await chromium.launch({
        headless: this.headless,
        ...(executablePath ? { executablePath } : {}),
      });
    } catch (error) {
      throw new BrowserNotInstalledError(error);
    }
  }

  get isLaunched(): boolean {
    return this.browser !== null;
  }

  async contextFor(viewport: ViewportName): Promise<BrowserContext> {
    if (!this.browser) await this.launch();
    const existing = this.contexts.get(viewport);
    if (existing) return existing;

    const profile = VIEWPORT_PROFILES[viewport];
    const context = await this.browser!.newContext({
      viewport: { width: profile.width, height: profile.height },
      isMobile: profile.isMobile,
      hasTouch: profile.hasTouch,
      deviceScaleFactor: profile.deviceScaleFactor,
      ...(profile.userAgent ? { userAgent: profile.userAgent } : {}),
    });
    this.contexts.set(viewport, context);
    return context;
  }

  async newPage(viewport: ViewportName): Promise<Page> {
    const context = await this.contextFor(viewport);
    return context.newPage();
  }

  async close(): Promise<void> {
    for (const context of this.contexts.values()) {
      await context.close().catch(() => undefined);
    }
    this.contexts.clear();
    if (this.browser) {
      await this.browser.close().catch(() => undefined);
      this.browser = null;
    }
  }
}

/** Lightweight launch smoke-test used by `ghost-qa doctor`. */
export async function smokeTestBrowser(): Promise<{ ok: boolean; detail: string }> {
  let session: BrowserSession | null = null;
  try {
    session = new BrowserSession(true);
    const page = await session.newPage('desktop');
    await page.goto('about:blank');
    const title = await page.evaluate(() => document.title);
    void title;
    return { ok: true, detail: 'Chromium launched and rendered about:blank successfully.' };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await session?.close().catch(() => undefined);
  }
}
