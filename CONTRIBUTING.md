# Contributing to ghost-qa

Thanks for helping make coding agents verify their work in a real browser. 👻

## Development setup

```bash
git clone https://github.com/avivgerz-hue/ghost-qa.git
cd ghost-qa
npm install
npx playwright install chromium   # one-time browser download
npm run build
npm test
```

Requirements: Node.js >= 20 (Node 18 support ended with v1.1.0; current Playwright requires Node 20+).

## Project layout

| Path | Responsibility |
| --- | --- |
| `bin/ghost-qa.ts` | CLI entry point: `test`, `init`, `doctor` |
| `src/engine/` | Playwright session, route crawler, interaction runner |
| `src/traps/` | Console, network and layout traps (pure evaluators + page listeners) |
| `src/reporter/` | Terminal summary and agent-facing Self-Healing Bug Report |
| `tests/` | Vitest suite — trap evaluators and reporters are unit-tested without a browser |

## Engineering rules

1. **Zero placeholders.** Every module must be fully implemented and exercised by a test or a smoke run.
2. **Pure first.** Trap logic lives in pure functions (`evaluateLayoutMetrics`, `evaluateHttpResponse`, `classifyConsoleText`…) so it can be unit-tested without launching Chromium. Keep browser code as a thin probe/listener around them.
3. **Safety first.** The interaction runner must never click destructive controls (delete, checkout, pay, logout, publish…). If you add interaction types, extend `isSafeInteraction` and its tests.
4. **Agent-first output.** Any new issue type needs: a severity, a category, a fix-playbook entry if the category is new, and coverage in the terminal + Markdown diagnostics.
5. **Deterministic issues.** Issue `id`s are fingerprints of category/type/route/viewport/message — do not add timestamps or randomness to issue identity.

## Adding a new trap check

1. Add the pure evaluator in the relevant `src/traps/*.ts` file.
2. Add the `IssueType` to `src/types.ts` (and severity rules).
3. Wire the probe/listener into the trap class and the CLI visit loop if needed.
4. Add Vitest cases in `tests/traps.test.ts` for the pass, fail and edge cases.
5. Document the check in `README.md` and `SKILL.md` if agents should act on it differently.

## Pull requests

- Run `npm run build && npm test` locally — CI runs the same on Node 20/22, with Chromium installed before the suite so the browser E2E test executes.
- Keep PRs focused; include before/after terminal output for reporter changes.
- Update the README flags table when CLI flags change.

## Reporting bugs

Open an issue with: ghost-qa version (`npx ghost-qa --version`), Node version, target framework (Next.js/Vite/…), the full terminal output, and the `--json` report if you can share it.
