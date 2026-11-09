import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { badgeColorForGrade, badgeMarkdownForGrade, formatStarCta, GITHUB_REPO_URL } from '../src/reporter/star-cta.js';
import { formatTerminalSummary } from '../src/reporter/terminal-summary.js';
import { formatHtmlReport } from '../src/reporter/html-report.js';
import { formatAgentDiagnostic, formatDiagnostic } from '../src/reporter/agent-diagnostic.js';
import { formatCompareReport, compareReports } from '../src/engine/compare.js';
import { computeHealthScore } from '../src/engine/health-score.js';
import { makeIssue, summarise, type GhostQAReport, type QAIssue } from '../src/types.js';
import { GHOST_QA_VERSION } from '../src/engine/audit-runner.js';

const root = process.cwd();
const readText = (name: string): string => readFileSync(join(root, name), 'utf8');

function reportWith(issues: QAIssue[], grade?: string): GhostQAReport {
  const routes = [
    { url: 'http://localhost:3000/', path: '/', depth: 0, title: 'Home', httpStatus: 200, viewports: ['desktop', 'tablet', 'mobile'] as GhostQAReport['routes'][number]['viewports'], issueCount: issues.length },
  ];
  const summary = summarise(routes, [], issues, 'major');
  const health = computeHealthScore(issues);
  if (grade) health.grade = grade;
  return {
    tool: 'ghost-qa',
    version: GHOST_QA_VERSION,
    targetUrl: 'http://localhost:3000/',
    startedAt: '2026-11-09T00:00:00.000Z',
    finishedAt: '2026-11-09T00:00:01.000Z',
    durationMs: 1000,
    passed: summary.passed,
    options: { maxDepth: 2, maxRoutes: 25, maxInteractionsPerPage: 12, timeoutMs: 15000, settleMs: 600, headless: true, viewports: ['desktop', 'tablet', 'mobile'], interactions: true, failOn: 'major', colorSchemes: ['light', 'dark'] },
    routes,
    interactions: [],
    issues,
    health,
    summary: { ...summary, healthScore: health.score, grade: health.grade },
  };
}

describe('Terminal Star CTA', () => {
  it('renders the star lines and the grade badge', () => {
    const cta = formatStarCta('A+');
    expect(cta).toContain('★ Caught a bug before deploy? Star Ghost-QA on GitHub:');
    expect(cta).toContain(GITHUB_REPO_URL);
    expect(cta).toContain('Instant terminal star: gh repo star avivgerz-hue/ghost-qa');
    expect(cta).toContain(badgeMarkdownForGrade('A+'));
    expect(badgeMarkdownForGrade('A+')).toContain('Ghost--QA-Grade_A%2B-10b981');
    expect(badgeMarkdownForGrade('F')).toContain('Grade_F-ef4444');
    expect(badgeColorForGrade('B')).toBe('84cc16');
  });

  it('omits the badge when no grade is known (doctor/init)', () => {
    const cta = formatStarCta();
    expect(cta).toContain('Star Ghost-QA on GitHub');
    expect(cta).not.toContain('img.shields.io');
  });

  it('appears at the bottom of the human terminal summary', () => {
    const html = formatTerminalSummary(reportWith([]));
    expect(html).toContain('GHOST-QA PASS');
    expect(html.indexOf('Star Ghost-QA on GitHub')).toBeGreaterThan(html.indexOf('GHOST-QA PASS'));
    expect(html).toContain('Grade_A%2B');
  });
});

describe('CTA hygiene — never in machine or MCP output', () => {
  it('--json diagnostic output contains no CTA', () => {
    const json = formatDiagnostic(reportWith([]), 'json');
    expect(json).not.toContain('Star Ghost-QA');
    expect(json).not.toContain('gh repo star');
    const md = formatAgentDiagnostic(reportWith([]));
    expect(md).not.toContain('gh repo star');
  });

  it('compare markdown (shared with the MCP tool) contains no CTA', () => {
    const bug = makeIssue({ category: 'console', severity: 'critical', type: 'page-error', message: 'boom', route: '/', viewport: 'desktop' });
    const delta = compareReports(reportWith([bug]), reportWith([]));
    const text = formatCompareReport(delta);
    expect(text).toContain('Delta Report');
    expect(text).not.toContain('Star Ghost-QA');
  });
});

describe('HTML report carries the CTA + badge in header and footer', () => {
  it('includes star CTA and the copy-pasteable badge for the run grade', () => {
    const html = formatHtmlReport(reportWith([], 'A+'));
    expect(html).toContain('Star Ghost-QA on GitHub');
    expect(html).toContain('gh repo star avivgerz-hue/ghost-qa');
    expect(html).toContain('Ghost--QA-Grade_A%2B-10b981');
    expect(html).not.toMatch(/<script src=|<link rel="stylesheet" href=/);
  });
});
