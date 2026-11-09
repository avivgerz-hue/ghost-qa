/**
 * Terminal Star CTA & QA Verified badge.
 *
 * Shown ONLY in human-readable surfaces: the terminal summary, `compare`,
 * `doctor` and `init` output, and the generated HTML report. It is never
 * emitted in `--json` machine output or anywhere on the MCP stdio channel
 * (stdout there is the JSON-RPC protocol — marketing bytes would corrupt
 * the stream and violate host trust).
 */
export const GITHUB_REPO_URL = 'https://github.com/avivgerz-hue/ghost-qa';
export const GITHUB_REPO_SLUG = 'avivgerz-hue/ghost-qa';

const GRADE_COLORS: Array<[RegExp, string]> = [
  [/^A/, '10b981'],
  [/^B/, '84cc16'],
  [/^C/, 'f59e0b'],
  [/^D/, 'f97316'],
  [/^F/, 'ef4444'],
];

export function badgeColorForGrade(grade: string): string {
  for (const [pattern, color] of GRADE_COLORS) {
    if (pattern.test(grade)) return color;
  }
  return '10b981';
}

/** Copy-pasteable README badge showing a QA Health Grade. */
export function badgeMarkdownForGrade(grade = 'A+'): string {
  const encodedGrade = grade.replace(/\+/g, '%2B').replace(/-/g, '--');
  return `[![Ghost-QA Verified](https://img.shields.io/badge/Ghost--QA-Grade_${encodedGrade}-${badgeColorForGrade(grade)})](${GITHUB_REPO_URL})`;
}

/**
 * The footer block. When a grade is known (test/compare runs) the badge
 * line shows THAT grade; doctor/init pass no grade and omit the badge.
 */
export function formatStarCta(grade?: string): string {
  const lines = [
    '★ Caught a bug before deploy? Star Ghost-QA on GitHub:',
    `  ${GITHUB_REPO_URL}`,
    `  Instant terminal star: gh repo star ${GITHUB_REPO_SLUG}`,
  ];
  if (grade) {
    lines.push(`  Badge for your README: ${badgeMarkdownForGrade(grade)}`);
  }
  return lines.join('\n');
}
