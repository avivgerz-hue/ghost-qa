/**
 * Terminal Star CTA & QA Verified badge.
 *
 * Shown ONLY in human-readable surfaces: the terminal summary, `compare`,
 * `doctor` and `init` output, and the generated HTML report. It is never
 * emitted in `--json` machine output or anywhere on the MCP stdio channel
 * (stdout there is the JSON-RPC protocol — marketing bytes would corrupt
 * the stream and violate host trust).
 */
export declare const GITHUB_REPO_URL = "https://github.com/avivgerz-hue/ghost-qa";
export declare const GITHUB_REPO_SLUG = "avivgerz-hue/ghost-qa";
export declare function badgeColorForGrade(grade: string): string;
/** Copy-pasteable README badge showing a QA Health Grade. */
export declare function badgeMarkdownForGrade(grade?: string): string;
/**
 * The footer block. When a grade is known (test/compare runs) the badge
 * line shows THAT grade; doctor/init pass no grade and omit the badge.
 */
export declare function formatStarCta(grade?: string): string;
//# sourceMappingURL=star-cta.d.ts.map