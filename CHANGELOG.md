# Changelog

All notable changes to ghost-qa are documented here. Format follows [Keep a Changelog](https://keepachangelog.com), versions follow [SemVer](https://semver.org).

## [2.0.0] — 2026-11-08

### Added
- **8-Trap Deep Browser Inspection Engine** (was 5 traps): new Safe Interactive & Link Integrity, SEO/Metadata & Social Graph, and Dark/Light Theme Emulation traps; existing traps deepened — duplicate-key + CSP detection (console), timeouts + CORS preflights + broken SVGs + >500KB payloads (network), bounding-box collision math, 44×44 touch targets, clipped text, off-screen interactives (layout), real computed WCAG contrast, heading hierarchy, automated Tab-order focus verification (a11y), and TTFB/FCP/LCP/CLS + DOM depth (performance).
- **3 viewports × 2 colour schemes**: Desktop 1440×900, Tablet 768×1024, Mobile 375×812 (replaces 390×844), each in light + dark emulation. Findings carry exact DOM selectors, bounding boxes and colour scheme.
- **QA Health Score (0–100, Grade A+…F)** with deterministic per-trap sub-scores, in CLI output, JSON, MCP structured content and reports.
- **Artifact bundle** via `--out-dir`: `report.json`, `GHOST-QA-REPORT.md`, `PATCH-PROMPT.md`, and an interactive self-contained `report.html` dashboard (grade hero, 8-Trap Scorecard, Route & Viewport Matrix, filterable findings, optional `--screenshots` embeds).
- **Regression diffing**: `ghost-qa compare <before.json> <after.json>` CLI and `ghost_qa_compare` MCP tool produce the Regression & Verification Delta Report (`scoreDelta`, `fixedFindings`, `newRegressions`, `remainingFindings`).
- `SKILL.md` rewritten as the 5-phase Autonomous Staff QA Engineer Protocol (doctor → baseline → DOM-to-source mapping → remediation → delta verification until 95–100/A+).

### Changed
- **Version is now loaded dynamically from `package.json`** (`src/engine/version.ts`, fallback `2.0.0`) so `--version` can never lag a publish again.
- Default viewports are now `desktop + tablet + mobile` (`--viewport both` keeps the legacy desktop+mobile pair); Mobile profile is 375×812.

## [1.3.1] — 2026-11-08

### Added
- **Published on npm** as [`ghost-qa`](https://www.npmjs.com/package/ghost-qa): the primary invocation is now `npx -y ghost-qa …` (CLI, `init`, and the generated `.mcp.json` MCP entry), with `npx -y github:avivgerz-hue/ghost-qa …` documented as an identical GitHub-source alternative. Official MCP Registry `server.json` package spec now resolves the npm package.
- npm version + monthly downloads badges in the README.
- Production `Dockerfile` + `.dockerignore` (Glama MCP verification: `initialize`/`tools/list` introspection answers with no Chromium present) and the `assets/hero-terminal.svg` terminal demo embedded in the README.

### Changed
- Normalized `package.json` `bin` to `dist/bin/ghost-qa.js` (no leading `./`, silences npm v11+ warnings).

## [1.3.0] — 2026-11-07

### Added
- **MCP registry auto-indexing manifests**: `smithery.yaml` (Smithery stdio config), `glama.json` (Glama metadata, maintainer and tool definitions), and `server.json` (official Model Context Protocol Registry format) — all describing the same `ghost_qa_audit_url` / `ghost_qa_doctor` tools the server actually exposes, guarded by drift tests.
- **`CITATION.cff`** (Citation File Format 1.2.0) so GitHub shows the "Cite this repository" widget for academic/grant citation.
- **Committed `dist/`** for instant zero-build execution: `npx github:avivgerz-hue/ghost-qa` now runs immediately without a TypeScript toolchain on the user's machine. `prepare` is handled by `scripts/prepare-build.mjs`, which no-ops safely when `dist/` exists or TypeScript is absent, and only builds when compiling from source.
- Expanded npm `keywords` to 34 high-intent discovery terms (MCP, agent skills, Playwright, accessibility testing, self-healing…).

### Fixed
- **CLI silently no-opped under `npx`.** The entry-point guard compared `process.argv[1]` (a `node_modules/.bin/ghost-qa` symlink under package managers) against the realpath-resolved `import.meta.url`, so the CLI exited 0 with no output when invoked via a bin symlink. The entry check now realpath-resolves first, with a regression test (`tests/cli-entry.test.ts`).
- Added `"prepare": "npm run build"` so `npx github:avivgerz-hue/ghost-qa` and git-URL installs build `dist/` automatically.

## [1.2.0] — 2026-11-07

### Changed
- **Node.js >= 20 is now required** (Node 18 reached end-of-life; current Playwright requires Node 20+). Node 18 users should stay on ghost-qa 1.1.x.
- Playwright unpinned to `^1.49.1` (installs current 1.x) now that the Node floor allows it.

### Added
- Real-browser end-to-end test (`tests/browser-e2e.test.ts`): serves a fixture app with planted console/accessibility bugs and asserts the full audit catches them on both viewports while a clean route passes with zero issues. Runs in CI (Chromium is installed before the test step); skips gracefully where no Chromium is present.
- `SECURITY.md`, `CODE_OF_CONDUCT.md`, GitHub issue templates, and an honest **Scope & limitations** section in the README.
- Greatly expanded `SKILL.md`: path-selection table (CLI vs `--server-cmd` vs MCP), per-trap root-cause fix guidance, anti-cheating rules, troubleshooting table, and a completion-report template.
- `prepublishOnly` guard so a broken build/test can never be published to npm.

## [1.1.0] — 2026-11-07

### Added
- **Native MCP Server Mode** (`ghost-qa mcp`): zero-dependency JSON-RPC 2.0 over stdio exposing `ghost_qa_audit_url` and `ghost_qa_doctor`; `ghost-qa init` writes/merges `.mcp.json`.
- **Accessibility Trap**: accessible names, `alt` attributes, form labels, document title, `html lang`.
- **Performance & Asset Trap**: Navigation/Resource Timing budgets, oversized assets/payloads, Long-Tasks jank indicators, render-blocking resources, DOM size.
- **Dev-Server Lifecycle Wrapper**: `--server-cmd` / `--server-timeout` spawn, await, audit and tear down your dev server.
- **HTML Visual Evidence Report**: `--html` self-contained dark-mode dashboard.
- Shared audit engine (`src/engine/audit-runner.ts`) used identically by CLI, MCP and library consumers. 60 tests.

## [1.0.0] — 2026-11-07

### Added
- Initial launch: zero-config autonomous crawl (`ghost-qa test <url>`) on Desktop 1440×900 + Mobile 390×844.
- Console, Network and Layout traps with pure, unit-tested evaluators.
- Safety-first Interaction Runner (never clicks destructive controls; re-collects candidates per action).
- Agent Skill installer (`ghost-qa init`): `.claude/skills/ghost-qa/SKILL.md` + verification protocol in `CLAUDE.md`, `AGENTS.md`, `.cursorrules`.
- Terminal summary + token-efficient Self-Healing Bug Report (Markdown/JSON), `ghost-qa doctor`.
- CI on Node 18/20/22; MIT license.

[1.2.0]: https://github.com/avivgerz-hue/ghost-qa/releases
[1.1.0]: https://github.com/avivgerz-hue/ghost-qa/releases/tag/v1.1.0
[1.0.0]: https://github.com/avivgerz-hue/ghost-qa/releases/tag/v1.0.0
