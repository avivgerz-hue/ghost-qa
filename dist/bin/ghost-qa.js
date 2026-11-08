#!/usr/bin/env node
import { existsSync, realpathSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runGhostQAAudit, GHOST_QA_VERSION } from '../src/engine/audit-runner.js';
import { ManagedDevServer } from '../src/engine/server-lifecycle.js';
import { mcpServerConfig, runDoctorCheck, startMcpServer } from '../src/mcp/server.js';
import { formatAgentDiagnostic, formatDiagnostic } from '../src/reporter/agent-diagnostic.js';
import { formatHtmlReport } from '../src/reporter/html-report.js';
import { formatTerminalSummary } from '../src/reporter/terminal-summary.js';
import { DEFAULT_OPTIONS } from '../src/types.js';
export const VERSION = GHOST_QA_VERSION;
const PROTOCOL_START = '<!-- ghost-qa:start -->';
const PROTOCOL_END = '<!-- ghost-qa:end -->';
export const AGENT_PROTOCOL = `${PROTOCOL_START}
## 👻 ghost-qa — Browser Verification Protocol (MANDATORY)

Before reporting any task that touches frontend code as complete, you MUST verify it in a real browser:

1. Ensure the app is running locally (e.g. \`npm run dev\`).
2. Run: \`npx -y ghost-qa test <local-url>\` (e.g. \`npx -y ghost-qa test http://localhost:3000\`) — or call the \`ghost_qa_audit_url\` MCP tool if your host exposes it. Add \`--server-cmd "npm run dev"\` to let ghost-qa manage the dev server itself.
3. If ghost-qa reports ANY critical or major issue (hydration errors, console errors, 4xx/5xx responses, mobile overflow, accessibility or performance failures, broken interactions), fix the root cause in source and re-run.
4. Repeat until ghost-qa prints **PASS**. Only then may you tell the user the task is done.

Never declare a UI task finished based only on code review, type-checking, or unit tests. The browser is the source of truth.
${PROTOCOL_END}`;
const FALLBACK_SKILL = `# ghost-qa — Verify in Browser Before Done

You are a coding agent. Never report a frontend task complete without running it in a real browser — the browser is the source of truth, not your mental model of the DOM.

## The Self-Healing Loop

1. Run the audit against the final code:
   - Server already running: \`npx -y ghost-qa test <local-url>\`
   - Otherwise: \`npx -y ghost-qa test <local-url> --server-cmd "npm run dev"\` (ghost-qa spawns, awaits and tears down the server)
   - Or call the \`ghost_qa_audit_url\` MCP tool if your host exposes it (identical engine).
   It crawls routes on Desktop 1440x900 + Mobile 390x844 and runs the 5-Trap Engine: console/hydration, network, layout, accessibility, performance — plus safe interaction testing (never destructive controls).
2. Read the Self-Healing Bug Report. Fix every critical/major issue by \`#id\`, at the root cause in source — never silence the checker, delete failing UI, or add suppressHydrationWarning.
3. Re-run the identical command until it prints \`GHOST-QA PASS\`. If stuck on the same \`#id\` after 5 loops, report that honestly instead of declaring success.
4. Only then report completion, naming the URL verified, routes crawled, interactions tested, and issues fixed.

Useful flags: \`--max-depth\`, \`--max-routes\`, \`--viewport mobile\`, \`--json\`, \`--report <file>\`, \`--html <file>\`, \`--fail-on minor\`.
If Chromium is missing: \`npx playwright install chromium\`, then \`npx -y ghost-qa doctor\`.
Full skill: https://github.com/avivgerz-hue/ghost-qa/blob/main/SKILL.md
`;
const HELP = `
👻 ghost-qa v${VERSION} — autonomous headless browser QA for coding agents

Usage:
  ghost-qa test <url> [options]    Crawl a running app and trap browser failures
  ghost-qa init [--force]          Install the agent skill, protocol + MCP config
  ghost-qa mcp                     Run the native MCP server (JSON-RPC over stdio)
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
  --server-cmd <cmd>     Spawn this dev-server command first, wait for the URL,
                         run the audit, then terminate the server tree
  --server-timeout <ms>  How long to wait for --server-cmd to respond (default 30000)
  --json                 Print the machine-readable JSON report to stdout
  --report <file>        Write the diagnostic to a file (.md or .json by extension)
  --html <file>          Write the visual HTML evidence dashboard to a file
  --quiet                Suppress the terminal summary (report/exit code only)

Examples:
  npx -y ghost-qa test http://localhost:3000
  npx -y ghost-qa test http://localhost:3000 --server-cmd "npm run dev"
  npx -y ghost-qa test http://localhost:5173 --max-depth 3 --html ghost-qa-report.html
  npx -y ghost-qa test http://localhost:3000 --json > report.json
  npx -y ghost-qa init
  npx -y ghost-qa mcp

No npm? Every command also works straight from GitHub, e.g.
  npx -y github:avivgerz-hue/ghost-qa test http://localhost:3000
`;
function parsePositiveInt(value, flag) {
    const parsed = Number.parseInt(value ?? '', 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`${flag} expects a positive integer, got "${value ?? ''}"`);
    }
    return parsed;
}
function parseNonNegativeInt(value, flag) {
    const parsed = Number.parseInt(value ?? '', 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error(`${flag} expects a non-negative integer, got "${value ?? ''}"`);
    }
    return parsed;
}
export function parseTestArgs(args) {
    const options = { ...DEFAULT_OPTIONS, viewports: [...DEFAULT_OPTIONS.viewports] };
    let target = '';
    let json = false;
    let quiet = false;
    let reportFile;
    let htmlFile;
    let serverCmd;
    let serverTimeoutMs = 30_000;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
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
                if (value === 'desktop' || value === 'mobile')
                    options.viewports = [value];
                else if (value === 'both')
                    options.viewports = ['desktop', 'mobile'];
                else
                    throw new Error(`--viewport expects both|desktop|mobile, got "${value ?? ''}"`);
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
                if (value === 'critical' || value === 'major' || value === 'minor')
                    options.failOn = value;
                else
                    throw new Error(`--fail-on expects critical|major|minor, got "${value ?? ''}"`);
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
                if (!reportFile)
                    throw new Error('--report expects a file path');
                break;
            case '--html':
                htmlFile = args[++i];
                if (!htmlFile)
                    throw new Error('--html expects a file path');
                break;
            case '--server-cmd':
                serverCmd = args[++i];
                if (!serverCmd)
                    throw new Error('--server-cmd expects a command, e.g. --server-cmd "npm run dev"');
                break;
            case '--server-timeout':
                serverTimeoutMs = parsePositiveInt(args[++i], arg);
                break;
            default:
                if (arg.startsWith('--'))
                    throw new Error(`Unknown flag: ${arg}`);
                if (!target)
                    target = arg;
                else
                    throw new Error(`Unexpected extra argument: ${arg}`);
        }
    }
    if (!target)
        throw new Error('Missing target URL. Usage: ghost-qa test <url>');
    return {
        target,
        options,
        json,
        quiet,
        serverTimeoutMs,
        ...(reportFile ? { reportFile } : {}),
        ...(htmlFile ? { htmlFile } : {}),
        ...(serverCmd ? { serverCmd } : {}),
    };
}
async function executeTest(parsed) {
    const audit = () => runGhostQAAudit(parsed.target, parsed.options);
    if (!parsed.serverCmd)
        return audit();
    const server = new ManagedDevServer(parsed.serverCmd);
    process.stderr.write(`\n👻 ghost-qa: starting dev server: ${parsed.serverCmd}\n`);
    server.start();
    try {
        await server.waitUntilReady(parsed.target, parsed.serverTimeoutMs);
        process.stderr.write(`👻 ghost-qa: server is responding at ${parsed.target}\n`);
        return await audit();
    }
    finally {
        await server.stop();
        process.stderr.write('👻 ghost-qa: dev server terminated.\n');
    }
}
async function loadSkillTemplate() {
    const moduleDir = dirname(fileURLToPath(import.meta.url));
    const candidates = [
        resolve(moduleDir, '../../SKILL.md'), // dist/bin -> package root
        resolve(moduleDir, '../SKILL.md'),
        resolve(process.cwd(), 'SKILL.md'),
    ];
    for (const candidate of candidates) {
        try {
            const content = await readFile(candidate, 'utf8');
            if (content.includes('ghost-qa'))
                return content;
        }
        catch {
            /* try next candidate */
        }
    }
    return FALLBACK_SKILL;
}
async function upsertProtocol(filePath) {
    let existing = '';
    try {
        existing = await readFile(filePath, 'utf8');
    }
    catch {
        await writeFile(filePath, `# Agent Instructions\n\n${AGENT_PROTOCOL}\n`, 'utf8');
        return 'created';
    }
    const start = existing.indexOf(PROTOCOL_START);
    const end = existing.indexOf(PROTOCOL_END);
    if (start !== -1 && end !== -1 && end > start) {
        const next = `${existing.slice(0, start)}${AGENT_PROTOCOL}${existing.slice(end + PROTOCOL_END.length)}`;
        if (next === existing)
            return 'unchanged';
        await writeFile(filePath, next, 'utf8');
        return 'updated';
    }
    await writeFile(filePath, `${existing.replace(/\s*$/, '')}\n\n${AGENT_PROTOCOL}\n`, 'utf8');
    return 'updated';
}
export async function installSkill(targetDir, force = false) {
    const results = [];
    const skillPath = join(targetDir, '.claude', 'skills', 'ghost-qa', 'SKILL.md');
    await mkdir(dirname(skillPath), { recursive: true });
    const skillContent = await loadSkillTemplate();
    const skillExisted = existsSync(skillPath);
    if (!skillExisted || force) {
        await writeFile(skillPath, skillContent.endsWith('\n') ? skillContent : `${skillContent}\n`, 'utf8');
        results.push({ file: '.claude/skills/ghost-qa/SKILL.md', action: skillExisted ? 'updated (--force)' : 'installed' });
    }
    else {
        results.push({ file: '.claude/skills/ghost-qa/SKILL.md', action: 'already exists (use --force to overwrite)' });
    }
    for (const name of ['CLAUDE.md', 'AGENTS.md', '.cursorrules']) {
        const action = await upsertProtocol(join(targetDir, name));
        results.push({ file: name, action: `protocol ${action}` });
    }
    const mcpAction = await installMcpConfig(join(targetDir, '.mcp.json'), force);
    results.push({ file: '.mcp.json', action: mcpAction });
    return results;
}
/**
 * Writes (or merges into) `.mcp.json`, preserving any MCP servers the
 * project already configured. The ghost-qa entry is always refreshed so
 * hosts invoke the published CLI: `npx -y ghost-qa mcp`.
 */
export async function installMcpConfig(mcpJsonPath, force = false) {
    const desired = mcpServerConfig();
    let existing = {};
    let action = 'installed';
    try {
        const raw = await readFile(mcpJsonPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            existing = parsed;
            action = 'merged';
        }
    }
    catch {
        action = 'installed';
    }
    const servers = (existing.mcpServers ?? {});
    const previous = servers['ghost-qa'];
    if (previous && !force && JSON.stringify(previous) === JSON.stringify(desired.mcpServers['ghost-qa'])) {
        return 'already configured';
    }
    servers['ghost-qa'] = desired.mcpServers['ghost-qa'];
    existing.mcpServers = servers;
    await writeFile(mcpJsonPath, `${JSON.stringify(existing, null, 2)}\n`, 'utf8');
    return previous ? 'updated' : action;
}
async function runInit(args) {
    const force = args.includes('--force');
    const dirFlagIndex = args.indexOf('--dir');
    const targetDir = dirFlagIndex !== -1 ? resolve(args[dirFlagIndex + 1] ?? '.') : process.cwd();
    const results = await installSkill(targetDir, force);
    process.stdout.write(`\n👻 ghost-qa agent skill installed in ${targetDir}\n`);
    for (const result of results) {
        process.stdout.write(`  • ${result.file} — ${result.action}\n`);
    }
    process.stdout.write('\nYour coding agent will now run `npx -y ghost-qa test <local-url>` and fix browser failures before reporting a task complete.\n' +
        'MCP hosts (Claude Code, Claude Desktop, Cursor, Codex) can also call the ghost_qa_audit_url / ghost_qa_doctor tools directly via the .mcp.json entry above.\n');
    return 0;
}
async function runDoctor() {
    process.stdout.write(`\n👻 ghost-qa doctor v${VERSION}\n`);
    const result = await runDoctorCheck();
    process.stdout.write(`  ${result.nodeOk ? '✔' : '✖'} Node.js ${result.node} ${result.nodeOk ? '' : '(requires >= 20)'}\n`);
    if (result.chromiumFound) {
        process.stdout.write(`  ✔ Chromium binary: ${result.chromiumPath}\n`);
        const smokeOk = result.smokeTest.startsWith('Chromium launched');
        process.stdout.write(`  ${smokeOk ? '✔' : '✖'} Browser smoke test: ${result.smokeTest}\n`);
    }
    else {
        process.stdout.write('  ✖ Chromium binary not found. Run: npx playwright install chromium\n');
    }
    process.stdout.write(result.ready
        ? '\n✔ ghost-qa is ready: npx -y ghost-qa test http://localhost:3000\n'
        : '\n✖ Setup incomplete — fix the items above.\n');
    return result.ready ? 0 : 1;
}
export async function main(argv = process.argv.slice(2)) {
    const [command, ...rest] = argv;
    try {
        switch (command) {
            case 'test': {
                const parsed = parseTestArgs(rest);
                const report = await executeTest(parsed);
                if (parsed.reportFile) {
                    const isJson = parsed.reportFile.endsWith('.json');
                    await writeFile(resolve(parsed.reportFile), formatDiagnostic(report, isJson ? 'json' : 'markdown'), 'utf8');
                }
                if (parsed.htmlFile) {
                    await writeFile(resolve(parsed.htmlFile), formatHtmlReport(report), 'utf8');
                }
                if (parsed.json) {
                    process.stdout.write(formatDiagnostic(report, 'json'));
                }
                else if (!parsed.quiet) {
                    process.stdout.write(`${formatTerminalSummary(report)}\n`);
                    if (!report.passed) {
                        process.stdout.write(`\n${formatAgentDiagnostic(report)}\n`);
                    }
                    if (parsed.reportFile)
                        process.stdout.write(`Report written to ${parsed.reportFile}\n`);
                    if (parsed.htmlFile)
                        process.stdout.write(`HTML evidence report written to ${parsed.htmlFile}\n`);
                }
                return report.passed ? 0 : 1;
            }
            case 'mcp':
                await startMcpServer();
                return 0;
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
    }
    catch (error) {
        process.stderr.write(`\n👻 ghost-qa error: ${error instanceof Error ? error.message : String(error)}\n`);
        return 2;
    }
}
/**
 * True when this module is the process entry point. The entry path MUST be
 * realpath-resolved first: package managers invoke bins through a
 * `node_modules/.bin/ghost-qa` symlink, while `import.meta.url` always
 * points at the real file — comparing unresolved paths would make the CLI
 * silently no-op (exit 0, no output) under `npx`.
 */
export function isMainEntry(argvEntry, moduleUrl = import.meta.url) {
    if (!argvEntry)
        return false;
    try {
        return moduleUrl === pathToFileURL(realpathSync(resolve(argvEntry))).href;
    }
    catch {
        return false;
    }
}
if (isMainEntry(process.argv[1])) {
    main().then((code) => {
        process.exitCode = code;
    }, (error) => {
        process.stderr.write(`ghost-qa crashed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
        process.exitCode = 2;
    });
}
//# sourceMappingURL=ghost-qa.js.map