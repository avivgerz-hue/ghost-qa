import type { GhostQAReport, QAIssue } from '../types.js';

const useColor = (): boolean =>
  process.stdout.isTTY === true && process.env.NO_COLOR === undefined && process.env.TERM !== 'dumb';

const paint = (code: string) => (text: string) => (useColor() ? `\x1b[${code}m${text}\x1b[0m` : text);
const bold = paint('1');
const dim = paint('2');
const red = paint('31');
const yellow = paint('33');
const green = paint('32');
const cyan = paint('36');

const SEVERITY_ICON: Record<QAIssue['severity'], string> = {
  critical: '✖',
  major: '▲',
  minor: '●',
};

function severityLabel(issue: QAIssue): string {
  const label = `${SEVERITY_ICON[issue.severity]} ${issue.severity.toUpperCase()}`;
  if (issue.severity === 'critical') return red(label);
  if (issue.severity === 'major') return yellow(label);
  return dim(label);
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Renders the human-facing CLI report printed at the end of `ghost-qa test`. */
export function formatTerminalSummary(report: GhostQAReport): string {
  const { summary } = report;
  const lines: string[] = [];

  lines.push('');
  lines.push(bold('👻 ghost-qa — autonomous browser verification'));
  lines.push(dim(`Target: ${report.targetUrl}`));
  lines.push(
    dim(
      `Duration: ${(report.durationMs / 1000).toFixed(1)}s · Viewports: ${report.options.viewports.join(' + ')} · Depth: ${report.options.maxDepth}`,
    ),
  );
  lines.push('');

  lines.push(bold('Routes crawled'));
  if (report.routes.length === 0) {
    lines.push(dim('  (none — target did not load)'));
  }
  for (const route of report.routes) {
    const status = route.httpStatus ? dim(` [${route.httpStatus}]`) : '';
    const issues = route.issueCount > 0 ? red(` ${route.issueCount} issue${route.issueCount === 1 ? '' : 's'}`) : green(' ✓');
    lines.push(`  ${cyan(route.path.padEnd(28))} ${dim(route.title ? truncate(route.title, 32) : '')}${status}${issues}`);
  }
  lines.push('');

  lines.push(bold('Coverage'));
  lines.push(`  Routes visited:       ${summary.routesCrawled}`);
  lines.push(`  Interactions tested:  ${summary.interactionsTested} passed · ${summary.interactionsFailed} failed · ${summary.interactionsSkipped} skipped (safety)`);
  lines.push(
    `  Issues:               ${summary.totalIssues} total — ${red(`${summary.bySeverity.critical} critical`)}, ${yellow(`${summary.bySeverity.major} major`)}, ${dim(`${summary.bySeverity.minor} minor`)}`,
  );
  if (report.health) {
    const score = report.health.score;
    const colored = score >= 90 ? green(`${score}/100`) : score >= 60 ? yellow(`${score}/100`) : red(`${score}/100`);
    lines.push(`  QA Health Score:      ${colored} — Grade ${bold(report.health.grade)} (8 traps · ${report.options.viewports.join(' + ')} · ${(report.options.colorSchemes ?? ['light']).join(' + ')})`);
    lines.push(
      dim(`  Per-trap:             ${report.health.byTrap.map((t) => `${t.trap} ${t.score}`).join(' · ')}`),
    );
  }
  lines.push('');

  if (report.issues.length > 0) {
    lines.push(bold('Failures caught'));
    const sorted = [...report.issues].sort((a, b) => a.route.localeCompare(b.route));
    for (const issue of sorted) {
      lines.push(`  ${severityLabel(issue)} ${dim(`[${issue.category}]`)} ${truncate(issue.message, 150)}`);
      lines.push(dim(`      ↳ ${issue.route} · ${issue.viewport} · #${issue.id}`));
    }
    lines.push('');
  }

  if (report.passed) {
    lines.push(green(bold('✔ GHOST-QA PASS — no blocking browser failures found. Safe to report done.')));
  } else {
    lines.push(red(bold('✖ GHOST-QA FAIL — blocking browser failures found. Fix them and re-run before reporting done.')));
    lines.push(dim('  Agent: read the Self-Healing Bug Report (ghost-qa-report.md / --json) and fix each issue by id.'));
  }
  lines.push('');
  return lines.join('\n');
}

export function printTerminalSummary(report: GhostQAReport): void {
  process.stdout.write(`${formatTerminalSummary(report)}\n`);
}
