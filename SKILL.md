---
name: ghost-qa
description: Verify frontend work in a real headless browser before reporting a task complete. Use after building or changing any UI, route, form, API integration, or client-side logic — crawls the running app on desktop and mobile, runs a 5-trap engine (console/hydration, network, layout, accessibility, performance), exercises interactive controls, and returns a self-healing bug report to fix from. Also usable via the ghost_qa_audit_url MCP tool.
license: MIT
---

# 👻 ghost-qa — Verify in Browser Before Done

Coding agents write code blind. Code that type-checks can still ship with React hydration mismatches, uncaught exceptions, 500ing APIs, dead buttons, icon-only controls no screen reader can name, and mobile layouts that scroll sideways. **The browser is the source of truth — never your mental model of the DOM.**

## The Rule

> Before reporting ANY task that touches frontend code as complete, you MUST run the app in a real browser with ghost-qa, fix everything blocking it catches, and re-run until it passes.

Unit tests, type-checking, linting and code review do **not** satisfy this rule. They cannot see hydration, layout, network or accessibility failures.

## When to use this skill

- ✅ You created or changed pages, components, routes, forms, styles, or client-side data fetching
- ✅ You fixed a bug that manifested in the browser
- ✅ You are about to tell the user a UI task is "done"

**Not a substitute for:** your unit/E2E test suites, a full WCAG accessibility audit (ghost-qa's a11y trap covers common machine-checkable failures, not full WCAG conformance), load testing, or manual exploratory QA.

## Choose your path

| Situation | Command |
| --- | --- |
| Dev server already running | `npx ghost-qa test <url>` |
| Server not running (most common) | `npx ghost-qa test <url> --server-cmd "npm run dev"` — ghost-qa spawns it, waits for it, audits, and kills the process tree afterward |
| Your host exposes MCP tools | Call **`ghost_qa_audit_url`** with the URL (call `ghost_qa_doctor` first if it errors) — identical engine, identical report |
| Mobile-only bug hunt | add `--viewport mobile` |
| Large app | add `--max-depth 3 --max-routes 50` |
| Evidence for a PR/CI | add `--report ghost-qa-report.md --html ghost-qa-report.html` |

Common local URLs: Next.js / CRA `http://localhost:3000`, Vite `http://localhost:5173`, Astro `http://localhost:4321`, Angular `http://localhost:4200`. If unsure, check the dev server output or `package.json` scripts — never guess silently; state the URL you verified in your completion message.

## The Self-Healing Loop

1. **Run the audit** (path table above). The 5-Trap Engine checks, on Desktop 1440×900 *and* Mobile 390×844:
   - **Console** — uncaught errors, unhandled promise rejections, React hydration mismatches, `console.error`
   - **Network** — HTTP 4xx/5xx, failed fetch/XHR, CORS failures, broken assets
   - **Layout** — horizontal overflow, zero-size interactive elements, broken images, missing viewport meta
   - **Accessibility** — buttons/links with no accessible name, images missing `alt`, inputs with no label, missing `<title>` / `<html lang>`
   - **Performance** — slow loads, oversized assets/payloads, main-thread long-task jank, render-blocking resources, excessive DOM
2. **Read the Self-Healing Bug Report.** Every issue has a stable `#id`, a severity (`critical` / `major` / `minor`), the route, and the viewport. Fix **critical and major** issues. Note minors; fix them when cheap.
3. **Fix root causes in source** (fix guidance below). Reference issues by `#id` in your own narration so the user can follow along.
4. **Re-run the identical command.** A fix that breaks a different route or viewport only shows up on re-run.
5. **Repeat until `GHOST-QA PASS`.** If you have looped 5 times on the same `#id`, stop and report to the user what is stuck and why — do not silently give up or declare success.
6. **Only then** report completion, using the completion template below.

## Fix guidance per trap

| Trap | Typical root causes | Fix like this |
| --- | --- | --- |
| Hydration mismatch | `Date.now()`/`Math.random()`/`window` during render, server/client branching, invalid HTML nesting (`<p>` in `<p>`, `<div>` in `<p>`) | Make server and client render identical markup; move time/random/client-only values into `useEffect` + state; fix the nesting |
| Uncaught page error | undefined data, missing null checks on async data, bad imports | Reproduce via the stack trace in the report; guard the actual data path |
| Console error | failed state updates, rejected promises, React warnings treated seriously by the app | Trace the first error, not the cascade after it |
| HTTP 5xx | API route crash, bad env var, DB down | Read the server logs for that endpoint; the browser found it, the fix is server-side |
| HTTP 404 / broken asset | wrong path, case-sensitivity, asset not emitted by the build | Compare the URL in the report with the actual build output / public dir |
| CORS failure | API missing `Access-Control-Allow-Origin` for the page origin | Fix the API's CORS config (or the dev proxy), not the fetch call |
| Horizontal overflow | `100vw` + scrollbar, fixed-width children, flex/grid children without `min-width: 0` | Constrain widths (`max-width: 100%`, `min-width: 0`, `overflow-wrap`); the report names the offending elements |
| Zero-size interactive | collapsed CSS, `display: contents` misuse, content that never rendered | Restore a real, tappable size (≥ 24px, ideally ≥ 40px on mobile) |
| No accessible name | icon-only `<button>`/`<a>` | Add visible text or `aria-label` describing the action/destination |
| Missing `alt` | forgotten attribute | Descriptive alt; `alt=""` only if purely decorative |
| Input without label | placeholder used as label | Real `<label for>`, wrapping `<label>`, or `aria-label` |
| Slow load / oversized asset | unoptimized images, giant bundles, blocking scripts | Compress/lazy-load, `defer`/`async`, code-split; check the named resource first |
| Long-task jank | heavy sync JS, layout reads in loops after writes | Break up work, memoize, batch DOM reads before writes |

## Anti-cheating rules (this is the point of the skill)

- ❌ Never silence the checker: no deleting the failing UI, no blanket `try/catch`, no `suppressHydrationWarning`, no removing the code path "so the error goes away"
- ❌ Never use `--no-interactions` or narrow `--viewport`/`--max-depth` to hide failures (legitimate only when a page has side-effectful controls, and you must say so)
- ❌ Never edit ghost-qa's report, thresholds, or your project's ghost-qa invocation to manufacture a PASS
- ✅ If a finding is a genuine false positive, say so explicitly in your completion message with the `#id` and why — a human can overrule the tool; you may not quietly ignore it

## Safety guarantees you can rely on

ghost-qa never clicks destructive controls (delete, checkout, pay, logout, publish, sign-in…), never submits real orders/payments, fills forms only with inert data (`ghost-qa@example.com`, `ghost-qa test`), stays on same-origin links, and is designed for localhost/dev servers. **Do not point it at production systems you do not own or have permission to test.** Pages behind authentication will typically redirect to a login page — ghost-qa will audit what an anonymous visitor sees; say so if that's what happened.

## Troubleshooting

| Symptom | Do this |
| --- | --- |
| "could not launch Chromium" | `npx playwright install chromium` (one-time), then `npx ghost-qa doctor` |
| `navigation-failed` on every route | Server isn't on that URL/port — start it, or re-run with `--server-cmd "npm run dev"` |
| Everything 404s | Wrong port or base path — confirm the URL in a browser/`curl` yourself first |
| Audit seems to test a login page | The app requires auth for those routes; report that limitation instead of claiming full verification |
| Perf findings vary between runs | Machine load affects timings; re-run once before treating a borderline perf major as real |
| MCP tool unavailable | Fall back to the CLI — the audit engine and report are identical |

## Completion template

When the final run passes, report completion like this:

> ✅ Done. Verified in a real browser with ghost-qa: `npx ghost-qa test <url>` → **GHOST-QA PASS**
> Routes crawled: N · Interactions tested: N · Issues fixed this session: (list `#id`s, or "none found")
> Stack: desktop 1440×900 + mobile 390×844, 5 traps (console, network, layout, accessibility, performance)

## Completion checklist

- [ ] Final code state audited (not an earlier draft of the change)
- [ ] All critical/major issues fixed at the root cause, or explicitly reported as false positives with reasoning
- [ ] Final run prints `GHOST-QA PASS`
- [ ] Completion message uses the template above and names the URL verified
