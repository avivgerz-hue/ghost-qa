# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 1.2.x | ✅ |
| 1.1.x | ✅ (security fixes only) |
| < 1.1 | ❌ |

## What ghost-qa is (and is not)

ghost-qa is a **local development tool**. It launches a headless browser against an app *you* are running and interacts with it like a cautious user would:

- It only follows **same-origin** links from the target URL.
- It refuses to click destructive controls (delete, checkout, pay, logout, publish, sign-in providers…) and never submits payments or orders.
- Form fields are filled only with inert data (`ghost-qa@example.com`, `ghost-qa test`).
- The MCP server speaks JSON-RPC over **stdio only** — it opens no network ports. Only connect it to MCP hosts you trust: anyone who can call `ghost_qa_audit_url` can make your machine browse URLs, so treat it like any other local agent tool.
- `--server-cmd` executes the shell command **you** supply, in your shell. Never paste untrusted commands into it.

**Do not point ghost-qa at production systems or websites you do not own or have explicit permission to test.** Interaction testing clicks real buttons; on a system you don't control that may create data or trigger side effects.

## Reporting a vulnerability

Please report security issues privately via GitHub's **"Report a vulnerability"** button (Security → Advisories) on this repository, rather than opening a public issue. Include:

- Affected version (`npx ghost-qa --version`)
- A minimal reproduction (target fixture + command) 
- The impact you believe it has

We aim to acknowledge reports within 5 business days. Fixes ship on the latest minor version.

## Scope notes

- The accessibility trap checks common machine-checkable failures; it is **not** a WCAG conformance audit.
- Performance thresholds are heuristics tuned for local development hardware; borderline findings on loaded CI machines should be re-run before being treated as defects.
