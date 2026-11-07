# 👻 ghost-qa

**Autonomous headless browser QA & self-healing verification loop for coding agents.**

[![CI](https://github.com/avivgerz-hue/ghost-qa/actions/workflows/ci.yml/badge.svg)](https://github.com/avivgerz-hue/ghost-qa/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/ghost-qa.svg)](https://www.npmjs.com/package/ghost-qa)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![Powered by Playwright](https://img.shields.io/badge/powered%20by-Playwright-45ba4b.svg)](https://playwright.dev)

Coding agents (Claude Code, Codex, Cursor, Windsurf) write code **blind** — then declare victory while the actual browser has React hydration errors, broken buttons, 500ing APIs, or mobile layout overflow.

`ghost-qa` fixes that. One command launches a headless browser against your running app, crawls the live DOM, safely pokes every button, traps runtime/network/layout failures, and hands the agent a structured **Self-Healing Bug Report** so it fixes its own bugs *before* telling you it's done.

```bash
npx ghost-qa test http://localhost:3000
```

No test scripts. No config. No mercy for "it works on my machine".

---

## ⚡ Quickstart

```bash
# 1. Start your app as usual
npm run dev            # → http://localhost:3000

# 2. Verify it in a real browser (one-time: downloads Chromium)
npx playwright install chromium
npx ghost-qa test http://localhost:3000

# 3. Teach your coding agent to do this automatically, forever
npx ghost-qa init
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
                    │   │ CONSOLE │  │ NETWORK  │  │ LAYOUT  │  TRAPS   │
                    │   │  TRAP   │  │  TRAP    │  │  TRAP   │          │
                    │   └─────────┘  └──────────┘  └─────────┘          │
                    │   Desktop 1440×900  +  Mobile 390×844 (iPhone)     │
                    └────────────────────────────────────────────────────┘
                                          │
                          fix bugs ───────┘  re-run until ✔ PASS
```

1. The agent writes code and starts the dev server.
2. `ghost-qa test` crawls every internal route on **desktop + mobile**, exercising interactive controls.
3. Three traps capture everything the browser actually experienced.
4. Failures return as a token-efficient diagnostic; the agent fixes the root causes and re-runs.
5. The loop ends only at **PASS** — that's when the agent may tell you it's done.

---

## 🪤 The Three Runtime Traps

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

Plus a **safety-first Interaction Runner**: it fills forms with inert data (`ghost-qa@example.com`), opens tabs/modals/menus, and clicks ordinary buttons — but *never* destructive ones (`delete`, `checkout`, `pay`, `logout`, `publish`… are blocked by a tested safety gate).

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
| `ghost-qa init [--force]` | Install `.claude/skills/ghost-qa/SKILL.md` + verification protocol into `CLAUDE.md`, `AGENTS.md`, `.cursorrules` (idempotent) |
| `ghost-qa doctor` | Diagnose Node ≥ 18, Playwright and Chromium setup, with a live browser smoke test |
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
| `--quiet` | off | Suppress the terminal summary (report file + exit code only) |

Works with any stack that serves HTML on localhost — Next.js, Vite, Remix, Astro, Create React App, plain static servers, Rails, Django… if a browser can open it, ghost-qa can judge it.

---

## 🤖 The Agent Skill

`SKILL.md` (repo root) is the master skill. `npx ghost-qa init` installs it for:

- **Claude Code** → `.claude/skills/ghost-qa/SKILL.md` + protocol in `CLAUDE.md`
- **Codex / generic agents** → protocol in `AGENTS.md`
- **Cursor / Windsurf** → protocol in `.cursorrules`

The protocol is wrapped in `<!-- ghost-qa:start/end -->` markers, so re-running `init` updates it in place without duplicating or clobbering your other instructions.

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
