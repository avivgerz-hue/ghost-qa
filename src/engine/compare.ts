import type { GhostQAReport, QAIssue } from '../types.js';
import { computeHealthScore } from './health-score.js';

/**
 * Regression & Verification Delta engine (`ghost-qa compare` /
 * `ghost_qa_compare`).
 *
 * Findings are matched by their stable fingerprint id, so the same bug in
 * the same route/viewport/scheme lines up across runs even though issue
 * ordering and timestamps change. A finding present afterwards but absent
 * before is a NEW REGRESSION; present before but gone after is FIXED.
 */
export interface CompareDelta {
  tool: 'ghost-qa-compare';
  beforeScore: number;
  afterScore: number;
  /** afterScore − beforeScore (positive means the app got healthier). */
  scoreDelta: number;
  beforeGrade: string;
  afterGrade: string;
  fixedFindings: QAIssue[];
  newRegressions: QAIssue[];
  remainingFindings: QAIssue[];
  counts: {
    before: number;
    after: number;
    fixed: number;
    newRegressions: number;
    remaining: number;
  };
  /** True when the fix loop may stop: no regressions, nothing blocking left. */
  verified: boolean;
}

type ReportLike = Pick<GhostQAReport, 'issues'> &
  Partial<Pick<GhostQAReport, 'health' | 'targetUrl' | 'version'>>;

function scoreOf(report: ReportLike): { score: number; grade: string } {
  if (report.health) return { score: report.health.score, grade: report.health.grade };
  const computed = computeHealthScore(report.issues ?? []);
  return { score: computed.score, grade: computed.grade };
}

export function compareReports(before: ReportLike, after: ReportLike): CompareDelta {
  const beforeIssues = before.issues ?? [];
  const afterIssues = after.issues ?? [];
  const beforeById = new Map(beforeIssues.map((i) => [i.id, i]));
  const afterById = new Map(afterIssues.map((i) => [i.id, i]));

  const fixedFindings = beforeIssues.filter((i) => !afterById.has(i.id));
  const newRegressions = afterIssues.filter((i) => !beforeById.has(i.id));
  const remainingFindings = afterIssues.filter((i) => beforeById.has(i.id));

  const b = scoreOf(before);
  const a = scoreOf(after);
  const blockingRemaining = remainingFindings.some(
    (i) => i.severity === 'critical' || i.severity === 'major',
  );

  return {
    tool: 'ghost-qa-compare',
    beforeScore: b.score,
    afterScore: a.score,
    scoreDelta: a.score - b.score,
    beforeGrade: b.grade,
    afterGrade: a.grade,
    fixedFindings,
    newRegressions,
    remainingFindings,
    counts: {
      before: beforeIssues.length,
      after: afterIssues.length,
      fixed: fixedFindings.length,
      newRegressions: newRegressions.length,
      remaining: remainingFindings.length,
    },
    verified: newRegressions.length === 0 && !blockingRemaining && a.score >= 95,
  };
}

const fmtIssue = (issue: QAIssue): string =>
  `- [#${issue.id}] (${issue.severity}/${issue.category} · ${issue.route} · ${issue.viewport}${issue.colorScheme ? ` · ${issue.colorScheme}` : ''}) ${issue.message}`;

/** Human/agent-readable Regression & Verification Delta Report. */
export function formatCompareReport(delta: CompareDelta): string {
  const lines: string[] = [];
  lines.push('# 👻 ghost-qa — Regression & Verification Delta Report');
  lines.push('');
  lines.push(
    `**QA Health Score:** ${delta.beforeScore} (${delta.beforeGrade}) → ${delta.afterScore} (${delta.afterGrade}) ` +
      `(${delta.scoreDelta >= 0 ? '+' : ''}${delta.scoreDelta})`,
  );
  lines.push(
    `**Findings:** ${delta.counts.before} before · ${delta.counts.after} after · ` +
      `${delta.counts.fixed} fixed · ${delta.counts.newRegressions} new regressions · ${delta.counts.remaining} remaining`,
  );
  lines.push(
    `**Verdict:** ${delta.verified ? '✅ VERIFIED — score ≥ 95 (A+ band), zero regressions, no blocking findings remain' : '❌ NOT YET VERIFIED — keep fixing (goal: score 95–100, zero regressions, zero critical/major remaining)'}`,
  );

  const section = (title: string, issues: QAIssue[]) => {
    lines.push('');
    lines.push(`## ${title} (${issues.length})`);
    if (issues.length === 0) lines.push('- none');
    for (const issue of issues) lines.push(fmtIssue(issue));
  };
  section('Fixed findings', delta.fixedFindings);
  section('New regressions', delta.newRegressions);
  section('Remaining findings', delta.remainingFindings);
  return `${lines.join('\n')}\n`;
}
