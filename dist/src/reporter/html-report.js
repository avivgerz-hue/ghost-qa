import { computeHealthScore } from '../engine/health-score.js';
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
    const selector = issue.selector ? `<div class="details"><code>${escapeHtml(issue.selector)}</code></div>` : '';
    return `<tr class="issue-row" data-severity="${escapeHtml(issue.severity)}" data-category="${escapeHtml(issue.category)}" data-viewport="${escapeHtml(issue.viewport)}">
    <td>${severityBadge(issue)}</td>
    <td><span class="cat">${escapeHtml(issue.category)}</span></td>
    <td class="msg">${escapeHtml(issue.message)}${details}${selector}</td>
    <td><code>${escapeHtml(issue.route)}</code></td>
    <td><span class="badge viewport">${escapeHtml(issue.viewport)}${issue.colorScheme ? ` · ${escapeHtml(issue.colorScheme)}` : ''}</span></td>
    <td><code class="id">#${escapeHtml(issue.id)}</code></td>
  </tr>`;
}
const FILTER_SCRIPT = `
document.querySelectorAll('[data-filter]').forEach(function (select) {
  select.addEventListener('change', function () {
    var severity = document.querySelector('[data-filter="severity"]').value;
    var category = document.querySelector('[data-filter="category"]').value;
    var viewport = document.querySelector('[data-filter="viewport"]').value;
    document.querySelectorAll('.issue-row').forEach(function (row) {
      var show = (!severity || row.dataset.severity === severity)
        && (!category || row.dataset.category === category)
        && (!viewport || row.dataset.viewport === viewport);
      row.style.display = show ? '' : 'none';
    });
  });
});
`;
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
.grade-hero { display: flex; align-items: center; gap: 20px; margin-top: 20px; padding: 18px 22px;
  background: #111827; border: 1.5px solid #1f2937; border-radius: 16px; max-width: 560px; }
.grade-score { font-size: 56px; font-weight: 900; line-height: 1; }
.grade-letter { font-size: 22px; font-weight: 800; }
.filters { display: flex; gap: 16px; flex-wrap: wrap; margin: 0 0 12px; color: #94a3b8; font-size: 13px; }
.filters select { background: #1e293b; color: #e2e8f0; border: 1px solid #334155; border-radius: 8px; padding: 4px 8px; margin-left: 6px; }
.shots { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
.shot { margin: 0; background: #111827; border: 1px solid #1f2937; border-radius: 12px; overflow: hidden; }
.shot img { width: 100%; display: block; }
.shot figcaption { padding: 8px 12px; color: #94a3b8; font-size: 12.5px; }
footer { color: #475569; font-size: 13px; padding: 0 32px 36px; max-width: 1100px; margin: 0 auto; }
`;
/**
 * A sleek, self-contained (zero external assets) dark-mode HTML dashboard
 * summarising one ghost-qa run — routes, interactions and every trap finding
 * across desktop and mobile. Safe to attach to CI artifacts or PRs.
 */
export function formatHtmlReport(report) {
    const { summary } = report;
    const health = report.health ?? computeHealthScore(report.issues);
    const gradeColor = health.score >= 90 ? '#4ade80' : health.score >= 75 ? '#a3e635' : health.score >= 60 ? '#fbbf24' : '#f87171';
    const trapCards = health.byTrap
        .map((trap) => `<div class="card">
        <div class="n" style="color:${trap.score >= 90 ? '#4ade80' : trap.score >= 60 ? '#fbbf24' : '#f87171'}">${trap.score}</div>
        <div class="l">${escapeHtml(trap.trap)} · grade ${escapeHtml(trap.grade)}</div>
        <div class="details">${escapeHtml(trap.label)} — ${trap.issues} finding${trap.issues === 1 ? '' : 's'}</div>
      </div>`)
        .join('\n');
    const matrixViewports = [...new Set(report.routes.flatMap((r) => r.viewports))];
    const matrixRows = report.routes
        .map((route) => {
        const cells = matrixViewports
            .map((viewport) => {
            const count = report.issues.filter((i) => i.route === route.path && i.viewport === viewport).length;
            return `<td>${count === 0 ? '<span class="ok">✓ clean</span>' : `<span class="bad">${count}</span>`}</td>`;
        })
            .join('');
        return `<tr><td><code>${escapeHtml(route.path)}</code></td>${cells}</tr>`;
    })
        .join('\n');
    const screenshotCards = (report.screenshots ?? [])
        .map((shot) => `<figure class="shot">
        <img src="${shot.dataUri}" alt="Screenshot of ${escapeHtml(shot.route)} on ${escapeHtml(shot.viewport)} (${escapeHtml(shot.colorScheme)})">
        <figcaption><code>${escapeHtml(shot.route)}</code> · ${escapeHtml(shot.viewport)} · ${escapeHtml(shot.colorScheme)}</figcaption>
      </figure>`)
        .join('\n');
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
  <div class="grade-hero" style="border-color:${gradeColor}">
    <div class="grade-score" style="color:${gradeColor}">${health.score}</div>
    <div>
      <div class="grade-letter" style="color:${gradeColor}">Grade ${escapeHtml(health.grade)}</div>
      <div class="sub">QA Health Score (0–100) · 8-Trap Deep Browser Inspection Engine · mean of per-trap scores</div>
    </div>
  </div>
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
  <h2>8-Trap Scorecard</h2>
  <div class="cards">${trapCards}</div>

  <h2>Route &amp; Viewport Matrix</h2>
  <table><thead><tr><th>Route</th>${matrixViewports.map((v) => `<th>${escapeHtml(v)}</th>`).join('')}</tr></thead>
  <tbody>${matrixRows || '<tr><td class="dim">No routes were visited.</td></tr>'}</tbody></table>

  <h2>Routes crawled</h2>
  <table><thead><tr><th>Route</th><th>Title</th><th>Status</th><th>Viewports</th><th>Result</th></tr></thead>
  <tbody>${routeRows || '<tr><td colspan="5" class="dim">No routes were visited.</td></tr>'}</tbody></table>

  <h2>Issues by trap category</h2>
  <table><thead><tr><th>Category</th><th>Issues</th></tr></thead>
  <tbody>${categoryRows || '<tr><td colspan="2" class="ok">No issues trapped — clean run.</td></tr>'}</tbody></table>

  <h2>Failures caught (${report.issues.length})</h2>
  <div class="filters">
    <label>Severity <select data-filter="severity"><option value="">all</option><option>critical</option><option>major</option><option>minor</option></select></label>
    <label>Trap <select data-filter="category"><option value="">all</option>${[...new Set(report.issues.map((i) => i.category))].map((c) => `<option>${escapeHtml(c)}</option>`).join('')}</select></label>
    <label>Viewport <select data-filter="viewport"><option value="">all</option>${[...new Set(report.issues.map((i) => i.viewport))].map((v) => `<option>${escapeHtml(v)}</option>`).join('')}</select></label>
  </div>
  <table><thead><tr><th>Severity</th><th>Trap</th><th>Finding</th><th>Route</th><th>Viewport</th><th>Id</th></tr></thead>
  <tbody>${sortedIssues.map(issueRow).join('\n') || '<tr><td colspan="6" class="ok">Nothing caught. The browser is happy. 👻✓</td></tr>'}</tbody></table>
  ${screenshotCards ? `<h2>Screenshots</h2>\n  <div class="shots">${screenshotCards}</div>` : ''}

  <h2>Interactions executed (${report.interactions.length})</h2>
  <table><thead><tr><th>Kind</th><th>Target</th><th>Route</th><th>Viewport</th><th>Outcome</th></tr></thead>
  <tbody>${interactionRows || '<tr><td colspan="5" class="dim">Interactions were disabled for this run.</td></tr>'}</tbody></table>
</main>
<footer>Generated by ghost-qa ${escapeHtml(report.version)} · Eight traps: console · network · layout · accessibility · performance · links · seo · theme · Re-run: <code>npx -y ghost-qa test ${escapeHtml(report.targetUrl)}</code></footer>
<script>${FILTER_SCRIPT}</script>
</body>
</html>
`;
}
function SEVERITY_RANK(severity) {
    return severity === 'critical' ? 3 : severity === 'major' ? 2 : 1;
}
//# sourceMappingURL=html-report.js.map