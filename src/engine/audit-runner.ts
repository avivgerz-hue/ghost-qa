import { BrowserSession } from './browser-session.js';
import { InteractionRunner } from './interaction-runner.js';
import { RouteCrawler, type DiscoveredRoute } from './route-crawler.js';
import { ConsoleTrap } from '../traps/console-trap.js';
import { LayoutTrap } from '../traps/layout-trap.js';
import { NetworkTrap } from '../traps/network-trap.js';
import { A11yTrap } from '../traps/a11y-trap.js';
import { PerfTrap } from '../traps/perf-trap.js';
import {
  dedupeIssues,
  makeIssue,
  summarise,
  type GhostQAOptions,
  type GhostQAReport,
  type InteractionAction,
  type QAIssue,
  type RouteRecord,
} from '../types.js';

export const GHOST_QA_VERSION = '1.2.0';

/**
 * The full ghost-qa audit: crawl + all five traps (console, network, layout,
 * accessibility, performance) + safe interactions, on every configured
 * viewport. Shared verbatim by the CLI (`ghost-qa test`), the MCP server
 * (`ghost_qa_audit_url`) and library consumers.
 */
export async function runGhostQAAudit(
  target: string,
  options: GhostQAOptions,
): Promise<GhostQAReport> {
  const startedAt = new Date();
  const url = new URL(target);
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error(`Target must be an http(s) URL, got: ${target}`);
  }

  const session = new BrowserSession(options.headless);
  const interactions: InteractionAction[] = [];
  const rawIssues: QAIssue[] = [];
  const records = new Map<string, RouteRecord>();
  const crawler = new RouteCrawler(options.maxDepth, options.maxRoutes);
  const runner = new InteractionRunner(options.maxInteractionsPerPage, 250);

  const visit = async (route: DiscoveredRoute): Promise<string[]> => {
    const discovered = new Set<string>();
    const record: RouteRecord = {
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
      const page = await session.newPage(viewport);
      const consoleTrap = new ConsoleTrap(viewport);
      const networkTrap = new NetworkTrap(viewport);
      const layoutTrap = new LayoutTrap(viewport);
      const a11yTrap = new A11yTrap(viewport);
      const perfTrap = new PerfTrap(viewport);
      consoleTrap.setRoute(route.path);
      networkTrap.setRoute(route.path);
      consoleTrap.attach(page);
      networkTrap.attach(page);

      try {
        const response = await page.goto(route.url, {
          waitUntil: 'domcontentloaded',
          timeout: options.timeoutMs,
        });
        if (response && viewport === options.viewports[0]) {
          record.httpStatus = response.status();
        }
        await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => undefined);
        await page.waitForTimeout(options.settleMs);

        if (!record.title) record.title = await page.title().catch(() => '');

        rawIssues.push(...(await layoutTrap.collect(page, route.path)));
        rawIssues.push(...(await a11yTrap.collect(page, route.path)));
        rawIssues.push(...(await perfTrap.collect(page, route.path)));
        for (const href of await RouteCrawler.extractLinks(page)) discovered.add(href);

        if (options.interactions) {
          const result = await runner.run(page, route.path, viewport);
          interactions.push(...result.actions);
          rawIssues.push(...result.issues);
          for (const href of result.discoveredHrefs) discovered.add(href);
          // Interactions may have surfaced fresh console/network events and
          // changed layout/perf characteristics of the page.
          rawIssues.push(...(await layoutTrap.collect(page, route.path)));
          rawIssues.push(...(await perfTrap.collect(page, route.path)));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        rawIssues.push(
          makeIssue({
            category: 'navigation',
            severity: 'critical',
            type: 'navigation-failed',
            message: `Failed to load ${route.path} on ${viewport}: ${message.replace(/\s+/g, ' ').slice(0, 260)}. Is the dev server running at ${url.origin}?`,
            route: route.path,
            viewport,
            url: route.url,
          }),
        );
      } finally {
        rawIssues.push(...consoleTrap.issues, ...networkTrap.issues);
        consoleTrap.detach();
        networkTrap.detach();
        await page.close().catch(() => undefined);
      }
    }
    return [...discovered];
  };

  try {
    await crawler.crawl(url.toString(), visit);
  } finally {
    await session.close();
  }

  const finishedAt = new Date();
  const issues = dedupeIssues(rawIssues);
  const routes = [...records.values()];
  for (const route of routes) {
    route.issueCount = issues.filter((i) => i.route === route.path).length;
  }
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
    summary: {
      routesCrawled: summary.routesCrawled,
      interactionsTested: summary.interactionsTested,
      interactionsSkipped: summary.interactionsSkipped,
      interactionsFailed: summary.interactionsFailed,
      totalIssues: summary.totalIssues,
      bySeverity: summary.bySeverity,
      byCategory: summary.byCategory,
    },
  };
}
