# Agent Instructions

<!-- ghost-qa:start -->
## 👻 ghost-qa — Browser Verification Protocol (MANDATORY)

Before reporting any task that touches frontend code as complete, you MUST verify it in a real browser — the closed-loop Self-Healing Browser Verification Protocol:

1. **Readiness:** run `ghost-qa doctor` (or the `ghost_qa_doctor` MCP tool). Do not proceed on red.
2. **Baseline audit:** ensure the app runs locally, then `npx -y ghost-qa test <local-url> --out-dir ghost-qa-out` (add `--server-cmd "npm run dev"` to let ghost-qa manage the server) — or call `ghost_qa_audit_url`. This runs the 8-Trap Engine on Desktop 1440×900, Tablet 768×1024 and Mobile 375×812, light + dark. Save the baseline as `before.json` (it is `ghost-qa-out/report.json`).
3. **Root-cause mapping:** for every critical/major finding, map the exact DOM selector, bounding box, stack trace or dark-mode contrast failure back to the component file that renders it.
4. **Surgical remediation:** fix root causes in source (hydration, overflow, tap targets, ARIA/labels, dark-mode tokens…). Never silence the checker or delete failing UI.
5. **Delta verification:** re-run the audit to `after.json`, then `npx -y ghost-qa compare before.json after.json` (or `ghost_qa_compare`). Repeat until QA Health Score is **95–100 (A+)**, zero critical/major remain, and the delta shows **zero new regressions**. Only then report done, citing score, routes, viewports and the delta.

Never declare a UI task finished based only on code review, type-checking, or unit tests. The browser is the source of truth.
<!-- ghost-qa:end -->
