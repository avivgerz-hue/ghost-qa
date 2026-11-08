---
name: ghost-qa
description: Verify frontend work in a real headless browser before reporting a task complete. The autonomous Staff QA Engineer protocol — doctor readiness, multi-viewport 8-Trap baseline audit (Desktop/Tablet/Mobile, light + dark), DOM-to-source root-cause mapping, surgical remediation, and closed-loop delta verification with ghost_qa_compare until QA Health Score is 95–100 (Grade A+). Use after building or changing any UI, route, form, API integration, or client-side logic.
license: MIT
---

# 👻 ghost-qa — Autonomous Staff QA Engineer Protocol

Coding agents write code blind. Code that type-checks can still ship with React hydration mismatches, uncaught exceptions, 500ing APIs, dead links, invisible dark-mode text, 30px tap targets, and mobile layouts that scroll sideways. **The browser is the source of truth — never your mental model of the DOM.**

> **The Rule:** Before reporting ANY task that touches frontend code as complete, you MUST execute all five phases below, in order, and finish with a verified delta: QA Health Score 95–100 (Grade A+ band), zero critical/major findings, zero new regressions.

Unit tests, type-checking, linting and code review do **not** satisfy this rule. They cannot see hydration, layout, network, contrast or focus failures.

## When to use this skill

- ✅ You created or changed pages, components, routes, forms, styles, or client-side data fetching
- ✅ You fixed a bug that manifested in the browser
- ✅ You are about to tell the user a UI task is "done"

**Not a substitute for:** your unit/E2E suites, a full manual WCAG audit (the a11y trap covers machine-checkable WCAG 2.1 AA failures), load testing, or exploratory QA.

## The 8-Trap Deep Browser Inspection Engine

Every audit crawls each route on **Desktop 1440×900, Tablet 768×1024 and Mobile 375×812**, under **light + dark** colour schemes:

| # | Trap | What it catches |
| --- | --- | --- |
| 1 | Console & Framework Runtime | `pageerror`, `console.error`, unhandled rejections, React/Next.js hydration mismatches, duplicate-key warnings, CSP violations |
| 2 | Network & Asset Integrity | 4xx/5xx, timed-out/aborted requests, failed CORS preflights, broken images (`naturalWidth === 0`), broken inline SVGs (0×0), >500KB unoptimized payloads |
| 3 | Layout, Responsive Geometry & Collision | Horizontal overflow, overlapping interactive elements (bounding-box collision math), <44×44px touch targets, clipped text, off-screen interactives |
| 4 | Accessibility (WCAG 2.1 AA) & Keyboard Focus | Missing accessible names/labels/alt, heading hierarchy breaks, real computed contrast ratios, automated Tab-order verification (invisible/dead focus) |
| 5 | Performance & Core Web Vitals | TTFB, FCP, LCP, CLS, DOM bloat (>1500 nodes), DOM depth (>32), render-blocking scripts, long tasks |
| 6 | Safe Interactive & Link Integrity | Placeholder hrefs (`""`, `#`, `javascript:void(0)`), dead anchors/routes, in-form buttons without `type`, stuck disabled controls |
| 7 | SEO, Metadata & Social Graph | Title length, meta description, `<html lang>`, viewport meta, canonical, OpenGraph set, duplicate `id`s |
| 8 | Dark / Light Theme Emulation | Contrast/visibility recomputed under `colorScheme: light` and `dark` — catches invisible dark-mode text |

Scoring is deterministic: each trap starts at 100, −25 per critical, −10 per major, −3 per minor. The **QA Health Score** is the mean of the 8 trap scores, graded **A+ (97+) … F (<60)**.

---

## Phase 1 — Environment & Server Readiness (`ghost_qa_doctor`)

1. Call the **`ghost_qa_doctor`** MCP tool, or run `npx -y ghost-qa doctor`.
2. It must report **READY**: Node ≥ 20, Chromium installed, live browser smoke test passing.
3. If Chromium is missing: `npx playwright install chromium` (one-time), then re-run doctor. **Never skip to Phase 2 on a red doctor** — a failed launch is not a passing audit.
4. Start the app (`npm run dev`) or plan to use `--server-cmd "npm run dev"` / let the audit spawn it.

## Phase 2 — Multi-Viewport 8-Trap Baseline Audit (`ghost_qa_audit_url`)

Run the baseline BEFORE changing code (or before your fix, when debugging):

- MCP: call **`ghost_qa_audit_url`** with the app URL. Save the full returned report JSON as **`before.json`**.
- CLI equivalent: `npx -y ghost-qa test <local-url> --out-dir ghost-qa-out` → writes `report.json` (copy to `before.json`), `GHOST-QA-REPORT.md`, `PATCH-PROMPT.md`, and the interactive `report.html` dashboard. Add `--screenshots` for embedded route screenshots; `--server-cmd "npm run dev"` if the server isn't running.

Record the baseline: **QA Health Score, grade, per-trap scores, and every finding's `#id`.** Common local URLs: Next.js/CRA `http://localhost:3000`, Vite `http://localhost:5173`, Astro `http://localhost:4321`, Angular `http://localhost:4200`. Never guess silently — state the URL you verified.

## Phase 3 — DOM-to-Source Root-Cause Mapping

For every critical/major finding, trace it back to the exact source component before editing:

- **Exact selectors:** findings carry `#id`, `[data-testid=…]`, or a CSS path, plus the live **bounding box**. Search the codebase for that id/testid/class or the element's visible text to find the React/Next.js/Vue/Svelte component that renders it.
- **Collisions/overflow:** the two colliding selectors + boxes tell you which siblings overlap — inspect their flex/grid/absolute layout in that component, on the failing viewport.
- **Console stacks:** follow the first app-owned stack frames to the throwing component/effect. Hydration mismatches mean server and client rendered different markup (Date/random/`window` at render, invalid nesting like `<p>` in `<p>`).
- **Dark-mode contrast:** a `theme-contrast` finding names the scheme that fails — find the hard-coded colour in that component and replace it with the theme token.
- **Network:** map the failing URL to its route handler/client fetch; 5xx is server code, CORS preflight is API config.

Write the mapping down (finding `#id` → file → root cause) before Phase 4. If you cannot map a finding, say so — do not guess-fix.

## Phase 4 — Surgical Code Remediation

Fix root causes, one finding at a time, in severity order (critical → major → minor):

- **Hydration:** identical server/client markup; defer client-only values to effects; fix invalid HTML nesting. Never `suppressHydrationWarning` to silence it.
- **Responsive geometry:** `min-width: 0` on flex/grid children, `max-width: 100%`, no `100vw` + scrollbar overflow, reserve image space with width/height or `aspect-ratio` (also fixes CLS).
- **Tap targets:** every touch target ≥ 44×44px (padding or min-height/min-width).
- **ARIA/labels:** visible text or `aria-label` on icon controls, `<label for>` (or wrapping label) per input, `alt` on images (`alt=""` only if decorative), one `<h1>`, no heading level skips, visible `:focus-visible` rings — never `outline: none` without a replacement.
- **Dark-mode tokens:** CSS variables / `dark:` variants driven by `prefers-color-scheme` or the app theme — never hard-coded hex that only works in one scheme.
- **Links/forms:** real hrefs or `<button type="button">`; dead anchors get real targets; in-form buttons get explicit `type`.
- **Performance:** defer/async non-critical scripts, compress/resize/lazy-load >500KB assets, code-split, break up long tasks.

**Anti-cheating rules (absolute):** never delete failing UI, never loosen the checker, never hide elements from the traps, never stub network responses. Fixing the checker instead of the bug is a failed task.

## Phase 5 — Closed-Loop Delta Verification (`ghost_qa_compare`)

1. Re-run the identical audit (same URL/viewports) → save as **`after.json`**.
2. Compare: MCP **`ghost_qa_compare`** with `{ before, after }`, or `npx -y ghost-qa compare before.json after.json`.
3. Read the **Regression & Verification Delta Report**: `scoreDelta`, `fixedFindings`, `newRegressions`, `remainingFindings`.
4. **Done only when ALL hold:** QA Health Score **95–100 (Grade A+ band)** · zero critical/major remaining · **zero new regressions** (`verified: true`). Otherwise loop back to Phase 3 with the delta as your new worklist.
5. If the same `#id` survives 5 loops, stop and report honestly what you tried — never declare success on a red delta.

## Completion report (required format)

> ✅ Done. Verified in a real browser with ghost-qa: `ghost_qa_audit_url` on `<url>`
> Stack: Desktop 1440×900 + Tablet 768×1024 + Mobile 375×812, light + dark, 8 traps
> QA Health Score: `<before>` → `<after>` (Grade `<grade>`) · Delta: `<n>` fixed, 0 new regressions
> Routes crawled: `<n>` · Interactions tested: `<n>` · Artifacts: `report.json`, `GHOST-QA-REPORT.md`, `PATCH-PROMPT.md`, `report.html`

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "could not launch Chromium" | `npx playwright install chromium` (one-time), then `npx -y ghost-qa doctor` |
| Navigation failures on every route | The dev server isn't running (or wrong port) — start it, or use `--server-cmd "npm run dev"` |
| Score stuck below 95 | Work the delta's remaining findings by severity; re-check Phase 3 mapping before editing |
| A trap flags a healthy page | File an issue with `report.json` attached — false positives are the most valuable bug reports |

> All commands use the published npm package (`npx -y ghost-qa …`). If npm is unavailable, `npx -y github:avivgerz-hue/ghost-qa …` runs the identical CLI straight from GitHub.
