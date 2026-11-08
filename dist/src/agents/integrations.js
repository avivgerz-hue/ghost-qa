import { GHOST_QA_VERSION } from '../engine/version.js';
/**
 * Universal coding-agent integrations.
 *
 * One MCP server + one Staff QA Engineer Protocol, expressed in the native
 * config dialect of every major coding agent. All generators are pure so
 * `ghost-qa init`, the repo's own dogfood files, and the tests share a
 * single source of truth.
 */
export const GHOST_QA_MCP_COMMAND = 'npx';
export const GHOST_QA_MCP_ARGS = ['-y', 'ghost-qa', 'mcp'];
/** Claude Code / Cursor dialect: `{ mcpServers: { … } }`. */
export function mcpServersConfig() {
    return {
        mcpServers: {
            'ghost-qa': { command: GHOST_QA_MCP_COMMAND, args: [...GHOST_QA_MCP_ARGS] },
        },
    };
}
/** OpenCode dialect: entry under `mcp` in opencode.json. */
export function openCodeMcpEntry() {
    return {
        type: 'local',
        command: [GHOST_QA_MCP_COMMAND, ...GHOST_QA_MCP_ARGS],
        enabled: true,
    };
}
export function openCodeConfig() {
    return {
        $schema: 'https://opencode.ai/config.json',
        mcp: { 'ghost-qa': openCodeMcpEntry() },
    };
}
/** VS Code / GitHub Copilot dialect: `{ servers: { … } }` (.vscode/mcp.json). */
export function vscodeMcpConfig() {
    return {
        servers: {
            'ghost-qa': { type: 'stdio', command: GHOST_QA_MCP_COMMAND, args: [...GHOST_QA_MCP_ARGS] },
        },
    };
}
/** Zed dialect: entry under `context_servers` in .zed/settings.json. */
export function zedContextServerEntry() {
    return {
        command: { path: GHOST_QA_MCP_COMMAND, args: [...GHOST_QA_MCP_ARGS] },
        settings: {},
    };
}
/** Claude Code plugin manifest (.claude-plugin/plugin.json). */
export function claudePluginManifest() {
    return {
        name: 'ghost-qa',
        version: GHOST_QA_VERSION,
        description: 'Autonomous headless browser QA & self-healing verification loop for coding agents. 8-trap deep browser inspection (console, network, layout, WCAG a11y + keyboard focus, Core Web Vitals, links, SEO, theme parity) across desktop/tablet/mobile in light + dark, QA Health Score (A+ to F), and ghost_qa_compare regression diffing.',
        author: { name: 'VibeFoundry', url: 'https://github.com/avivgerz-hue' },
        license: 'MIT',
        homepage: 'https://github.com/avivgerz-hue/ghost-qa',
        repository: 'https://github.com/avivgerz-hue/ghost-qa',
        keywords: ['mcp', 'qa', 'playwright', 'browser-testing', 'code-review', 'testing'],
    };
}
/** Cursor rule (.cursor/rules/ghost-qa.mdc) wrapping the protocol. */
export function cursorRuleContent(protocolBody) {
    return `---
description: ghost-qa — verify frontend work in a real browser (8 traps, 3 viewports, light/dark) before reporting done; closed-loop compare until QA Health Score 95-100
globs:
  - "src/**"
  - "app/**"
  - "pages/**"
  - "components/**"
alwaysApply: true
---

${protocolBody}
`;
}
/** Windsurf/Cline/Copilot instruction files reuse the marker protocol. */
export const AGENT_INSTRUCTION_FILES = [
    'CLAUDE.md',
    'AGENTS.md',
    '.cursorrules',
    '.windsurfrules',
    '.clinerules',
    '.github/copilot-instructions.md',
];
//# sourceMappingURL=integrations.js.map