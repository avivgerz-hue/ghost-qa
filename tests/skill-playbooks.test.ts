import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const skill = readFileSync(join(process.cwd(), 'SKILL.md'), 'utf8');

describe('SKILL.md — DOM-to-Component Fix Playbooks', () => {
  it('covers mobile horizontal overflow and bounding-box collisions (Trap 3)', () => {
    expect(skill).toContain('scrollWidth > innerWidth');
    expect(skill).toContain('horizontal-overflow');
    expect(skill).toContain('min-w-0');
    expect(skill).toContain('element-collision');
    expect(skill).toContain('bounding box');
  });

  it('fixes <44px touch targets without breaking desktop density', () => {
    expect(skill).toContain('small-touch-target');
    expect(skill).toContain('min-h-11 min-w-11 md:min-h-9');
    expect(skill).toContain('44×44');
  });

  it('fixes invisible dark-mode text via theme tokens (Trap 8)', () => {
    expect(skill).toContain('theme-contrast');
    expect(skill).toContain('dark:');
    expect(skill).toContain('prefers-color-scheme: dark');
    expect(skill).toContain('--ink');
  });

  it('fixes React/Next.js hydration mismatches without suppression cheats (Trap 1)', () => {
    expect(skill).toContain('hydration-mismatch');
    expect(skill).toContain('suppressHydrationWarning');
    expect(skill).toContain('useEffect');
    expect(skill).toContain('Forbidden');
  });

  it('keeps the 5-phase protocol and all 8 agent integrations documented', () => {
    for (const phase of ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5']) {
      expect(skill, phase).toContain(phase);
    }
    for (const agent of ['Claude Code', 'OpenCode', 'Codex', 'Cursor', 'Windsurf', 'Copilot', 'Cline', 'Zed']) {
      expect(skill + readFileSync(join(process.cwd(), 'README.md'), 'utf8'), agent).toContain(agent);
    }
  });

});
