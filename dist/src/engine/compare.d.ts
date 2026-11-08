import type { GhostQAReport, QAIssue } from '../types.js';
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
type ReportLike = Pick<GhostQAReport, 'issues'> & Partial<Pick<GhostQAReport, 'health' | 'targetUrl' | 'version'>>;
export declare function compareReports(before: ReportLike, after: ReportLike): CompareDelta;
/** Human/agent-readable Regression & Verification Delta Report. */
export declare function formatCompareReport(delta: CompareDelta): string;
export {};
//# sourceMappingURL=compare.d.ts.map