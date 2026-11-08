import { type HealthScore, type IssueSeverity, type QAIssue, type TrapName } from '../types.js';
/**
 * Deterministic QA Health Score.
 *
 * Each of the eight traps starts at 100 and loses points per finding —
 * critical −25, major −10, minor −3 — floored at 0. The overall score is
 * the rounded mean of the eight trap scores, so the same DOM always earns
 * the same grade (no clocks, no randomness, no machine-dependent input).
 */
export declare const SCORE_DEDUCTIONS: Record<IssueSeverity, number>;
export declare const ALL_TRAPS: TrapName[];
export declare function gradeForScore(score: number): string;
export declare function computeHealthScore(issues: QAIssue[]): HealthScore;
//# sourceMappingURL=health-score.d.ts.map