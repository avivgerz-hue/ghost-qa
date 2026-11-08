/**
 * Token-efficient fix guidance per category. The agent reading the diagnostic
 * should be able to act without re-discovering first principles each run.
 */
export const FIX_PLAYBOOK = {
    console: 'Open the route, reproduce in a browser, and fix the throwing code path. For hydration mismatches, ensure server and client render identical markup (no Date/random/window at render time, no invalid HTML nesting like <p> inside <p>).',
    network: 'Check the failing endpoint/asset: verify the API route exists, returns 2xx, sends CORS headers for the page origin, and that static asset paths match files actually emitted to the public/build output.',
    layout: 'Inspect the flagged elements: constrain widths (max-width: 100%, min-width: 0 on flex/grid children), avoid 100vw with scrollbars, restore collapsed interactive elements to a visible size, and point <img> at assets that exist.',
    accessibility: 'Give every interactive element an accessible name (visible text or aria-label), add alt text to images (alt="" only when purely decorative), associate every form input with a real <label> or aria-label, and set a per-route <title> plus <html lang>.',
    performance: 'Bring the page inside budget: defer/async non-critical scripts, compress and lazy-load oversized assets, code-split large bundles, break up long main-thread tasks, avoid reading layout properties in loops after DOM writes, and prune excessive DOM nodes.',
    interaction: 'Reproduce the click/fill manually: check for overlays intercepting pointer events, disabled state that never clears, handlers throwing on click, and elements re-rendering between hover and click.',
    navigation: 'Verify the route exists, the dev server is running on the target origin, and redirects resolve to a 2xx page instead of looping or 404ing.',
    links: 'Replace placeholder hrefs ("", "#", javascript:void(0)) with real routes or <button> elements, fix dead anchors/routes, give in-form buttons an explicit type, and make disabled states discoverable or remove them.',
    seo: 'Set a unique 10–60 character <title> per route, add meta description, <html lang>, viewport meta, canonical link and the full OpenGraph set; make every id attribute unique.',
    theme: 'Replace hard-coded colours with theme-aware tokens (CSS variables, dark: variants, color-scheme aware design tokens) so text keeps WCAG contrast under both light and dark OS schemes.',
};
function groupBy(items, key) {
    const groups = new Map();
    for (const item of items) {
        const k = key(item);
        const bucket = groups.get(k) ?? [];
        bucket.push(item);
        groups.set(k, bucket);
    }
    return groups;
}
function issueLine(issue) {
    const details = issue.details
        ? ` (${Object.entries(issue.details)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ')})`
        : '';
    const selector = issue.selector ? ` selector=\`${issue.selector}\`` : '';
    const box = issue.boundingBox
        ? ` box=${issue.boundingBox.x},${issue.boundingBox.y} ${issue.boundingBox.width}×${issue.boundingBox.height}`
        : '';
    const scheme = issue.colorScheme ? `/${issue.colorScheme}` : '';
    return `- [#${issue.id}] (${issue.severity}/${issue.viewport}${scheme} ${issue.route}) ${issue.message}${details}${selector}${box}`;
}
/**
 * The Self-Healing Bug Report: deliberately compact Markdown an agent can
 * paste into its own context — verdict first, issues grouped by route, one
 * fix playbook line per category, then the re-verify command.
 */
export function formatAgentDiagnostic(report) {
    const { summary } = report;
    const lines = [];
    lines.push('# 👻 ghost-qa — Self-Healing Bug Report');
    lines.push('');
    lines.push(`**Verdict:** ${report.passed ? '✅ PASS — browser verification clean' : '❌ FAIL — do NOT report task complete'}`);
    lines.push(`**Target:** ${report.targetUrl}`);
    lines.push(`**Coverage:** ${summary.routesCrawled} routes · ${summary.interactionsTested} interactions passed · ${summary.interactionsFailed} failed · ${summary.interactionsSkipped} skipped (safety)`);
    lines.push(`**Issues:** ${summary.totalIssues} (${summary.bySeverity.critical} critical, ${summary.bySeverity.major} major, ${summary.bySeverity.minor} minor)`);
    if (report.health) {
        lines.push(`**QA Health Score:** ${report.health.score}/100 — Grade **${report.health.grade}** ` +
            `(per-trap: ${report.health.byTrap.map((t) => `${t.trap} ${t.score}`).join(' · ')})`);
    }
    lines.push('');
    if (report.issues.length === 0) {
        lines.push('No failures were trapped by the 8-Trap Engine on desktop 1440×900, tablet 768×1024 or mobile 375×812 (light + dark).');
        lines.push('You may report the task complete.');
        return lines.join('\n');
    }
    lines.push('## Bugs to fix (grouped by route)');
    const byRoute = groupBy(report.issues, (i) => i.route);
    for (const [route, issues] of [...byRoute.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        lines.push('');
        lines.push(`### ${route}`);
        for (const issue of issues)
            lines.push(issueLine(issue));
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
    lines.push(`2. Re-run: \`npx -y ghost-qa test ${report.targetUrl}\``);
    lines.push('3. Repeat until ghost-qa prints PASS. Only then report the task complete to the user.');
    return lines.join('\n');
}
/**
 * PATCH-PROMPT.md — copy-paste remediation instructions for a coding agent:
 * every finding with its exact DOM selector, bounding box, root-cause hint
 * and the closed-loop compare protocol to prove the fix.
 */
export function formatPatchPrompt(report) {
    const lines = [];
    lines.push('# 👻 ghost-qa — PATCH PROMPT');
    lines.push('');
    lines.push('You are fixing browser-verified defects. Work ONLY from the findings below: fix the root cause in source for each, ' +
        'never silence the checker, never delete the failing UI, and never add suppressHydrationWarning-style workarounds.');
    if (report.health) {
        lines.push('');
        lines.push(`Current QA Health Score: **${report.health.score}/100 (Grade ${report.health.grade})**. Goal: 95–100 (A+) with zero critical/major findings and zero regressions.`);
    }
    lines.push('');
    lines.push('## Findings to remediate');
    if (report.issues.length === 0)
        lines.push('- none — browser verification is clean.');
    for (const issue of report.issues) {
        lines.push('');
        lines.push(`### [#${issue.id}] ${issue.severity.toUpperCase()} · ${issue.category}/${issue.type} · ${issue.route} · ${issue.viewport}${issue.colorScheme ? ` · ${issue.colorScheme}` : ''}`);
        lines.push(`- Problem: ${issue.message}`);
        if (issue.selector)
            lines.push(`- DOM selector: \`${issue.selector}\` — find the component that renders this element (search by id/data-testid/class or visible text) and fix it there.`);
        if (issue.boundingBox)
            lines.push(`- Bounding box: x=${issue.boundingBox.x}, y=${issue.boundingBox.y}, ${issue.boundingBox.width}×${issue.boundingBox.height}px.`);
        if (issue.stack)
            lines.push(`- Stack (first frames): \`${issue.stack.split('\n').slice(0, 3).join(' ⏎ ').slice(0, 400)}\``);
        lines.push(`- Root-cause guidance: ${FIX_PLAYBOOK[issue.category]}`);
    }
    lines.push('');
    lines.push('## Prove the fix (closed loop)');
    lines.push('1. Re-run the audit and save the new JSON: `npx -y ghost-qa test ' + report.targetUrl + ' --json > after.json`');
    lines.push('2. Compare against the baseline: `npx -y ghost-qa compare before.json after.json` (or the `ghost_qa_compare` MCP tool).');
    lines.push('3. Done only when the delta shows zero new regressions, zero remaining critical/major findings, and QA Health Score ≥ 95.');
    return `${lines.join('\n')}\n`;
}
/** Structured JSON for CI gates and programmatic agent tooling. */
export function formatAgentDiagnosticJson(report) {
    return `${JSON.stringify(report, null, 2)}\n`;
}
export function formatDiagnostic(report, format) {
    return format === 'json' ? formatAgentDiagnosticJson(report) : formatAgentDiagnostic(report);
}
//# sourceMappingURL=agent-diagnostic.js.map