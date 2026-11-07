---
name: ghost-qa
description: Verify frontend work in a real headless browser before reporting a task complete. Use after building or changing any UI, route, form, or client-side logic — crawls the running app on desktop and mobile, traps console/hydration errors, failed network requests and layout overflow, and returns a self-healing bug report to fix from.
license: MIT
---

# 👻 ghost-qa — Verify in Browser Before Done

Coding agents write code blind. Code that type-checks can still ship with React hydration mismatches, uncaught exceptions, 500ing APIs, dead buttons and mobile layouts that scroll sideways. **The browser is the source of truth — never your mental model of the DOM.**

## The Rule

> Before reporting ANY task that touches frontend code as complete, you MUST run the app in a real browser with ghost-qa, fix everything it catches, and re-run until it passes.

Unit tests, type-checking and code review do **not** satisfy this rule.

## The Self-Healing Loop

1. **Run the app.** Start (or reuse) the project's dev server, e.g. `npm run dev` — or skip this step entirely with `--server-cmd` (below) and let ghost-qa spawn and tear down the server itself.
2. **Verify.** Run:
   ```bash
   npx ghost-qa test http://localhost:3000
   # or, with zero manual server management:
   npx ghost-qa test http://localhost:3000 --server-cmd "npm run dev"
   ```
   If your host exposes MCP tools, calling **`ghost_qa_audit_url`** with the same URL is equivalent (and `ghost_qa_doctor` checks the environment first).
   ghost-qa crawls internal routes (depth 2, up to 25 routes) on Desktop 1440×900 and Mobile 390×844, safely clicks non-destructive controls, fills forms with inert data, and runs the **5-Trap Engine**:
   - **Console** — uncaught page errors, unhandled promise rejections, React hydration mismatches, `console.error`
   - **Network** — HTTP 4xx/5xx responses, failed fetch/XHR, CORS failures, broken assets
   - **Layout** — horizontal overflow, zero-size interactive elements, broken images, missing viewport meta
   - **Accessibility** — buttons/links with no accessible name, images missing `alt`, inputs with no label, missing `<title>` / `<html lang>`
   - **Performance** — slow loads, oversized assets/payloads, main-thread long-task jank, render-blocking resources, excessive DOM
3. **Read the Self-Healing Bug Report.** Every issue has a stable `#id`, severity, route, viewport and a fix playbook entry.
4. **Fix root causes in source.** Never silence the checker, delete the failing UI, wrap everything in `try/catch`, or add `suppressHydrationWarning` to make a report go away — fix the bug the report points at.
5. **Re-run** `npx ghost-qa test <url>` until it prints:
   ```
   ✔ GHOST-QA PASS — no blocking browser failures found. Safe to report done.
   ```
6. **Only then** report the task complete to the user, and mention that ghost-qa passed (routes crawled / interactions tested).

## Useful flags

| Flag | When to use it |
| --- | --- |
| `--max-depth 3 --max-routes 50` | Larger apps, deeper route trees |
| `--viewport mobile` | Investigating a mobile-only layout bug |
| `--no-interactions` | A page has side-effectful controls you must not exercise |
| `--json` | Piping the report into another tool or CI gate |
| `--report ghost-qa-report.md` | Saving the diagnostic as a file artifact |
| `--html ghost-qa-report.html` | Visual evidence dashboard to attach to a PR or CI run |
| `--server-cmd "npm run dev"` | Let ghost-qa spawn, await and tear down the dev server itself |
| `--fail-on minor` | Strict mode: even warnings block completion |

## MCP mode

`npx ghost-qa mcp` runs a native MCP server (JSON-RPC over stdio) exposing `ghost_qa_audit_url` and `ghost_qa_doctor`. `npx ghost-qa init` installs the `.mcp.json` entry automatically. Prefer the MCP tools when your host supports them; the CLI and MCP paths run the identical audit engine.

## Safety guarantees

ghost-qa never clicks destructive controls (delete, checkout, pay, logout, publish…), never submits real payments or orders, fills forms only with inert data (`ghost-qa@example.com`, `ghost-qa test`), and only follows same-origin links. It is designed for localhost development servers.

## If ghost-qa cannot run

- `npx playwright install chromium` — one-time browser download.
- `npx ghost-qa doctor` — diagnoses Node / Playwright / Chromium setup.
- If the dev server is down, ghost-qa reports a `navigation-failed` critical issue — start the server first; do not skip verification.

## Completion checklist

- [ ] Dev server running on a known local URL
- [ ] `npx ghost-qa test <url>` executed against the final code
- [ ] All critical/major issues fixed at the root cause
- [ ] Final run prints `GHOST-QA PASS`
- [ ] Completion message to the user states ghost-qa passed
