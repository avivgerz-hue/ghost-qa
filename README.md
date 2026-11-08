# 👻 ghost-qa

**Autonomous headless browser QA & self-healing verification loop for coding agents.**

[![CI](https://github.com/avivgerz-hue/ghost-qa/actions/workflows/ci.yml/badge.svg)](https://github.com/avivgerz-hue/ghost-qa/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/ghost-qa.svg)](https://www.npmjs.com/package/ghost-qa)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)
[![Powered by Playwright](https://img.shields.io/badge/powered%20by-Playwright-45ba4b.svg)](https://playwright.dev)

Coding agents (Claude Code, Codex, Cursor, Windsurf) write code **blind** — then declare victory while the actual browser has React hydration errors, broken buttons, 500ing APIs, or mobile layout overflow.

`ghost-qa` fixes that. One command launches a headless browser against your running app, crawls the live DOM, safely pokes every button, traps runtime/network/layout failures, and hands the agent a structured **Self-Healing Bug Report** so it fixes its own bugs *before* telling you it's done.

```bash
npx github:avivgerz-hue/ghost-qa test http://localhost:3000
```

No test scripts. No config. No mercy for "it works on my machine".

---

## ⚡ Quickstart

```bash
# 1. Start your app as usual
npm run dev            # → http://localhost:3000

# 2. Verify it in a real browser (one-time: downloads Chromium)
npx playwright install chromium
npx github:avivgerz-hue/ghost-qa test http://localhost:3000

# 3. Teach your coding agent to do this automatically, forever
npx github:avivgerz-hue/ghost-qa init
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
                    │   │  A11Y   │  │  PERF    │  │ 5 TRAPS │          │
                    │   │  TRAP   │  │  TRAP    │  │  TRAP   │          │
                    │   └─────────┘  └──────────┘  └─────────┘          │
                    │   Desktop 1440×900  +  Mobile 390×844 (iPhone)     │
                    └────────────────────────────────────────────────────┘
                                          │
                          fix bugs ───────┘  re-run until ✔ PASS
```

1. The agent writes code and starts the dev server.
2. `ghost-qa test` crawls every internal route on **desktop + mobile**, exercising interactive controls.
3. Five traps capture everything the browser actually experienced.
4. Failures return as a token-efficient diagnostic; the agent fixes the root causes and re-runs.
5. The loop ends only at **PASS** — that's when the agent may tell you it's done.

---

## 🪤 The 5-Trap Engine

### 1. Console Trap — `src/traps/console-trap.ts`
- Uncaught `pageerror` exceptions with stack traces
- Unhandled promise rejections
- **React hydration mismatches** ("Text content did not match", "A tree hydrated but…")
- `console.error` (major) and `console.warning` (minor) — with dev-server noise (`[vite]`, HMR, React DevTools banners) filtered out

### 2. Network Trap — `src/traps/network-trap.ts`
- HTTP `5xx` API crashes (critical) and `4xx` responses (major)
- Failed `fetch`/`XHR` requests and connection failures
- **CORS-blocked requests** with remediation guidance
- Broken static assets (JS/CSS/images/fonts) and missing favicons (minor)

### 3. Layout Trap — `src/traps/layout-trap.ts`
- **Horizontal overflow**: `scrollWidth > innerWidth`, with the offending elements named (critical on mobile)
- Zero-dimension interactive elements — buttons rendered at 0×0 that no human could tap
- Broken images (`naturalWidth === 0`)
- Missing `<meta name="viewport">` on mobile

### 4. Accessibility Trap — `src/traps/a11y-trap.ts` *(new in v1.1.0)*
- Buttons and links with **no accessible name** (icon-only controls screen readers can't identify)
- Images **missing `alt`** attributes (descriptive alt, or `alt=""` for decorative)
- Form inputs with **no associated label** — a placeholder is not a label
- Missing document `<title>` and missing `<html lang>`

### 5. Performance & Asset Trap — `src/traps/perf-trap.ts` *(new in v1.1.0)*
- Slow page loads via Navigation Timing (DOMContentLoaded / load budgets, 2× = critical)
- **Oversized resources** (> 1MB single asset) and excessive total payload (> 3MB)
- Main-thread jank / layout-thrashing indicators from the Long Tasks API
- Render-blocking `<head>` resources and excessive DOM size

Plus a **safety-first Interaction Runner**: it fills forms with inert data (`ghost-qa@example.com`), opens tabs/modals/menus, and clicks ordinary buttons — but *never* destructive ones (`delete`, `checkout`, `pay`, `logout`, `publish`… are blocked by a tested safety gate).

---

## 🔌 Native MCP Server *(new in v1.1.0)*

ghost-qa ships a zero-dependency **Model Context Protocol** server (JSON-RPC 2.0 over stdio), so MCP hosts can invoke browser verification as a native tool instead of shelling out:

```bash
npx github:avivgerz-hue/ghost-qa mcp
```

| MCP tool | What it does |
| --- | --- |
| `ghost_qa_audit_url` | Runs the full crawl + 5-trap suite against a running URL and returns the Self-Healing Bug Report (text + structured content) |
| `ghost_qa_doctor` | Verifies Node, Chromium availability, and runs a live browser smoke test |

`npx github:avivgerz-hue/ghost-qa init` writes the ready-to-use `.mcp.json` entry for you (merging with any servers you already have):

```json
{ "mcpServers": { "ghost-qa": { "command": "npx", "args": ["-y", "github:avivgerz-hue/ghost-qa", "mcp"] } } }
```

Works with Claude Code, Claude Desktop, Cursor, Codex — any MCP host.

---

## 🖥️ Zero-lifecycle testing with `--server-cmd` *(new in v1.1.0)*

Don't even start the dev server yourself — ghost-qa will spawn it, wait for the URL to respond, audit, and terminate the whole process tree afterward:

```bash
npx github:avivgerz-hue/ghost-qa test http://localhost:3000 --server-cmd "npm run dev"
```

Pair it with `--html ghost-qa-report.html` for a self-contained, dark-mode **visual evidence dashboard** (routes, interactions, every trap finding per viewport) you can attach to CI artifacts or PRs.

---

## 📟 Example output

```
👻 ghost-qa — autonomous browser verification
Target: http://localhost:3000/
Duration: 8.4s · Viewports: desktop + mobile · Depth: 2

Routes crawled
  /                            Home                 [200] 3 issues
  /pricing                     Pricing              [200] ✓
  /dashboard                   Dashboard            [200] 2 issues

Coverage
  Routes visited:       3
  Interactions tested:  21 passed · 1 failed · 4 skipped (safety)
  Issues:               5 total — 2 critical, 3 major, 0 minor

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
| `ghost-qa mcp` | Run the native MCP server (JSON-RPC 2.0 over stdio) exposing `ghost_qa_audit_url` and `ghost_qa_doctor` |
| `ghost-qa doctor` | Diagnose Node ≥ 20, Playwright and Chromium setup, with a live browser smoke test |
| `ghost-qa --version` / `--help` | Version / usage |

### `test` flags

| Flag | Default | Description |
| --- | --- | --- |
| `--max-depth <n>` | `2` | Link-following depth from the start URL |
| `--max-routes <n>` | `25` | Maximum routes to visit |
| `--timeout <ms>` | `15000` | Per-navigation timeout |
| `--viewport <name>` | `both` | `both` \| `desktop` \| `mobile` |
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

`SKILL.md` (repo root) is the master skill. `npx github:avivgerz-hue/ghost-qa init` installs it for:

- **Claude Code** → `.claude/skills/ghost-qa/SKILL.md` + protocol in `CLAUDE.md`
- **Codex / generic agents** → protocol in `AGENTS.md`
- **Cursor / Windsurf** → protocol in `.cursorrules`

The protocol is wrapped in `<!-- ghost-qa:start/end -->` markers, so re-running `init` updates it in place without duplicating or clobbering your other instructions.

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
