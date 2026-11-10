import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const readme = readFileSync(join(root, 'README.md'), 'utf8');

describe('README top — 5-Second Rule star conversion', () => {
  it('leads with the Star CTA callout right under the badges', () => {
    expect(readme).toContain('⭐ **If this tool helps your AI coding workflow, please give this repository a Star!**');
    const badgesEnd = readme.indexOf('powered%20by-Playwright');
    const cta = readme.indexOf('please give this repository a Star');
    expect(cta).toBeGreaterThan(badgesEnd);
    expect(cta - badgesEnd).toBeLessThan(600); // above the fold, not buried
  });

  it('cross-links all 3 VibeFoundry sibling repos with their npx commands', () => {
    expect(readme).toContain('https://github.com/avivgerz-hue/unslop');
    expect(readme).toContain('npx -y unslop-mcp@latest init');
    expect(readme).toContain('https://github.com/avivgerz-hue/vibe-shield');
    expect(readme).toContain('npx -y @vibefoundry/vibe-shield@latest scan .');
    expect(readme).toContain('https://github.com/avivgerz-hue/ghost-qa');
    expect(readme).toContain('npx -y ghost-qa@latest test http://localhost:3000');
  });

  it('embeds the animated terminal demo above the fold + 1-line quickstart', () => {
    expect(readme).toContain('![Live Terminal Demo](assets/demo.svg)');
    const demo = readme.indexOf('![Live Terminal Demo](assets/demo.svg)');
    const quick = readme.indexOf('```bash\nnpx -y ghost-qa@latest test http://localhost:3000\n```');
    expect(quick).toBeGreaterThan(demo);
    expect(readme).toContain('![ghost-qa terminal preview](./assets/hero-terminal.svg)');
  });

  it('keeps the final suite section and the supported-agents table intact', () => {
    expect(readme.trimEnd().endsWith('Part of the VibeFoundry Agent Suite') || readme).toContain('## Part of the VibeFoundry Agent Suite');
    expect(readme).toContain('Supported Coding Agents (Claude Code, OpenCode, Codex, Cursor, Windsurf, Copilot, Cline, Zed)');
  });
});

describe('assets/demo.svg — self-contained animated terminal recording', () => {
  const svgPath = join(root, 'assets', 'demo.svg');

  it('exists, is valid self-contained SVG with pure-CSS looping animation', () => {
    expect(existsSync(svgPath)).toBe(true);
    const svg = readFileSync(svgPath, 'utf8');
    expect(svg).toContain('<svg');
    expect(svg).toContain('@keyframes');
    expect(svg).toContain('infinite'); // loops forever on GitHub
    expect(svg).not.toContain('<script');
    expect(svg).not.toContain('<image');
    expect(svg).not.toContain('@import');
    expect(svg).not.toContain('url(http'); // internal url(#clip) refs only — zero external fetches
  });

  it('shows the real CLI flow: catches bugs, before/after score, seconds-fast', () => {
    const svg = readFileSync(svgPath, 'utf8');
    expect(svg).toContain('npx -y ghost-qa@latest test http://localhost:3000');
    expect(svg).toContain('horizontal-overflow');
    expect(svg).toContain('small-touch-target');
    expect(svg).toContain('theme-contrast');
    expect(svg).toContain('hydration-mismatch');
    expect(svg).toContain('38/100');
    expect(svg).toContain('100/100');
    expect(svg).toContain('6.4s');
    expect(svg).toContain('Star Ghost-QA');
  });
});

describe('repo hygiene — removed surfaces stay removed', () => {
  it('has no docs/ Pages demo and no root action.yml', () => {
    expect(existsSync(join(root, 'docs', 'index.html'))).toBe(false);
    expect(existsSync(join(root, 'action.yml'))).toBe(false);
    expect(readme).not.toContain('avivgerz-hue.github.io/ghost-qa');
  });
});
