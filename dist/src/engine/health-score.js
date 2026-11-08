import { CATEGORY_TO_TRAP, TRAP_LABELS, } from '../types.js';
/**
 * Deterministic QA Health Score.
 *
 * Each of the eight traps starts at 100 and loses points per finding —
 * critical −25, major −10, minor −3 — floored at 0. The overall score is
 * the rounded mean of the eight trap scores, so the same DOM always earns
 * the same grade (no clocks, no randomness, no machine-dependent input).
 */
export const SCORE_DEDUCTIONS = {
    critical: 25,
    major: 10,
    minor: 3,
};
export const ALL_TRAPS = [
    'console',
    'network',
    'layout',
    'accessibility',
    'performance',
    'links',
    'seo',
    'theme',
];
export function gradeForScore(score) {
    if (score >= 97)
        return 'A+';
    if (score >= 93)
        return 'A';
    if (score >= 90)
        return 'A-';
    if (score >= 87)
        return 'B+';
    if (score >= 83)
        return 'B';
    if (score >= 80)
        return 'B-';
    if (score >= 77)
        return 'C+';
    if (score >= 73)
        return 'C';
    if (score >= 70)
        return 'C-';
    if (score >= 67)
        return 'D+';
    if (score >= 63)
        return 'D';
    if (score >= 60)
        return 'D-';
    return 'F';
}
export function computeHealthScore(issues) {
    const byTrap = ALL_TRAPS.map((trap) => {
        const trapIssues = issues.filter((issue) => CATEGORY_TO_TRAP[issue.category] === trap);
        const bySeverity = { critical: 0, major: 0, minor: 0 };
        let deductions = 0;
        for (const issue of trapIssues) {
            bySeverity[issue.severity] += 1;
            deductions += SCORE_DEDUCTIONS[issue.severity];
        }
        const score = Math.max(0, 100 - deductions);
        return {
            trap,
            label: TRAP_LABELS[trap],
            score,
            grade: gradeForScore(score),
            issues: trapIssues.length,
            bySeverity,
        };
    });
    const score = Math.round(byTrap.reduce((sum, t) => sum + t.score, 0) / byTrap.length);
    return { score, grade: gradeForScore(score), byTrap };
}
//# sourceMappingURL=health-score.js.map