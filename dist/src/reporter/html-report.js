export function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
const SEVERITY_COLOR = {
    critical: '#f87171',
    major: '#fbbf24',
    minor: '#94a3b8',
};
function severityBadge(issue) {
    const color = SEVERITY_COLOR[issue.severity];
    return `<span class="badge" style="--c:${color}">${escapeHtml(issue.severity.toUpperCase())}</span>`;
}
function issueRow(issue) {
    const details = issue.details
        ? `<div class="details">${escapeHtml(Object.entries(issue.details)
            .map(([k, v]) => `${k}=${v}`)
            .join(' · '))}</div>`
        : '';
    return `<tr>
    <td>${severityBadge(issue)}</td>
    <td><span class="cat">${escapeHtml(issue.category)}</span></td>
    <td class="msg">${escapeHtml(issue.message)}${details}</td>
    <td><code>${escapeHtml(issue.route)}</code></td>
    <td><span class="badge viewport">${escapeHtml(issue.viewport)}</span></td>
    <td><code class="id">#${escapeHtml(issue.id)}</code></td>
  </tr>`;
}
const STYLE = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; font: 15px/1.55 ui-sans-system, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  background: #0b0f17; color: #e2e8f0; }
header { padding: 40px 32px 24px; background: radial-gradient(900px 300px at 20% -50%, #1e293b, transparent), #0d1321;
  border-bottom: 1px solid #1e293b; }
h1 { margin: 0 0 6px; font-size: 30px; } h2 { margin: 34px 0 12px; font-size: 19px; }
main { max-width: 1100px; margin: 0 auto; padding: 8px 32px 56px; }
.sub { color: #94a3b8; } code { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12.5px;
  background: #1e293b; padding: 1px 6px; border-radius: 6px; }
.verdict { display: inline-block; margin-top: 14px; padding: 8px 16px; border-radius: 999px; font-weight: 700; }
.verdict.pass { background: #052e16; color: #4ade80; border: 1px solid #166534; }
.verdict.fail { background: #2e0a0a; color: #f87171; border: 1px solid #7f1d1d; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-top: 24px; }
.card { background: #111827; border: 1px solid #1f2937; border-radius: 14px; padding: 16px; }
.card .n { font-size: 26px; font-weight: 800; } .card .l { color: #94a3b8; font-size: 12.5px; text-transform: uppercase; letter-spacing: .06em; }
table { width: 100%; border-collapse: collapse; background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; }
th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #1e293b; vertical-align: top; }
th { color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; background: #111827; }
tr:last-child td { border-bottom: none; }
.badge { --c: #94a3b8; color: var(--c); border: 1px solid var(--c); padding: 1px 8px; border-radius: 999px;
  font-size: 11px; font-weight: 700; white-space: nowrap; }
.badge.viewport { --c: #7dd3fc; font-weight: 600; }
.cat { color: #c4b5fd; font-size: 12.5px; font-weight: 600; }
.msg { max-width: 520px; } .details { color: #64748b; font-size: 12.5px; margin-top: 3px; }
.id { color: #64748b; background: none; padding: 0; }
.ok { color: #4ade80; } .bad { color: #f87171; } .warn { color: #fbbf24; } .dim { color: #64748b; }
footer { color: #475569; font-size: 13px; padding: 0 32px 36px; max-width: 1100px; margin: 0 auto; }
`;
/**
 * A sleek, self-contained (zero external assets) dark-mode HTML dashboard
 * summarising one ghost-qa run — routes, interactions and every trap finding
 * across desktop and mobile. Safe to attach to CI artifacts or PRs.
 */
export function formatHtmlReport(report) {
    const { summary } = report;
    const sortedIssues = [...report.issues].sort((a, b) => a.route.localeCompare(b.route) ||
        SEVERITY_RANK(b.severity) - SEVERITY_RANK(a.severity));
    const routeRows = report.routes
        .map((route) => `<tr>
        <td><code>${escapeHtml(route.path)}</code></td>
        <td>${escapeHtml(route.title || '<span class="dim">(no title)</span>')}</td>
        <td>${route.httpStatus ? `<code>${route.httpStatus}</code>` : '<span class="dim">—</span>'}</td>
        <td>${route.viewports.map((v) => `<span class="badge viewport">${escapeHtml(v)}</span>`).join(' ')}</td>
        <td>${route.issueCount === 0 ? '<span class="ok">✓ clean</span>' : `<span class="bad">${route.issueCount} issue${route.issueCount === 1 ? '' : 's'}</span>`}</td>
      </tr>`)
        .join('\n');
    const interactionRows = report.interactions
        .map((action) => `<tr>
        <td><span class="cat">${escapeHtml(action.kind)}</span></td>
        <td class="msg">${escapeHtml(action.target)}${action.reason ? `<div class="details">${escapeHtml(action.reason)}</div>` : ''}</td>
        <td><code>${escapeHtml(action.route)}</code></td>
        <td><span class="badge viewport">${escapeHtml(action.viewport)}</span></td>
        <td>${action.outcome === 'passed' ? '<span class="ok">passed</span>' : action.outcome === 'failed' ? '<span class="bad">failed</span>' : '<span class="warn">skipped</span>'}</td>
      </tr>`)
        .join('\n');
    const categoryRows = Object.entries(summary.byCategory)
        .filter(([, count]) => count > 0)
        .map(([category, count]) => `<tr><td><span class="cat">${escapeHtml(category)}</span></td><td>${count}</td></tr>`)
        .join('\n');
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ghost-qa report — ${escapeHtml(report.targetUrl)}</title>
<style>${STYLE}</style>
</head>
<body>
<header>
  <h1>👻 ghost-qa — Visual Evidence Report</h1>
  <div class="sub">Target <code>${escapeHtml(report.targetUrl)}</code> · ghost-qa v${escapeHtml(report.version)} · ${(report.durationMs / 1000).toFixed(1)}s · ${escapeHtml(report.startedAt)}</div>
  <div class="verdict ${report.passed ? 'pass' : 'fail'}">${report.passed ? '✔ PASS — no blocking browser failures' : '✖ FAIL — blocking browser failures found'}</div>
  <div class="cards">
    <div class="card"><div class="n">${summary.routesCrawled}</div><div class="l">Routes crawled</div></div>
    <div class="card"><div class="n">${summary.interactionsTested}</div><div class="l">Interactions passed</div></div>
    <div class="card"><div class="n">${summary.interactionsFailed}</div><div class="l">Interactions failed</div></div>
    <div class="card"><div class="n">${summary.interactionsSkipped}</div><div class="l">Skipped (safety)</div></div>
    <div class="card"><div class="n" style="color:#f87171">${summary.bySeverity.critical}</div><div class="l">Critical</div></div>
    <div class="card"><div class="n" style="color:#fbbf24">${summary.bySeverity.major}</div><div class="l">Major</div></div>
    <div class="card"><div class="n">${summary.totalIssues}</div><div class="l">Total issues</div></div>
  </div>
</header>
<main>
  <h2>Routes crawled</h2>
  <table><thead><tr><th>Route</th><th>Title</th><th>Status</th><th>Viewports</th><th>Result</th></tr></thead>
  <tbody>${routeRows || '<tr><td colspan="5" class="dim">No routes were visited.</td></tr>'}</tbody></table>

  <h2>Issues by trap category</h2>
  <table><thead><tr><th>Category</th><th>Issues</th></tr></thead>
  <tbody>${categoryRows || '<tr><td colspan="2" class="ok">No issues trapped — clean run.</td></tr>'}</tbody></table>

  <h2>Failures caught (${report.issues.length})</h2>
  <table><thead><tr><th>Severity</th><th>Trap</th><th>Finding</th><th>Route</th><th>Viewport</th><th>Id</th></tr></thead>
  <tbody>${sortedIssues.map(issueRow).join('\n') || '<tr><td colspan="6" class="ok">Nothing caught. The browser is happy. 👻✓</td></tr>'}</tbody></table>

  <h2>Interactions executed (${report.interactions.length})</h2>
  <table><thead><tr><th>Kind</th><th>Target</th><th>Route</th><th>Viewport</th><th>Outcome</th></tr></thead>
  <tbody>${interactionRows || '<tr><td colspan="5" class="dim">Interactions were disabled for this run.</td></tr>'}</tbody></table>
</main>
<footer>Generated by ghost-qa ${escapeHtml(report.version)} · Five traps: console · network · layout · accessibility · performance · Re-run: <code>npx -y ghost-qa test ${escapeHtml(report.targetUrl)}</code></footer>
</body>
</html>
`;
}
function SEVERITY_RANK(severity) {
    return severity === 'critical' ? 3 : severity === 'major' ? 2 : 1;
}
//# sourceMappingURL=html-report.js.map