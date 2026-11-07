# Launch posts for ghost-qa

Copy-paste ready. The X/Twitter post is the primary; thread and LinkedIn/Hacker News variants follow.

---

## 𝕏 Primary post

Your coding agent is lying to you.

It writes the code, type-checks it, runs the unit tests… and declares victory — while the actual browser has a React hydration error, a 500ing API, a dead button, and a mobile layout scrolling sideways. 📱💥

It never opened the browser. So I built the tool that does:

👻 **ghost-qa** — autonomous headless browser QA for coding agents

```
npx ghost-qa test http://localhost:3000 --server-cmd "npm run dev"
```

One command. No test scripts. It crawls your running app on desktop + mobile, clicks the buttons (never delete/checkout/pay), and traps what actually breaks:

🪤 Hydration mismatches & uncaught errors
🪤 4xx/5xx, failed fetches, CORS failures
🪤 Mobile horizontal overflow & broken images
🪤 A11y bugs: nameless buttons, missing alt/labels
🪤 Perf: slow loads, oversized assets, jank

Then it hands your agent a Self-Healing Bug Report — stable issue IDs, route, viewport, fix playbook — so Claude Code / Codex / Cursor fix their own bugs and re-run until PASS.

`npx ghost-qa init` installs the Agent Skill that makes "verify in the browser before saying done" a rule your agent can't skip. Or skip the shell entirely: it ships a native MCP server (`ghost-qa mcp` → `ghost_qa_audit_url`).

My favourite review of it so far is from ghost-qa itself: during development it caught 4 bugs in ghost-qa. That's the whole point. The browser is the source of truth.

⭐ Open source, MIT: https://github.com/avivgerz-hue/ghost-qa

Built with Playwright + TypeScript. Part of the VibeFoundry Agent Suite with unslop (UI design) & vibe-shield (security).

What should it trap next?

---

## 𝕏 Thread version

1/ Your AI coding agent does not open the browser.

It writes code blind, runs the type checker, and says "done ✅" — while your users get hydration errors, 500s, dead buttons, and sideways-scrolling mobile pages.

So I made the browser grade its homework. 👻🧵

2/ Meet **ghost-qa**: `npx ghost-qa test http://localhost:3000`

Zero config. It launches headless Chromium, discovers your routes, and tests every page twice — Desktop 1440×900 and Mobile 390×844 (iPhone).

No test scripts to write. It's a verifier, not a framework.

3/ Inside is a 5-Trap Engine watching what the browser *actually* experiences:

🖥 Console — uncaught errors, unhandled rejections, React hydration mismatches
🌐 Network — 5xx crashes, 404 assets, CORS blocks
📐 Layout — horizontal overflow (offending elements named), 0px buttons, broken images
♿ Accessibility — buttons/links with no accessible name, missing alt, unlabelled inputs
⚡ Performance — slow loads, 1MB+ assets, main-thread jank

4/ It also *uses* your app: fills forms with inert data, opens tabs and modals, clicks controls.

But it has a tested safety gate: delete, checkout, pay, logout, publish = never clicked. Route links are left to the crawler. Your local app stays intact.

5/ Failures come back as a Self-Healing Bug Report: every issue gets a stable `#id`, severity, route, viewport, and a per-trap fix playbook.

The agent fixes root causes → re-runs → repeats until GHOST-QA PASS. Only then may it tell you "done".

6/ Don't even want to start the dev server?

`npx ghost-qa test http://localhost:3000 --server-cmd "npm run dev"`

ghost-qa spawns your server, waits for it, audits, and kills the process tree after. Add `--html report.html` for a dark-mode evidence dashboard for your PR.

7/ And because agents shouldn't need a shell for everything, ghost-qa ships a **native MCP server** (zero-dependency JSON-RPC over stdio):

Claude Code / Claude Desktop / Cursor / Codex can call `ghost_qa_audit_url` directly. `npx ghost-qa init` writes the `.mcp.json` for you.

8/ The best part? Building it, ghost-qa caught bugs in *itself*: a perf probe tripping its own console trap, interactions failing after navigation re-renders, overflow hidden by viewport emulation.

A QA tool that survives its own audit is one I'll ship.

9/ It's MIT, open source, 60+ tests, CI on Node 20/22 with a real-browser E2E suite:

⭐ https://github.com/avivgerz-hue/ghost-qa

Part of the VibeFoundry Agent Suite: 🎨 unslop (design systems, anti-slop UI), 🛡️ vibe-shield (security scanning), 👻 ghost-qa (verification).

What should it trap next?

---

## 💼 LinkedIn version

**Your coding agent never opened the browser.**

Neither did mine. Claude Code would write a feature, pass TypeScript, pass unit tests, and report "done" — while the live app had a React hydration mismatch, an API returning 500, and a checkout page scrolling sideways on mobile.

So I built the missing step in the agent workflow: **ghost-qa** 👻

One command — `npx ghost-qa test http://localhost:3000` — launches a headless browser, crawls the running app on desktop and mobile viewports, safely exercises its interactive controls, and traps runtime failures across five categories: console/hydration errors, network failures, layout overflow, accessibility defects, and performance problems.

The output isn't a log file. It's a structured Self-Healing Bug Report designed for the agent itself: stable issue IDs, severity, route, viewport, and fix guidance. The agent fixes, re-runs, and only reports completion on a verified PASS.

It also ships as:
• An installable **Agent Skill** (`npx ghost-qa init`) that makes browser verification a mandatory step for Claude Code, Codex, Cursor and Windsurf
• A **native MCP server** so agents can call `ghost_qa_audit_url` as a first-class tool
• A dev-server lifecycle wrapper (`--server-cmd`) and HTML evidence reports for PRs

During development, my favourite validation happened by accident: ghost-qa caught multiple bugs *in ghost-qa*. That's when I knew the loop worked.

It's open source (MIT), built with Playwright + TypeScript, and part of the VibeFoundry Agent Suite alongside unslop (UI design) and vibe-shield (security for AI-generated code).

If your agent says "done", make it prove it in a browser first:
https://github.com/avivgerz-hue/ghost-qa

#AI #CodingAgents #ClaudeCode #OpenSource #QA #DevTools #Playwright

---

## 📰 Hacker News (Show HN) version

**Title:** Show HN: Ghost-QA – headless browser verification loop for coding agents

Coding agents (Claude Code, Codex, Cursor) write frontend code without ever running it in a browser, then declare success on the strength of type-checking. I kept hitting hydration errors, dead buttons and mobile overflow in "finished" work, so I built a verifier the agent has to pass before it's allowed to say done.

`npx ghost-qa test http://localhost:3000` crawls the running app (BFS over same-origin routes, configurable depth) in headless Chromium at desktop 1440×900 and mobile 390×844, safely interacts with non-destructive controls, and traps failures in five categories: console/page errors (incl. React hydration mismatches), network (4xx/5xx, CORS, failed fetch), layout (horizontal overflow with offenders named, zero-size interactives, broken images), accessibility (missing accessible names/alt/labels/title/lang), and performance (navigation-timing budgets, oversized assets, long-task jank).

Design choices that may be of interest here:

- Each trap is a pure evaluator (metrics in, issues out) behind a thin in-page probe, so the detection logic is unit-testable without a browser. 60+ Vitest tests, plus a real-browser E2E against a fixture app in CI.
- The interaction runner re-collects candidates before every action (handles navigation/re-renders), blocks destructive labels (delete/checkout/pay/logout…), and never follows route links — that's the crawler's job, so trap attribution stays per-route.
- Output is built for the agent, not just humans: stable issue IDs + a per-category fix playbook in Markdown/JSON. It also ships an Agent Skill installer (`init` writes SKILL.md + protocol into CLAUDE.md/AGENTS.md/.cursorrules + `.mcp.json`) and a zero-dependency MCP server over stdio (`ghost_qa_audit_url`, `ghost_qa_doctor`).
- Honest limitations are in the README: it's not a WCAG audit, auth-gated routes audit as anonymous, perf thresholds are local heuristics.

MIT, TypeScript + Playwright, Node 20+. Repo: https://github.com/avivgerz-hue/ghost-qa

I'd especially value feedback on false positives — which trap findings on real apps turn out to be noise?
