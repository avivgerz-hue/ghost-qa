import type { GhostQAReport, IssueCategory } from '../types.js';
/**
 * Token-efficient fix guidance per category. The agent reading the diagnostic
 * should be able to act without re-discovering first principles each run.
 */
export declare const FIX_PLAYBOOK: Record<IssueCategory, string>;
/**
 * The Self-Healing Bug Report: deliberately compact Markdown an agent can
 * paste into its own context — verdict first, issues grouped by route, one
 * fix playbook line per category, then the re-verify command.
 */
export declare function formatAgentDiagnostic(report: GhostQAReport): string;
/** Structured JSON for CI gates and programmatic agent tooling. */
export declare function formatAgentDiagnosticJson(report: GhostQAReport): string;
export type DiagnosticFormat = 'markdown' | 'json';
export declare function formatDiagnostic(report: GhostQAReport, format: DiagnosticFormat): string;
//# sourceMappingURL=agent-diagnostic.d.ts.map