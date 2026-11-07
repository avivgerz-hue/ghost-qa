import type { GhostQAReport } from '../types.js';
export declare function escapeHtml(value: string): string;
/**
 * A sleek, self-contained (zero external assets) dark-mode HTML dashboard
 * summarising one ghost-qa run — routes, interactions and every trap finding
 * across desktop and mobile. Safe to attach to CI artifacts or PRs.
 */
export declare function formatHtmlReport(report: GhostQAReport): string;
//# sourceMappingURL=html-report.d.ts.map