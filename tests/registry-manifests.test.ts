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

  it('glama.json names the maintainer, MIT license, and the live MCP tools', () => {
    const glama = readJson('glama.json');
    expect(glama.maintainers).toEqual(['avivgerz-hue']);
    expect(glama.license).toBe('MIT');
    const tools = glama.tools as ManifestTool[];
    expect(tools.map((t) => t.name)).toEqual(MCP_TOOLS.map((t) => t.name));
  });

  it('server.json passes the OFFICIAL MCP Registry schema shape (mcp-publisher validate)', () => {
    const server = readJson('server.json');
    const pkgJson = readJson('package.json');

    // npm ownership verification: package.json mcpName must exactly match server.json name.
    expect(pkgJson.mcpName).toBe('io.github.avivgerz-hue/ghost-qa');
    expect(server.name).toBe(pkgJson.mcpName);
    expect(server.$schema).toContain('modelcontextprotocol.io');

    // Official schema: description strictly 1..100 chars.
    const description = server.description as string;
    expect(description.length).toBeGreaterThanOrEqual(1);
    expect(description.length).toBeLessThanOrEqual(100);

    // Zero non-schema top-level fields (the official schema allows only these keys;
    // a `tools` array here is what made the old file fail server.schema.json).
    const allowed = ['$schema', '_meta', 'description', 'icons', 'name', 'packages', 'remotes', 'repository', 'title', 'version', 'websiteUrl'];
    for (const key of Object.keys(server)) {
      expect(allowed, `non-schema field: ${key}`).toContain(key);
    }
    expect(server).not.toHaveProperty('tools');

    // Version sync: server.json + packages[0] + package.json all equal the live version.
    expect(server.version).toBe(GHOST_QA_VERSION);
    expect(pkgJson.version).toBe(GHOST_QA_VERSION);

    const packages = server.packages as Array<{
      registryType: string; identifier: string; version: string;
      transport: { type: string };
      packageArguments: Array<{ type: string; value: string }>;
    }>;
    expect(packages).toHaveLength(1);
    expect(packages[0]).toMatchObject({ registryType: 'npm', identifier: pkgJson.name, transport: { type: 'stdio' } });
    expect(packages[0]?.version).toBe(GHOST_QA_VERSION);
    // Runnable spec: npx -y ghost-qa mcp  (identifier supplies the package name).
    expect(packages[0]?.packageArguments).toEqual([{ type: 'positional', value: 'mcp' }]);
  });

  it('glama tool definitions match the live MCP server exactly', () => {
    const glamaTools = (readJson('glama.json').tools as ManifestTool[]).map((t) => t.name);
    const liveTools = MCP_TOOLS.map((t) => t.name);
    expect(glamaTools).toEqual(liveTools);
    expect(liveTools).toEqual(['ghost_qa_audit_url', 'ghost_qa_compare', 'ghost_qa_doctor']);
  });

  it('CITATION.cff is CFF 1.2.0, authored by VibeFoundry, version-synced', () => {
    const cff = readText('CITATION.cff');
    expect(cff).toContain('cff-version: 1.2.0');
    expect(cff).toContain('name: "VibeFoundry"');
    expect(cff).toContain(`version: ${GHOST_QA_VERSION}`);
    expect(cff).toContain('repository-code: "https://github.com/avivgerz-hue/ghost-qa"');
    expect(cff).toContain('license: MIT');
  });

  it('ships a production Dockerfile whose entrypoint is the MCP server (Glama introspection)', () => {
    const dockerfile = readText('Dockerfile');
    expect(dockerfile).toContain('npm ci --omit=dev --ignore-scripts');
    expect(dockerfile).toContain('COPY dist/ ./dist/');
    expect(dockerfile).toContain('ENTRYPOINT ["node", "dist/bin/ghost-qa.js", "mcp"]');

    const dockerignore = readText('.dockerignore');
    expect(dockerignore).toContain('node_modules');
    expect(dockerignore).toContain('.git');
    // dist/ is prebuilt and copied into the image — it must never be ignored.
    expect(dockerignore.split('\n').map((l) => l.trim())).not.toContain('dist');
  });

  it('embeds the SVG terminal hero in the README below the badges', () => {
    const svg = readText('assets/hero-terminal.svg');
    expect(svg).toContain('<svg');
    expect(svg).toContain('8-TRAP ENGINE');
    expect(svg).toContain('768×1024');
    expect(svg).toContain('1440×900');
    expect(svg).toContain('375×812');
    expect(svg).toContain('hydration');
    expect(svg).toContain('Self-Healing Bug Report');
    expect(readText('README.md')).toContain('![ghost-qa terminal preview](./assets/hero-terminal.svg)');
  });

  it('package.json carries 30+ discoverability keywords incl. MCP terms', () => {
    const keywords = (readJson('package.json').keywords as string[]).map((k) => k.toLowerCase());
    expect(keywords.length).toBeGreaterThanOrEqual(30);
    for (const term of ['mcp', 'mcp-server', 'model-context-protocol', 'claude-code', 'agent-skills', 'playwright', 'self-healing', 'accessibility-testing']) {
      expect(keywords, term).toContain(term);
    }
  });
});
