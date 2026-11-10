# 👻 ghost-qa

**Autonomous headless browser QA & self-healing verification loop for coding agents.** `v2.1.1` — the 8-Trap Deep Browser Inspection Engine: 3 viewports × light/dark, QA Health Score (A+…F), interactive HTML dashboard, and regression diffing.

[![CI](https://github.com/avivgerz-hue/ghost-qa/actions/workflows/ci.yml/badge.svg)](https://github.com/avivgerz-hue/ghost-qa/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/ghost-qa.svg)](https://www.npmjs.com/package/ghost-qa)
[![npm downloads](https://img.shields.io/npm/dm/ghost-qa.svg)](https://www.npmjs.com/package/ghost-qa)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)
[![Powered by Playwright](https://img.shields.io/badge/powered%20by-Playwright-45ba4b.svg)](https://playwright.dev)

> ⭐ **If this tool helps your AI coding workflow, please give this repository a Star!** It helps more developers discover the project.

### 🧰 The VibeFoundry Agent Suite

*One command each — star all three and keep the whole suite free & maintained:*

- 🎨 **[unslop](https://github.com/avivgerz-hue/unslop)** — UI Design DNA & Anti-Slop Engine (`npx -y unslop-mcp@latest init`)
- 🛡️ **[vibe-shield](https://github.com/avivgerz-hue/vibe-shield)** — Security Scanner for AI Code (`npx -y @vibefoundry/vibe-shield@latest scan .`)
- 👻 **[ghost-qa](https://github.com/avivgerz-hue/ghost-qa)** — Autonomous Headless Browser QA (`npx -y ghost-qa@latest test http://localhost:3000`)

![Live Terminal Demo](assets/demo.svg)

```bash
npx -y ghost-qa@latest test http://localhost:3000
```

![ghost-qa terminal preview](./assets/hero-terminal.svg)

Coding agents (Claude Code, Codex, Cursor, Windsurf) write code **blind** — then declare victory while the actual browser has React hydration errors, broken buttons, 500ing APIs, or mobile layout overflow.

`ghost-qa` fixes that. One command launches a headless browser against your running app, crawls the live DOM, safely pokes every button, traps runtime/network/layout failures, and hands the agent a structured **Self-Healing Bug Report** so it fixes its own bugs *before* telling you it's done.

```bash
npx -y ghost-qa test http://localhost:3000
```

No test scripts. No config. No mercy for "it works on my machine".

> Prefer running straight from GitHub instead of npm? `npx -y github:avivgerz-hue/ghost-qa test http://localhost:3000` works identically — every command in this README accepts either package source (`ghost-qa mcp`, `ghost-qa init`, …).

---

## ⚡ Quickstart

```bash
# 1. Start your app as usual
npm run dev            # → http://localhost:3000

# 2. Verify it in a real browser (one-time: downloads Chromium)
npx playwright install chromium
npx -y ghost-qa test http://localhost:3000

# 3. Teach your coding agent to do this automatically, forever
npx -y ghost-qa init
```

`ghost-qa init` installs `.claude/skills/ghost-qa/SKILL.md` and appends the strict **"Verify in Browser Before Done"** protocol to `CLAUDE.md`, `AGENTS.md`, and `.cursorrules`. From then on, your agent runs ghost-qa itself, fixes what it finds, and only reports completion on a PASS.

---

## 🔁 The Autonomous Self-Healing QA Loop

```
                        ┌──────────────────────────────────────────┐
                        │            CODING AGENT                   │
                        │  Claude Code · Codex · Cursor · Windsurf  │
                        └───┬──────────────────────────────▲───────┘
              writes code   │                                │  Self-Healing
                            ▼                                │  Bug Report
                    ┌───────────────┐              ┌─────────┴──────────┐
                    │   DEV SERVER   │              │  AGENT DIAGNOSTIC   │
                    │ localhost:3000 │              │  verdict · #ids ·   │
                    └───────┬───────┘              │  fix playbook       │
                            │ serves live DOM      └─────────▲──────────┘
                            ▼                                │ Markdown / JSON
                    ┌────────────────────────────────────────┴──────────┐
                    │                   👻 ghost-qa                      │
                    │                                                    │
                    │   Route Crawler ──► Interaction Runner             │
                    │        │                    │                      │
                    │        ▼                    ▼                      │
                    │   ┌─────────┐  ┌──────────┐  ┌─────────┐          │
                    │   │ CONSOLE │  │ NETWORK  │  │ LAYOUT  │          │
                    │   │  A11Y   │  │  PERF    │  │ 8 TRAPS │          │
                    │   │  TRAP   │  │  TRAP    │  │  TRAP   │          │
                    │   └─────────┘  └──────────┘  └─────────┘          │
                    │   Desktop 1440×900 · Tablet 768×1024 · Mobile 375×812 │
                    └────────────────────────────────────────────────────┘
                                          │
                          fix bugs ───────┘  re-run until ✔ PASS
```

1. The agent writes code and starts the dev server.
2. `ghost-qa test` crawls every internal route on **Desktop 1440×900, Tablet 768×1024 and Mobile 375×812**, in **light + dark** colour schemes, exercising interactive controls.
3. Eight traps capture everything the browser actually experienced, scored into a deterministic **QA Health Score (0–100, Grade A+…F)**.
4. Failures return as a token-efficient diagnostic (`GHOST-QA-REPORT.md` + `PATCH-PROMPT.md` with exact selectors); the agent fixes root causes and re-runs.
5. `ghost-qa compare before.json after.json` proves the fix: the loop ends only at **score 95–100 (A+)**, zero critical/major remaining, and **zero new regressions**.

---

## 🪤 The 8-Trap Deep Browser Inspection Engine *(v2.0.0)*

### 1. Console & Framework Runtime Trap — `src/traps/console-trap.ts`
- Uncaught `pageerror` exceptions with stack traces
- Unhandled promise rejections
- **React hydration mismatches** ("Text content did not match", "A tree hydrated but…")
- **Duplicate-key warnings** and **Content-Security-Policy violations** *(new in v2)*
- `console.error` (major) and `console.warning` (minor) — with dev-server noise (`[vite]`, HMR, React DevTools banners) filtered out

### 2. Network & Asset Integrity Trap — `src/traps/network-trap.ts`
- HTTP `5xx` API crashes (critical) and `4xx` responses (major)
- Failed `fetch`/`XHR` requests, **timed-out requests**, and connection failures
- **CORS-blocked requests and failed CORS preflights** with remediation guidance
- Broken static assets, broken images (`naturalWidth === 0`), **broken inline SVGs (0×0)**, **>500KB unoptimized payloads**, and missing favicons (minor)

### 3. Layout, Responsive Geometry & Collision Trap — `src/traps/layout-trap.ts`
- **Horizontal overflow**: `scrollWidth > innerWidth`, with the offending elements named (critical on mobile)
- **Overlapping interactive elements** via bounding-box collision math, with exact selectors + boxes *(new in v2)*
- **Touch targets < 44×44px** on touch viewports (WCAG 2.5.5 / Apple HIG), **clipped text**, and **off-screen interactives** *(new in v2)*
- Zero-dimension interactive elements — buttons rendered at 0×0 that no human could tap
- Missing `<meta name="viewport">` on mobile

### 4. Accessibility (WCAG 2.1 AA) & Keyboard Focus Trap — `src/traps/a11y-trap.ts`
- Buttons and links with **no accessible name** (icon-only controls screen readers can't identify)
- Images **missing `alt`** attributes (descriptive alt, or `alt=""` for decorative)
- Form inputs with **no associated label** — a placeholder is not a label
- **Real computed contrast ratios** (`getComputedStyle` foreground vs effective background, WCAG formula) *(new in v2)*
- **Heading hierarchy** (missing `<h1>`, h1→h3 skips) and **automated Tab-order verification** — simulated Tab presses catch invisible or dead focus states *(new in v2)*
- Missing document `<title>` and missing `<html lang>`

### 5. Performance & Core Web Vitals Trap — `src/traps/perf-trap.ts`
- **Core Web Vitals**: TTFB, FCP, LCP estimation, and CLS (Cumulative Layout Shift) *(new in v2)*
- Slow page loads via Navigation Timing (DOMContentLoaded / load budgets, 2× = critical)
- **Oversized resources** (> 1MB single asset), **unoptimized >500KB images/scripts**, and excessive total payload (> 3MB)
- Main-thread jank / layout-thrashing indicators from the Long Tasks API
- Render-blocking `<head>` resources, excessive DOM size (>1500 nodes) and **DOM depth > 32**

### 6. Safe Interactive & Link Integrity Trap — `src/traps/links-trap.ts` *(new in v2)*
- Placeholder links (`href=""`, `href="#"`, `javascript:void(0)`) and **dead anchors/routes** found during crawling
- Buttons inside `<form>` with **no `type`** (they silently become submit buttons)
- Disabled/stuck interactive controls — all observational, this trap never clicks anything

### 7. SEO, Metadata & Social Graph Trap — `src/traps/seo-trap.ts` *(new in v2)*
- `<title>` (missing, <10 or >60 chars), meta description, `<html lang>`, viewport meta, canonical tag
- OpenGraph set (`og:title`, `og:description`, `og:image`) for link unfurls
- **Duplicate `id` attributes** in the live, post-hydration DOM

### 8. Dark / Light Theme Emulation Trap — `src/traps/theme-trap.ts` *(new in v2)*
- Every page also renders under `colorScheme: 'dark'` and `'light'` emulation
- Computed contrast is re-evaluated per scheme — invisible dark-mode text (dark-on-dark) is caught automatically and tagged with the failing scheme

Plus a **safety-first Interaction Runner**: it fills forms with inert data (`ghost-qa@example.com`), opens tabs/modals/menus, and clicks ordinary buttons — but *never* destructive ones (`delete`, `checkout`, `pay`, `logout`, `publish`… are blocked by a tested safety gate).

---

## 📊 QA Health Score, Artifacts & Interactive Dashboard *(new in v2)*

Every run computes a deterministic **QA Health Score (0–100)** and **Letter Grade (A+ … F)**: each trap starts at 100 and loses 25 per critical, 10 per major, 3 per minor finding; the overall score is the mean of the eight trap sub-scores (Console, Network, Layout, A11y, Performance, Links/UX, SEO/DOM, Theme Parity).

```bash
npx -y ghost-qa test http://localhost:3000 --out-dir ghost-qa-out --screenshots
```

| Artifact | Contents |
| --- | --- |
| `report.json` | Complete machine-readable telemetry: per-trap scores, viewport matrices, exact DOM selectors (`#id`, `data-testid`, CSS path) and bounding boxes |
| `GHOST-QA-REPORT.md` | Human + agent Self-Healing Bug Report with root-cause analysis and the fix playbook |
| `PATCH-PROMPT.md` | Copy-paste remediation prompt: every finding with selector, bounding box, parent-component hints and the compare loop |
| `report.html` | Self-contained, zero-dependency, dark-mode **interactive QA Dashboard**: Grade hero (A+…F), 8-Trap Scorecard, Route & Viewport Matrix, filterable findings (severity/trap/viewport), embedded screenshots when captured |

## 🔀 Regression Diffing — `ghost-qa compare` / `ghost_qa_compare` *(new in v2)*

```bash
npx -y ghost-qa test http://localhost:3000 --json > before.json   # baseline
# …agent fixes the bugs…
npx -y ghost-qa test http://localhost:3000 --json > after.json    # re-audit
npx -y ghost-qa compare before.json after.json                    # Regression & Verification Delta Report
```

The delta matches findings by stable fingerprint id and reports **`scoreDelta`, `fixedFindings`, `newRegressions`, `remainingFindings`** — so a coding agent can *prove* its fix resolved the bug without introducing regressions. `verified` requires score ≥ 95, zero regressions and no blocking findings left. Also available as the `ghost_qa_compare` MCP tool.

---

## 🔌 Native MCP Server

ghost-qa ships a zero-dependency **Model Context Protocol** server (JSON-RPC 2.0 over stdio), so MCP hosts can invoke browser verification as a native tool instead of shelling out:

```bash
npx -y ghost-qa mcp
```

| MCP tool | What it does |
| --- | --- |
| `ghost_qa_audit_url` | Runs the full 8-trap deep inspection (3 viewports × light/dark) and returns the Self-Healing Bug Report + QA Health Score (structured content includes the full report for baselining) |
| `ghost_qa_compare` | *(new in v2)* Diffs two report JSONs into the Regression & Verification Delta Report (`scoreDelta`, `fixedFindings`, `newRegressions`, `remainingFindings`) |
| `ghost_qa_doctor` | Verifies Node, Chromium availability, and runs a live browser smoke test |

`npx -y ghost-qa init` writes the ready-to-use `.mcp.json` entry for you (merging with any servers you already have):

```json
{ "mcpServers": { "ghost-qa": { "command": "npx", "args": ["-y", "ghost-qa", "mcp"] } } }
```

Works with Claude Code, Claude Desktop, Cursor, Codex — any MCP host.

**Docker / Glama:** the repo ships a production `Dockerfile` whose entrypoint is the MCP server (`node dist/bin/ghost-qa.js mcp`). Registry introspection (`initialize` + `tools/list` over stdio) answers instantly with no Chromium present — a browser is only launched when a tool is actually called:

```bash
docker build -t ghost-qa .
docker run -i ghost-qa   # MCP JSON-RPC over stdin/stdout
```

---

## 🖥️ Zero-lifecycle testing with `--server-cmd` *(new in v1.1.0)*

Don't even start the dev server yourself — ghost-qa will spawn it, wait for the URL to respond, audit, and terminate the whole process tree afterward:

```bash
npx -y ghost-qa test http://localhost:3000 --server-cmd "npm run dev"
```

Pair it with `--html ghost-qa-report.html` for a self-contained, dark-mode **visual evidence dashboard** (routes, interactions, every trap finding per viewport) you can attach to CI artifacts or PRs.

---

## 📟 Example output

```
👻 ghost-qa — autonomous browser verification
Target: http://localhost:3000/
Duration: 14.2s · Viewports: desktop + tablet + mobile · Schemes: light + dark · Depth: 2

Routes crawled
  /                            Home                 [200] 3 issues
  /pricing                     Pricing              [200] ✓
  /dashboard                   Dashboard            [200] 2 issues

Coverage
  Routes visited:       3
  Interactions tested:  21 passed · 1 failed · 4 skipped (safety)
  Issues:               5 total — 2 critical, 3 major, 0 minor
  QA Health Score:      62/100 — Grade D (8 traps · per-trap: console 65 · network 75 · layout 90 · a11y 100 · perf 100 · links 100 · seo 100 · theme 65)

Failures caught
  ✖ CRITICAL [console] React hydration mismatch: Text content did not match…
      ↳ / · desktop · #a91f03cc
  ✖ CRITICAL [network] Server error HTTP 500 for /api/users — backend/API is crashing on this route.
      ↳ /dashboard · mobile · #51bd77e0
  ▲ MAJOR [layout] Horizontal overflow on mobile: page scrolls sideways by 130px…
      ↳ / · mobile · #c04d19aa

✖ GHOST-QA FAIL — blocking browser failures found. Fix them and re-run before reporting done.
```

The agent-facing report (`--report ghost-qa-report.md`) groups the same bugs by route with a per-category fix playbook and the exact re-run command.

---

## 🚀 CLI reference

| Command | Description |
| --- | --- |
| `ghost-qa test <url>` | Crawl a running app and trap browser failures. Exit `0` = PASS, `1` = blocking issues, `2` = runner error |
| `ghost-qa init [--force]` | Install `.claude/skills/ghost-qa/SKILL.md`, verification protocol (`CLAUDE.md`, `AGENTS.md`, `.cursorrules`) + MCP config (`.mcp.json`) — all idempotent |
| `ghost-qa compare <before.json> <after.json>` | Regression & Verification Delta Report between two report JSONs. Exit `1` if new regressions appeared |
| `ghost-qa mcp` | Run the native MCP server (JSON-RPC 2.0 over stdio) exposing `ghost_qa_audit_url`, `ghost_qa_compare` and `ghost_qa_doctor` |
| `ghost-qa doctor` | Diagnose Node ≥ 20, Playwright and Chromium setup, with a live browser smoke test |
| `ghost-qa --version` / `--help` | Version / usage |

### `test` flags

| Flag | Default | Description |
| --- | --- | --- |
| `--max-depth <n>` | `2` | Link-following depth from the start URL |
| `--max-routes <n>` | `25` | Maximum routes to visit |
| `--timeout <ms>` | `15000` | Per-navigation timeout |
| `--viewport <name>` | `all` | `all` \| `both` (desktop+mobile) \| `desktop` \| `tablet` \| `mobile` |
| `--color-scheme <name>` | `both` | `both` \| `light` \| `dark` — colour schemes emulated per viewport |
| `--screenshots` | off | Capture a screenshot per route/viewport for the HTML dashboard |
| `--out-dir <dir>` | — | Write `report.json` + `GHOST-QA-REPORT.md` + `PATCH-PROMPT.md` + `report.html` into this directory |
| `--no-interactions` | off | Load pages only; don't click or fill anything |
| `--headed` | off | Show the browser window (debugging) |
| `--fail-on <severity>` | `major` | Exit 1 on `critical` \| `major` \| `minor` issues |
| `--json` | off | Print the full machine-readable JSON report to stdout |
| `--report <file>` | — | Write diagnostic to a file (Markdown, or JSON if the name ends `.json`) |
| `--html <file>` | — | Write the self-contained dark-mode HTML visual evidence dashboard |
| `--server-cmd <cmd>` | — | Spawn a dev server, wait for the URL, audit, then terminate the server tree |
| `--server-timeout <ms>` | `30000` | How long to wait for `--server-cmd` to start responding |
| `--quiet` | off | Suppress the terminal summary (report file + exit code only) |

Works with any stack that serves HTML on localhost — Next.js, Vite, Remix, Astro, Create React App, plain static servers, Rails, Django… if a browser can open it, ghost-qa can judge it.

---

## 🤖 The Agent Skill

`SKILL.md` (repo root) is the master **Staff QA Engineer Protocol**. One command — `npx -y ghost-qa init` — connects it, plus the 8-trap MCP server, into every major coding agent in its native dialect. All writes are idempotent (marker-delimited protocol blocks, JSON merges that preserve your existing servers/settings):

## 🔌 Supported Coding Agents (Claude Code, OpenCode, Codex, Cursor, Windsurf, Copilot, Cline, Zed)

| Agent | What `ghost-qa init` installs |
| --- | --- |
| **Claude Code** | `.mcp.json`, `CLAUDE.md`, `.claude/skills/ghost-qa/SKILL.md`, `.claude-plugin/plugin.json` |
| **OpenCode** | `opencode.json` (`mcp` → ghost-qa), `AGENTS.md` |
| **OpenAI Codex CLI & universal agents** | `AGENTS.md`, `.agents/skills/ghost-qa/SKILL.md` |
| **Cursor** | `.cursor/mcp.json`, `.cursor/rules/ghost-qa.mdc`, `.cursorrules` |
| **Windsurf** | `.windsurfrules` |
| **VS Code / GitHub Copilot** | `.vscode/mcp.json`, `.github/copilot-instructions.md` |
| **Cline / Roo Code** | `.clinerules` |
| **Zed** | `.zed/settings.json` (`context_servers` → ghost-qa) |

Every dialect wires the same MCP command (`npx -y ghost-qa mcp`) and the same 5-phase protocol: doctor → baseline audit → DOM-to-source mapping → remediation → `ghost_qa_compare` delta verification until QA Health Score 95–100. This repo dogfoods it: root `AGENTS.md`, `CLAUDE.md`, `opencode.json`, and `.claude-plugin/plugin.json` are committed, so Claude Code, OpenCode, and Codex CLI auto-discover ghost-qa here immediately.

## ⚖️ Scope & limitations (read this — we mean it)

ghost-qa is a **local development verification tool**, and we'd rather be honest than viral:

- **Not a WCAG audit.** The Accessibility Trap catches common machine-checkable failures (names, alt, labels, title, lang). Full WCAG conformance still needs assistive-technology testing.
- **Not a replacement for your test suite.** It complements unit/E2E tests by checking the *live* app the way a browser experiences it — it writes no persistent tests for you.
- **Heuristic safety.** The Interaction Runner refuses destructive-looking controls (delete, checkout, pay, logout…) and fills only inert data, but "destructive" is ultimately a word list. It is designed for localhost dev servers.
- **Auth-gated apps.** Without credentials, ghost-qa audits what an anonymous visitor sees (often the login page). Authenticated crawling is on the roadmap, not in the box today.
- **Performance numbers are local-machine heuristics.** Borderline perf findings on a loaded CI box deserve a re-run, not a panic.
- **Never point it at production systems or sites you don't own** or have explicit permission to test. It clicks real buttons.
- The MCP server is **stdio-only** (no network ports). Only wire it into MCP hosts you trust.

Found a trap flagging a healthy page? That's our most valuable issue type — [file it with the report attached](https://github.com/avivgerz-hue/ghost-qa/issues/new/choose). Security reports: see [SECURITY.md](./SECURITY.md). Release history: [CHANGELOG.md](./CHANGELOG.md).

## 🧑‍💻 Development

```bash
npm install
npx playwright install chromium
npm run build     # tsc → dist/
npm test          # Vitest: trap evaluators, crawler policy, safety gate, reporters
node dist/bin/ghost-qa.js doctor
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the "pure evaluator first" architecture rules.

## 📄 License

MIT © VibeFoundry — see [LICENSE](./LICENSE).

---

## Part of the VibeFoundry Agent Suite

| Tool | Description |
| --- | --- |
| 🎨 [unslop](https://github.com/avivgerz-hue/unslop) | Studio-grade UI design systems & Anti-Slop engine for coding agents. |
| 🛡️ [vibe-shield](https://github.com/avivgerz-hue/vibe-shield) | Automated security scanner & MCP guard for AI-generated codebases. |
| 👻 [ghost-qa](https://github.com/avivgerz-hue/ghost-qa) | Autonomous headless browser QA & self-healing verification loop. |
