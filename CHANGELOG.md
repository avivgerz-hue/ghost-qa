# Changelog

All notable changes to ghost-qa are documented here. Format follows [Keep a Changelog](https://keepachangelog.com), versions follow [SemVer](https://semver.org).

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
