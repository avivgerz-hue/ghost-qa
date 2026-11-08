import { BrowserSession } from './browser-session.js';
import { InteractionRunner } from './interaction-runner.js';
import { RouteCrawler } from './route-crawler.js';
import { ConsoleTrap } from '../traps/console-trap.js';
import { LayoutTrap } from '../traps/layout-trap.js';
import { NetworkTrap } from '../traps/network-trap.js';
import { A11yTrap } from '../traps/a11y-trap.js';
import { PerfTrap } from '../traps/perf-trap.js';
import { LinksTrap } from '../traps/links-trap.js';
import { SeoTrap } from '../traps/seo-trap.js';
import { ThemeTrap } from '../traps/theme-trap.js';
import { computeHealthScore } from './health-score.js';
import { dedupeIssues, makeIssue, summarise, } from '../types.js';
export { GHOST_QA_VERSION } from './version.js';
import { GHOST_QA_VERSION } from './version.js';
/**
 * The full ghost-qa audit: crawl + the 8-Trap Deep Browser Inspection
 * Engine (console, network, layout, accessibility, performance, links,
 * SEO, theme) + safe interactions, on every configured viewport and
 * colour scheme. Shared verbatim by the CLI (`ghost-qa test`), the MCP
 * server (`ghost_qa_audit_url`) and library consumers.
 */
export async function runGhostQAAudit(target, options) {
    const startedAt = new Date();
    const url = new URL(target);
    if (!/^https?:$/.test(url.protocol)) {
        throw new Error(`Target must be an http(s) URL, got: ${target}`);
    }
    const session = new BrowserSession(options.headless);
    const interactions = [];
    const rawIssues = [];
    const screenshots = [];
    const records = new Map();
    const crawler = new RouteCrawler(options.maxDepth, options.maxRoutes);
    const runner = new InteractionRunner(options.maxInteractionsPerPage, 250);
    const colorSchemes = options.colorSchemes ?? ['light', 'dark'];
    const primaryScheme = colorSchemes[0] ?? 'light';
    const visit = async (route) => {
        const discovered = new Set();
        const record = {
            url: route.url,
            path: route.path,
            depth: route.depth,
            title: '',
            viewports: [],
            issueCount: 0,
        };
        records.set(route.url, record);
        for (const viewport of options.viewports) {
            record.viewports.push(viewport);
            for (const colorScheme of colorSchemes) {
                const page = await session.newPage(viewport, colorScheme);
                const consoleTrap = new ConsoleTrap(viewport);
                const networkTrap = new NetworkTrap(viewport);
                const layoutTrap = new LayoutTrap(viewport);
                const a11yTrap = new A11yTrap(viewport);
                const perfTrap = new PerfTrap(viewport);
                const linksTrap = new LinksTrap(viewport);
                const seoTrap = new SeoTrap(viewport);
                const themeTrap = new ThemeTrap(viewport, colorScheme);
                consoleTrap.setRoute(route.path);
                networkTrap.setRoute(route.path);
                consoleTrap.attach(page);
                networkTrap.attach(page);
                try {
                    const response = await page.goto(route.url, {
                        waitUntil: 'domcontentloaded',
                        timeout: options.timeoutMs,
                    });
                    if (response && viewport === options.viewports[0] && colorScheme === primaryScheme) {
                        record.httpStatus = response.status();
                    }
                    await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => undefined);
                    await page.waitForTimeout(options.settleMs);
                    if (!record.title)
                        record.title = await page.title().catch(() => '');
                    // Theme Trap runs under every emulated scheme; the remaining
                    // traps run once per viewport (primary scheme) to keep runs fast
                    // and findings de-duplicated.
                    rawIssues.push(...(await themeTrap.collect(page, route.path)));
                    if (colorScheme === primaryScheme) {
                        rawIssues.push(...(await layoutTrap.collect(page, route.path)));
                        rawIssues.push(...(await a11yTrap.collect(page, route.path)));
                        rawIssues.push(...(await perfTrap.collect(page, route.path)));
                        rawIssues.push(...(await linksTrap.collect(page, route.path)));
                        rawIssues.push(...(await seoTrap.collect(page, route.path)));
                        for (const href of await RouteCrawler.extractLinks(page))
                            discovered.add(href);
                        if (options.interactions) {
                            const result = await runner.run(page, route.path, viewport);
                            interactions.push(...result.actions);
                            rawIssues.push(...result.issues);
                            for (const href of result.discoveredHrefs)
                                discovered.add(href);
                            // Interactions may have surfaced fresh console/network events
                            // and changed layout/perf characteristics of the page.
                            rawIssues.push(...(await layoutTrap.collect(page, route.path)));
                            rawIssues.push(...(await perfTrap.collect(page, route.path)));
                        }
                        if (options.screenshots) {
                            try {
                                const shot = await page.screenshot({ type: 'jpeg', quality: 55 });
                                screenshots.push({
                                    route: route.path,
                                    viewport,
                                    colorScheme,
                                    dataUri: `data:image/jpeg;base64,${shot.toString('base64')}`,
                                });
                            }
                            catch {
                                /* screenshots are evidence, never a reason to fail a run */
                            }
                        }
                    }
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    rawIssues.push(makeIssue({
                        category: 'navigation',
                        severity: 'critical',
                        type: 'navigation-failed',
                        message: `Failed to load ${route.path} on ${viewport}: ${message.replace(/\s+/g, ' ').slice(0, 260)}. Is the dev server running at ${url.origin}?`,
                        route: route.path,
                        viewport,
                        url: route.url,
                    }));
                }
                finally {
                    rawIssues.push(...consoleTrap.issues, ...networkTrap.issues);
                    consoleTrap.detach();
                    networkTrap.detach();
                    await page.close().catch(() => undefined);
                }
            }
        }
        return [...discovered];
    };
    try {
        await crawler.crawl(url.toString(), visit);
    }
    finally {
        await session.close();
    }
    const finishedAt = new Date();
    const routes = [...records.values()];
    // Dead internal routes found during crawling (Trap 6, post-pass): a
    // route the crawler reached that answered 4xx/5xx is a dead link target.
    for (const route of routes) {
        if (route.httpStatus && route.httpStatus >= 400) {
            rawIssues.push(makeIssue({
                category: 'links',
                severity: route.httpStatus >= 500 ? 'critical' : 'major',
                type: 'dead-link',
                message: `Dead internal route discovered during crawl: ${route.path} returned HTTP ${route.httpStatus}. Fix the route or remove every link pointing at it.`,
                route: route.path,
                viewport: options.viewports[0] ?? 'desktop',
                url: route.url,
                details: { status: route.httpStatus },
            }));
        }
    }
    const issues = dedupeIssues(rawIssues);
    for (const route of routes) {
        route.issueCount = issues.filter((i) => i.route === route.path).length;
    }
    const health = computeHealthScore(issues);
    const summary = summarise(routes, interactions, issues, options.failOn);
    return {
        tool: 'ghost-qa',
        version: GHOST_QA_VERSION,
        targetUrl: url.toString(),
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        passed: summary.passed,
        options,
        routes,
        interactions,
        issues,
        health,
        ...(screenshots.length > 0 ? { screenshots } : {}),
        summary: {
            routesCrawled: summary.routesCrawled,
            interactionsTested: summary.interactionsTested,
            interactionsSkipped: summary.interactionsSkipped,
            interactionsFailed: summary.interactionsFailed,
            totalIssues: summary.totalIssues,
            bySeverity: summary.bySeverity,
            byCategory: summary.byCategory,
            healthScore: health.score,
            grade: health.grade,
        },
    };
}
//# sourceMappingURL=audit-runner.js.map