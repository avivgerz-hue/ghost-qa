import { chromium } from 'playwright';
export const VIEWPORT_PROFILES = {
    desktop: {
        name: 'desktop',
        width: 1440,
        height: 900,
        isMobile: false,
        hasTouch: false,
        deviceScaleFactor: 1,
    },
    tablet: {
        name: 'tablet',
        width: 768,
        height: 1024,
        isMobile: false,
        hasTouch: true,
        deviceScaleFactor: 2,
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    },
    mobile: {
        name: 'mobile',
        width: 375,
        height: 812,
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    },
};
export class BrowserNotInstalledError extends Error {
    constructor(cause) {
        super('ghost-qa could not launch Chromium. Playwright browsers are not installed yet.\n' +
            'Fix (one-time):  npx playwright install chromium\n' +
            (cause instanceof Error ? `Underlying error: ${cause.message}` : ''));
        this.name = 'BrowserNotInstalledError';
    }
}
/**
 * Owns the headless Chromium lifecycle: one browser, one isolated context per
 * viewport profile, pages created on demand. Always `close()` (or use
 * `await using`-style try/finally) — leaked browsers hang CI.
 */
export class BrowserSession {
    browser = null;
    contexts = new Map();
    headless;
    constructor(headless = true) {
        this.headless = headless;
    }
    async launch() {
        if (this.browser)
            return;
        // GHOST_QA_CHROMIUM_PATH lets CI / serverless environments point ghost-qa
        // at a pre-provisioned Chromium (e.g. @sparticuz/chromium) instead of the
        // Playwright-managed download.
        const executablePath = process.env.GHOST_QA_CHROMIUM_PATH;
        try {
            this.browser = await chromium.launch({
                headless: this.headless,
                ...(executablePath ? { executablePath } : {}),
            });
        }
        catch (error) {
            throw new BrowserNotInstalledError(error);
        }
    }
    get isLaunched() {
        return this.browser !== null;
    }
    async contextFor(viewport, colorScheme = 'light') {
        if (!this.browser)
            await this.launch();
        const key = `${viewport}:${colorScheme}`;
        const existing = this.contexts.get(key);
        if (existing)
            return existing;
        const profile = VIEWPORT_PROFILES[viewport];
        const context = await this.browser.newContext({
            viewport: { width: profile.width, height: profile.height },
            isMobile: profile.isMobile,
            hasTouch: profile.hasTouch,
            deviceScaleFactor: profile.deviceScaleFactor,
            colorScheme,
            ...(profile.userAgent ? { userAgent: profile.userAgent } : {}),
        });
        this.contexts.set(key, context);
        return context;
    }
    async newPage(viewport, colorScheme = 'light') {
        const context = await this.contextFor(viewport, colorScheme);
        return context.newPage();
    }
    async close() {
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
export async function smokeTestBrowser() {
    let session = null;
    try {
        session = new BrowserSession(true);
        const page = await session.newPage('desktop');
        await page.goto('about:blank');
        const title = await page.evaluate(() => document.title);
        void title;
        return { ok: true, detail: 'Chromium launched and rendered about:blank successfully.' };
    }
    catch (error) {
        return {
            ok: false,
            detail: error instanceof Error ? error.message : String(error),
        };
    }
    finally {
        await session?.close().catch(() => undefined);
    }
}
//# sourceMappingURL=browser-session.js.map