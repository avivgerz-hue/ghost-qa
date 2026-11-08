import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { installSkill } from '../bin/ghost-qa.js';
import {
  claudePluginManifest,
  cursorRuleContent,
  openCodeConfig,
  vscodeMcpConfig,
  zedContextServerEntry,
} from '../src/agents/integrations.js';
import { GHOST_QA_VERSION } from '../src/engine/audit-runner.js';

const readText = (path: string): string => readFileSync(path, 'utf8');
const readJson = (path: string): Record<string, unknown> => JSON.parse(readText(path)) as Record<string, unknown>;
const root = process.cwd();

describe('GitHub Marketplace action.yml', () => {
  const action = readText(join(root, 'action.yml'));

  it('carries Marketplace branding and the composite runtime', () => {
    expect(action).toContain('branding:');
    expect(action).toContain('icon: "check-circle"');
    expect(action).toContain('color: "green"');
    expect(action).toContain('using: "composite"');
    expect(action).toContain('actions/setup-node@v4');
    expect(action).toContain('actions/upload-artifact@v4');
  });

  it('declares the required inputs with spec defaults', () => {
    for (const input of ['url:', 'cmd:', 'fail-on:', 'out-dir:', 'screenshots:']) {
      expect(action, input).toContain(input);
    }
    expect(action).toContain('default: "http://localhost:3000"');
    expect(action).toContain('default: "high"');
    expect(action).toContain('default: ".ghost-qa"');
    expect(action).toContain('default: "false"');
  });

  it('installs Chromium if needed and runs the pinned v2 CLI', () => {
    expect(action).toContain('playwright/cli.js" install --with-deps chromium');
    expect(action).toContain('npx -y ghost-qa@2.0.0');
    expect(action).toContain('--server-cmd');
    expect(action).toContain('--out-dir');
    expect(action).toContain('--screenshots');
  });
});

describe('universal agent config generators', () => {
  it('produce each ecosystem dialect around the same MCP command', () => {
    expect(openCodeConfig().mcp['ghost-qa']).toEqual({
      type: 'local',
      command: ['npx', '-y', 'ghost-qa', 'mcp'],
      enabled: true,
    });
    expect(vscodeMcpConfig().servers['ghost-qa']).toMatchObject({ type: 'stdio', command: 'npx' });
    expect(zedContextServerEntry().command).toEqual({ path: 'npx', args: ['-y', 'ghost-qa', 'mcp'] });
    const plugin = claudePluginManifest();
    expect(plugin.name).toBe('ghost-qa');
    expect(plugin.version).toBe(GHOST_QA_VERSION);
    expect(cursorRuleContent('PROTOCOL_BODY')).toContain('alwaysApply: true');
    expect(cursorRuleContent('PROTOCOL_BODY')).toContain('PROTOCOL_BODY');
  });
});

describe('ghost-qa init — universal agent installation', () => {
  it('connects all 8 agent ecosystems in a fresh project', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ghost-qa-init-'));
    const results = await installSkill(dir);
    const files = results.map((r) => r.file.replaceAll('\\', '/'));

    for (const expected of [
      '.claude/skills/ghost-qa/SKILL.md',
      '.agents/skills/ghost-qa/SKILL.md',
      '.mcp.json',
      '.claude-plugin/plugin.json',
      'opencode.json',
      'CLAUDE.md',
      'AGENTS.md',
      '.cursor/mcp.json',
      '.cursor/rules/ghost-qa.mdc',
      '.cursorrules',
      '.windsurfrules',
      '.vscode/mcp.json',
      '.github/copilot-instructions.md',
      '.clinerules',
      '.zed/settings.json',
    ]) {
      expect(files, expected).toContain(expected);
      expect(existsSync(join(dir, expected)), expected).toBe(true);
    }

    const claudeMcp = readJson(join(dir, '.mcp.json')) as { mcpServers: Record<string, { args: string[] }> };
    expect(claudeMcp.mcpServers['ghost-qa']?.args).toEqual(['-y', 'ghost-qa', 'mcp']);
    const plugin = readJson(join(dir, '.claude-plugin', 'plugin.json'));
    expect(plugin.name).toBe('ghost-qa');
    const opencode = readJson(join(dir, 'opencode.json')) as { $schema: string; mcp: Record<string, { type: string }> };
    expect(opencode.$schema).toContain('opencode.ai');
    expect(opencode.mcp['ghost-qa']?.type).toBe('local');
    const cursor = readJson(join(dir, '.cursor', 'mcp.json')) as { mcpServers: Record<string, unknown> };
    expect(cursor.mcpServers['ghost-qa']).toBeDefined();
    const vscode = readJson(join(dir, '.vscode', 'mcp.json')) as { servers: Record<string, { type: string }> };
    expect(vscode.servers['ghost-qa']?.type).toBe('stdio');
    const zed = readJson(join(dir, '.zed', 'settings.json')) as { context_servers: Record<string, { command: { path: string } }> };
    expect(zed.context_servers['ghost-qa']?.command.path).toBe('npx');

    expect(readText(join(dir, 'CLAUDE.md'))).toContain('ghost-qa:start');
    expect(readText(join(dir, 'AGENTS.md'))).toContain('QA Health Score');
    expect(readText(join(dir, '.clinerules'))).toContain('ghost-qa:start');
    expect(readText(join(dir, '.cursor', 'rules', 'ghost-qa.mdc'))).toContain('alwaysApply: true');
    expect(readText(join(dir, '.claude', 'skills', 'ghost-qa', 'SKILL.md'))).toContain('Staff QA Engineer Protocol');
  });

  it('is idempotent and preserves pre-existing user config', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ghost-qa-init2-'));
    await writeFile(join(dir, 'opencode.json'), JSON.stringify({ mcp: { other: { type: 'local', command: ['other'] } }, theme: 'dark' }), 'utf8');
    await mkdir(join(dir, '.zed'), { recursive: true });
    await writeFile(join(dir, '.zed', 'settings.json'), JSON.stringify({ theme: 'One Dark', context_servers: { other: {} } }), 'utf8');
    await writeFile(join(dir, 'CLAUDE.md'), '# My project rules\n', 'utf8');

    await installSkill(dir);
    const second = await installSkill(dir);

    const opencode = readJson(join(dir, 'opencode.json')) as { theme: string; mcp: Record<string, unknown> };
    expect(opencode.theme).toBe('dark');
    expect(opencode.mcp['other']).toBeDefined();
    expect(opencode.mcp['ghost-qa']).toBeDefined();
    const zed = readJson(join(dir, '.zed', 'settings.json')) as { theme: string; context_servers: Record<string, unknown> };
    expect(zed.theme).toBe('One Dark');
    expect(zed.context_servers['other']).toBeDefined();

    const claude = await readFile(join(dir, 'CLAUDE.md'), 'utf8');
    expect(claude.startsWith('# My project rules')).toBe(true);
    expect(claude.match(/ghost-qa:start/g)).toHaveLength(1);
    expect(second.find((r) => r.file === 'opencode.json')?.action).toBe('already configured');
  });
});

describe('README documents the universal integrations + GitHub Action', () => {
  const readme = readText(join(root, 'README.md'));
  it('has the supported-agents table and the CI action section', () => {
    expect(readme).toContain('Supported Coding Agents (Claude Code, OpenCode, Codex, Cursor, Windsurf, Copilot, Cline, Zed)');
    for (const agent of ['**Claude Code**', '**OpenCode**', '**Cursor**', '**Windsurf**', '**VS Code / GitHub Copilot**', '**Cline / Roo Code**', '**Zed**']) {
      expect(readme, agent).toContain(agent);
    }
    expect(readme).toContain('uses: avivgerz-hue/ghost-qa@v2');
    expect(readme).toContain('GitHub Actions CI');
  });
});

describe('repo dogfood files (auto-discovery in this repo)', () => {
  it('ships root AGENTS.md, CLAUDE.md, opencode.json and the Claude plugin manifest', () => {
    expect(readText(join(root, 'AGENTS.md'))).toContain('ghost-qa:start');
    expect(readText(join(root, 'CLAUDE.md'))).toContain('ghost-qa:start');
    const opencode = readJson(join(root, 'opencode.json')) as { mcp: Record<string, { type: string }> };
    expect(opencode.mcp['ghost-qa']?.type).toBe('local');
    const plugin = readJson(join(root, '.claude-plugin', 'plugin.json'));
    expect(plugin.name).toBe('ghost-qa');
    expect(plugin.version).toBe(GHOST_QA_VERSION);
  });
});
