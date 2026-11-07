import type { GhostQAReport, IssueCategory, QAIssue } from '../types.js';

/**
 * Token-efficient fix guidance per category. The agent reading the diagnostic
 * should be able to act without re-discovering first principles each run.
 */
export const FIX_PLAYBOOK: Record<IssueCategory, string> = {
  console:
    'Open the route, reproduce in a browser, and fix the throwing code path. For hydration mismatches, ensure server and client render identical markup (no Date/random/window at render time, no invalid HTML nesting like <p> inside <p>).',
  network:
    'Check the failing endpoint/asset: verify the API route exists, returns 2xx, sends CORS headers for the page origin, and that static asset paths match files actually emitted to the public/build output.',
  layout:
    'Inspect the flagged elements: constrain widths (max-width: 100%, min-width: 0 on flex/grid children), avoid 100vw with scrollbars, restore collapsed interactive elements to a visible size, and point <img> at assets that exist.',
  interaction:
    'Reproduce the click/fill manually: check for overlays intercepting pointer events, disabled state that never clears, handlers throwing on click, and elements re-rendering between hover and click.',
  navigation:
    'Verify the route exists, the dev server is running on the target origin, and redirects resolve to a 2xx page instead of looping or 404ing.',
};

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = groups.get(k) ?? [];
    bucket.push(item);
    groups.set(k, bucket);
  }
  return groups;
}

function issueLine(issue: QAIssue): string {
  const details = issue.details
    ? ` (${Object.entries(issue.details)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')})`
    : '';
  return `- [#${issue.id}] (${issue.severity}/${issue.viewport} ${issue.route}) ${issue.message}${details}`;
}

/**
 * The Self-Healing Bug Report: deliberately compact Markdown an agent can
 * paste into its own context — verdict first, issues grouped by route, one
 * fix playbook line per category, then the re-verify command.
 */
export function formatAgentDiagnostic(report: GhostQAReport): string {
  const { summary } = report;
  const lines: string[] = [];

  lines.push('# 👻 ghost-qa — Self-Healing Bug Report');
  lines.push('');
  lines.push(`**Verdict:** ${report.passed ? '✅ PASS — browser verification clean' : '❌ FAIL — do NOT report task complete'}`);
  lines.push(`**Target:** ${report.targetUrl}`);
  lines.push(
    `**Coverage:** ${summary.routesCrawled} routes · ${summary.interactionsTested} interactions passed · ${summary.interactionsFailed} failed · ${summary.interactionsSkipped} skipped (safety)`,
  );
  lines.push(
    `**Issues:** ${summary.totalIssues} (${summary.bySeverity.critical} critical, ${summary.bySeverity.major} major, ${summary.bySeverity.minor} minor)`,
  );
  lines.push('');

  if (report.issues.length === 0) {
    lines.push('No console, network, layout or interaction failures were trapped on desktop (1440×900) or mobile (390×844).');
    lines.push('You may report the task complete.');
    return lines.join('\n');
  }

  lines.push('## Bugs to fix (grouped by route)');
  const byRoute = groupBy(report.issues, (i) => i.route);
  for (const [route, issues] of [...byRoute.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push('');
    lines.push(`### ${route}`);
    for (const issue of issues) lines.push(issueLine(issue));
  }

  lines.push('');
  lines.push('## Fix playbook');
  const categories = [...new Set(report.issues.map((i) => i.category))];
  for (const category of categories) {
    lines.push(`- **${category}:** ${FIX_PLAYBOOK[category]}`);
  }

  lines.push('');
  lines.push('## Self-healing loop');
  lines.push('1. Fix each bug above in source (reference issues by `#id`).');
  lines.push(`2. Re-run: \`npx ghost-qa test ${report.targetUrl}\``);
  lines.push('3. Repeat until ghost-qa prints PASS. Only then report the task complete to the user.');
  return lines.join('\n');
}

/** Structured JSON for CI gates and programmatic agent tooling. */
export function formatAgentDiagnosticJson(report: GhostQAReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export type DiagnosticFormat = 'markdown' | 'json';

export function formatDiagnostic(report: GhostQAReport, format: DiagnosticFormat): string {
  return format === 'json' ? formatAgentDiagnosticJson(report) : formatAgentDiagnostic(report);
}
