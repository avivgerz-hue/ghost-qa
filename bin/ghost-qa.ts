#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { BrowserSession, smokeTestBrowser } from '../src/engine/browser-session.js';
import { InteractionRunner } from '../src/engine/interaction-runner.js';
import { RouteCrawler, pathOf, type DiscoveredRoute } from '../src/engine/route-crawler.js';
import { formatAgentDiagnostic, formatDiagnostic } from '../src/reporter/agent-diagnostic.js';
import { formatTerminalSummary } from '../src/reporter/terminal-summary.js';
import { ConsoleTrap } from '../src/traps/console-trap.js';
import { LayoutTrap } from '../src/traps/layout-trap.js';
import { NetworkTrap } from '../src/traps/network-trap.js';
import {
  DEFAULT_OPTIONS,
  dedupeIssues,
  makeIssue,
  summarise,
  type GhostQAOptions,
  type GhostQAReport,
  type IssueSeverity,
  type QAIssue,
  type RouteRecord,
  type ViewportName,
  type InteractionAction,
} from '../src/types.js';

export const VERSION = '1.0.0';

const PROTOCOL_START = '<!-- ghost-qa:start -->';
const PROTOCOL_END = '<!-- ghost-qa:end -->';

export const AGENT_PROTOCOL = `${PROTOCOL_START}
## 👻 ghost-qa — Browser Verification Protocol (MANDATORY)

Before reporting any task that touches frontend code as complete, you MUST verify it in a real browser:

1. Ensure the app is running locally (e.g. \`npm run dev\`).
2. Run: \`npx ghost-qa test <local-url>\` (e.g. \`npx ghost-qa test http://localhost:3000\`)
3. If ghost-qa reports ANY critical or major issue (hydration errors, console errors, 4xx/5xx responses, mobile overflow, broken interactions), fix the root cause in source and re-run.
4. Repeat until ghost-qa prints **PASS**. Only then may you tell the user the task is done.

Never declare a UI task finished based only on code review, type-checking, or unit tests. The browser is the source of truth.
${PROTOCOL_END}`;

const FALLBACK_SKILL = `# ghost-qa — Verify in Browser Before Done

You are a coding agent. Never report a frontend task complete without running it in a real browser.

## The Self-Healing Loop

1. Start (or reuse) the project's dev server.
2. Run \`npx ghost-qa test <local-url>\` — it crawls routes on desktop (1440×900) and mobile (390×844), traps console errors, hydration mismatches, failed requests, layout overflow and broken interactions.
3. Read the Self-Healing Bug Report. Fix every critical/major issue by \`#id\`, in source — never by suppressing the check.
4. Re-run \`npx ghost-qa test <local-url>\` until it prints PASS.
5. Only then report completion, mentioning that ghost-qa passed.

See https://github.com/avivgerz-hue/ghost-qa for flags (\`--max-depth\`, \`--max-routes\`, \`--json\`, \`--report\`).
`;

const HELP = `
👻 ghost-qa v${VERSION} — autonomous headless browser QA for coding agents

Usage:
  ghost-qa test <url> [options]    Crawl a running app and trap browser failures
  ghost-qa init [--force]          Install the agent skill + verification protocol
  ghost-qa doctor                  Check Node, Playwright and Chromium setup
  ghost-qa --help | --version

test options:
  --max-depth <n>        Link-following depth from the start URL (default ${DEFAULT_OPTIONS.maxDepth})
  --max-routes <n>       Maximum routes to visit (default ${DEFAULT_OPTIONS.maxRoutes})
  --timeout <ms>         Per-navigation timeout (default ${DEFAULT_OPTIONS.timeoutMs})
  --viewport <name>      both | desktop | mobile (default both)
  --no-interactions      Only load pages; do not click/fill anything
  --headed               Show the browser window (debugging)
  --fail-on <severity>   Fail on critical | major | minor (default ${DEFAULT_OPTIONS.failOn})
  --json                 Print the machine-readable JSON report to stdout
  --report <file>        Write the diagnostic to a file (.md or .json by extension)
  --quiet                Suppress the terminal summary (report/exit code only)

Examples:
  npx ghost-qa test http://localhost:3000
  npx ghost-qa test http://localhost:5173 --max-depth 3 --max-routes 40
  npx ghost-qa test http://localhost:3000 --json > report.json
  npx ghost-qa init
`;

function parsePositiveInt(value: string | undefined, flag: string): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} expects a positive integer, got "${value ?? ''}"`);
  }
  return parsed;
}

function parseNonNegativeInt(value: string | undefined, flag: string): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${flag} expects a non-negative integer, got "${value ?? ''}"`);
  }
  return parsed;
}

function parseTestArgs(args: string[]): { target: string; options: GhostQAOptions; json: boolean; quiet: boolean; reportFile?: string } {
  const options: GhostQAOptions = { ...DEFAULT_OPTIONS, viewports: [...DEFAULT_OPTIONS.viewports] };
  let target = '';
  let json = false;
  let quiet = false;
  let reportFile: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    switch (arg) {
      case '--max-depth':
        options.maxDepth = parseNonNegativeInt(args[++i], arg);
        break;
      case '--max-routes':
        options.maxRoutes = parsePositiveInt(args[++i], arg);
        break;
      case '--timeout':
        options.timeoutMs = parsePositiveInt(args[++i], arg);
        break;
      case '--viewport': {
        const value = args[++i];
        if (value === 'desktop' || value === 'mobile') options.viewports = [value];
        else if (value === 'both') options.viewports = ['desktop', 'mobile'];
        else throw new Error(`--viewport expects both|desktop|mobile, got "${value ?? ''}"`);
        break;
      }
      case '--no-interactions':
        options.interactions = false;
        break;
      case '--headed':
        options.headless = false;
        break;
      case '--fail-on': {
        const value = args[++i];
        if (value === 'critical' || value === 'major' || value === 'minor') options.failOn = value;
        else throw new Error(`--fail-on expects critical|major|minor, got "${value ?? ''}"`);
        break;
      }
      case '--json':
        json = true;
        break;
      case '--quiet':
        quiet = true;
        break;
      case '--report':
        reportFile = args[++i];
        if (!reportFile) throw new Error('--report expects a file path');
        break;
      default:
        if (arg.startsWith('--')) throw new Error(`Unknown flag: ${arg}`);
        if (!target) target = arg;
        else throw new Error(`Unexpected extra argument: ${arg}`);
    }
  }
  if (!target) throw new Error('Missing target URL. Usage: ghost-qa test <url>');
  return { target, options, json, quiet, ...(reportFile ? { reportFile } : {}) };
}

async function runTest(target: string, options: GhostQAOptions): Promise<GhostQAReport> {
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
        for (const href of await RouteCrawler.extractLinks(page)) discovered.add(href);

        if (options.interactions) {
          const result = await runner.run(page, route.path, viewport);
          interactions.push(...result.actions);
          rawIssues.push(...result.issues);
          for (const href of result.discoveredHrefs) discovered.add(href);
          // Interactions may have surfaced fresh console/network events.
          rawIssues.push(...(await layoutTrap.collect(page, route.path)));
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
    version: VERSION,
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

async function loadSkillTemplate(): Promise<string> {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(moduleDir, '../../SKILL.md'), // dist/bin -> package root
    resolve(moduleDir, '../SKILL.md'),
    resolve(process.cwd(), 'SKILL.md'),
  ];
  for (const candidate of candidates) {
    try {
      const content = await readFile(candidate, 'utf8');
      if (content.includes('ghost-qa')) return content;
    } catch {
      /* try next candidate */
    }
  }
  return FALLBACK_SKILL;
}

async function upsertProtocol(filePath: string): Promise<'created' | 'updated' | 'unchanged'> {
  let existing = '';
  try {
    existing = await readFile(filePath, 'utf8');
  } catch {
    await writeFile(filePath, `# Agent Instructions\n\n${AGENT_PROTOCOL}\n`, 'utf8');
    return 'created';
  }
  const start = existing.indexOf(PROTOCOL_START);
  const end = existing.indexOf(PROTOCOL_END);
  if (start !== -1 && end !== -1 && end > start) {
    const next = `${existing.slice(0, start)}${AGENT_PROTOCOL}${existing.slice(end + PROTOCOL_END.length)}`;
    if (next === existing) return 'unchanged';
    await writeFile(filePath, next, 'utf8');
    return 'updated';
  }
  await writeFile(filePath, `${existing.replace(/\s*$/, '')}\n\n${AGENT_PROTOCOL}\n`, 'utf8');
  return 'updated';
}

export async function installSkill(
  targetDir: string,
  force = false,
): Promise<Array<{ file: string; action: string }>> {
  const results: Array<{ file: string; action: string }> = [];
  const skillPath = join(targetDir, '.claude', 'skills', 'ghost-qa', 'SKILL.md');
  await mkdir(dirname(skillPath), { recursive: true });
  const skillContent = await loadSkillTemplate();
  const skillExisted = existsSync(skillPath);
  if (!skillExisted || force) {
    await writeFile(skillPath, skillContent.endsWith('\n') ? skillContent : `${skillContent}\n`, 'utf8');
    results.push({ file: '.claude/skills/ghost-qa/SKILL.md', action: skillExisted ? 'updated (--force)' : 'installed' });
  } else {
    results.push({ file: '.claude/skills/ghost-qa/SKILL.md', action: 'already exists (use --force to overwrite)' });
  }

  for (const name of ['CLAUDE.md', 'AGENTS.md', '.cursorrules']) {
    const action = await upsertProtocol(join(targetDir, name));
    results.push({ file: name, action: `protocol ${action}` });
  }
  return results;
}

async function runInit(args: string[]): Promise<number> {
  const force = args.includes('--force');
  const dirFlagIndex = args.indexOf('--dir');
  const targetDir = dirFlagIndex !== -1 ? resolve(args[dirFlagIndex + 1] ?? '.') : process.cwd();
  const results = await installSkill(targetDir, force);
  process.stdout.write(`\n👻 ghost-qa agent skill installed in ${targetDir}\n`);
  for (const result of results) {
    process.stdout.write(`  • ${result.file} — ${result.action}\n`);
  }
  process.stdout.write(
    '\nYour coding agent will now run `npx ghost-qa test <local-url>` and fix browser failures before reporting a task complete.\n',
  );
  return 0;
}

async function runDoctor(): Promise<number> {
  process.stdout.write(`\n👻 ghost-qa doctor v${VERSION}\n`);
  let ok = true;

  const nodeMajor = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);
  const nodeOk = nodeMajor >= 18;
  ok &&= nodeOk;
  process.stdout.write(`  ${nodeOk ? '✔' : '✖'} Node.js ${process.versions.node} ${nodeOk ? '' : '(requires >= 18.17)'}\n`);

  let chromiumPath = process.env.GHOST_QA_CHROMIUM_PATH ?? '';
  if (!chromiumPath) {
    try {
      chromiumPath = chromium.executablePath();
    } catch {
      chromiumPath = '';
    }
  }
  const chromiumOk = chromiumPath !== '' && existsSync(chromiumPath);
  if (chromiumOk) {
    process.stdout.write(`  ✔ Chromium binary: ${chromiumPath}\n`);
  } else {
    ok = false;
    process.stdout.write('  ✖ Chromium binary not found. Run: npx playwright install chromium\n');
  }

  if (chromiumOk) {
    const smoke = await smokeTestBrowser();
    ok &&= smoke.ok;
    process.stdout.write(`  ${smoke.ok ? '✔' : '✖'} Browser smoke test: ${smoke.detail}\n`);
  }

  process.stdout.write(ok ? '\n✔ ghost-qa is ready: npx ghost-qa test http://localhost:3000\n' : '\n✖ Setup incomplete — fix the items above.\n');
  return ok ? 0 : 1;
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const [command, ...rest] = argv;
  try {
    switch (command) {
      case 'test': {
        const { target, options, json, quiet, reportFile } = parseTestArgs(rest);
        const report = await runTest(target, options);
        if (reportFile) {
          const isJson = reportFile.endsWith('.json');
          await writeFile(resolve(reportFile), formatDiagnostic(report, isJson ? 'json' : 'markdown'), 'utf8');
        }
        if (json) {
          process.stdout.write(formatDiagnostic(report, 'json'));
        } else if (!quiet) {
          process.stdout.write(`${formatTerminalSummary(report)}\n`);
          if (!report.passed) {
            process.stdout.write(`\n${formatAgentDiagnostic(report)}\n`);
          } else if (reportFile) {
            process.stdout.write(`Report written to ${reportFile}\n`);
          }
        }
        return report.passed ? 0 : 1;
      }
      case 'init':
        return await runInit(rest);
      case 'doctor':
        return await runDoctor();
      case '--version':
      case '-v':
      case 'version':
        process.stdout.write(`ghost-qa ${VERSION}\n`);
        return 0;
      case '--help':
      case '-h':
      case 'help':
      case undefined:
        process.stdout.write(`${HELP}\n`);
        return 0;
      default:
        process.stderr.write(`Unknown command: ${command}\n${HELP}\n`);
        return 2;
    }
  } catch (error) {
    process.stderr.write(`\n👻 ghost-qa error: ${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
}

const invokedAsScript =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedAsScript) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      process.stderr.write(`ghost-qa crashed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
      process.exitCode = 2;
    },
  );
}
