import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MCP_TOOLS } from '../src/mcp/server.js';
import { GHOST_QA_VERSION } from '../src/engine/audit-runner.js';

const root = process.cwd();
const readJson = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(root, name), 'utf8')) as Record<string, unknown>;
const readText = (name: string): string => readFileSync(join(root, name), 'utf8');

interface ManifestTool {
  name: string;
  description: string;
  inputSchema: { type: string; required?: string[] };
}

describe('MCP registry manifests (smithery / glama / official registry)', () => {
  it('ships all three manifests + CITATION.cff in the repo root', () => {
    for (const file of ['smithery.yaml', 'glama.json', 'server.json', 'CITATION.cff']) {
      expect(existsSync(join(root, file)), file).toBe(true);
    }
  });

  it('smithery.yaml configures the stdio server with the committed dist entry', () => {
    const yaml = readText('smithery.yaml');
    expect(yaml).toContain('type: stdio');
    expect(yaml).toContain('dist/bin/ghost-qa.js');
    expect(yaml).toContain('mcp');
    expect(yaml).toContain('commandFunction');
  });

  it('glama.json names the maintainer, MIT license, and both MCP tools', () => {
    const glama = readJson('glama.json');
    expect(glama.maintainers).toEqual(['avivgerz-hue']);
    expect(glama.license).toBe('MIT');
    const tools = glama.tools as ManifestTool[];
    expect(tools.map((t) => t.name)).toEqual(MCP_TOOLS.map((t) => t.name));
  });

  it('server.json follows the official registry shape and stays version-synced', () => {
    const server = readJson('server.json');
    expect(server.$schema).toContain('modelcontextprotocol.io');
    expect(server.name).toBe('io.github.avivgerz-hue/ghost-qa');
    expect(server.version).toBe(GHOST_QA_VERSION);

    const pkgJson = readJson('package.json');
    expect(pkgJson.version).toBe(GHOST_QA_VERSION);

    const packages = server.packages as Array<{ registryType: string; identifier: string; transport: { type: string }; packageArguments: Array<{ value: string }> }>;
    expect(packages[0]).toMatchObject({ registryType: 'npm', identifier: 'ghost-qa', transport: { type: 'stdio' } });
    // No npm account required: the runnable spec resolves straight from GitHub.
    expect(packages[0]?.packageArguments[0]?.value).toBe('github:avivgerz-hue/ghost-qa');

    const tools = server.tools as ManifestTool[];
    expect(tools.map((t) => t.name)).toEqual(['ghost_qa_audit_url', 'ghost_qa_doctor']);
    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(40);
      expect(tool.inputSchema.type).toBe('object');
    }
    expect(tools[0]?.inputSchema.required).toEqual(['url']);
  });

  it('manifest tool definitions match the live MCP server exactly', () => {
    const serverTools = (readJson('server.json').tools as ManifestTool[]).map((t) => t.name);
    const glamaTools = (readJson('glama.json').tools as ManifestTool[]).map((t) => t.name);
    const liveTools = MCP_TOOLS.map((t) => t.name);
    expect(serverTools).toEqual(liveTools);
    expect(glamaTools).toEqual(liveTools);
  });

  it('CITATION.cff is CFF 1.2.0, authored by VibeFoundry, version-synced', () => {
    const cff = readText('CITATION.cff');
    expect(cff).toContain('cff-version: 1.2.0');
    expect(cff).toContain('name: "VibeFoundry"');
    expect(cff).toContain(`version: ${GHOST_QA_VERSION}`);
    expect(cff).toContain('repository-code: "https://github.com/avivgerz-hue/ghost-qa"');
    expect(cff).toContain('license: MIT');
  });

  it('package.json carries 30+ discoverability keywords incl. MCP terms', () => {
    const keywords = (readJson('package.json').keywords as string[]).map((k) => k.toLowerCase());
    expect(keywords.length).toBeGreaterThanOrEqual(30);
    for (const term of ['mcp', 'mcp-server', 'model-context-protocol', 'claude-code', 'agent-skills', 'playwright', 'self-healing', 'accessibility-testing']) {
      expect(keywords, term).toContain(term);
    }
  });
});
