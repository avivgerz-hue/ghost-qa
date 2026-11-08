/**
 * Universal coding-agent integrations.
 *
 * One MCP server + one Staff QA Engineer Protocol, expressed in the native
 * config dialect of every major coding agent. All generators are pure so
 * `ghost-qa init`, the repo's own dogfood files, and the tests share a
 * single source of truth.
 */
export declare const GHOST_QA_MCP_COMMAND = "npx";
export declare const GHOST_QA_MCP_ARGS: readonly ["-y", "ghost-qa", "mcp"];
/** Claude Code / Cursor dialect: `{ mcpServers: { … } }`. */
export declare function mcpServersConfig(): {
    mcpServers: Record<string, {
        command: string;
        args: string[];
    }>;
};
/** OpenCode dialect: entry under `mcp` in opencode.json. */
export declare function openCodeMcpEntry(): {
    type: 'local';
    command: string[];
    enabled: boolean;
};
export declare function openCodeConfig(): {
    $schema: string;
    mcp: Record<string, ReturnType<typeof openCodeMcpEntry>>;
};
/** VS Code / GitHub Copilot dialect: `{ servers: { … } }` (.vscode/mcp.json). */
export declare function vscodeMcpConfig(): {
    servers: Record<string, {
        type: 'stdio';
        command: string;
        args: string[];
    }>;
};
/** Zed dialect: entry under `context_servers` in .zed/settings.json. */
export declare function zedContextServerEntry(): {
    command: {
        path: string;
        args: string[];
    };
    settings: Record<string, unknown>;
};
/** Claude Code plugin manifest (.claude-plugin/plugin.json). */
export declare function claudePluginManifest(): Record<string, unknown>;
/** Cursor rule (.cursor/rules/ghost-qa.mdc) wrapping the protocol. */
export declare function cursorRuleContent(protocolBody: string): string;
/** Windsurf/Cline/Copilot instruction files reuse the marker protocol. */
export declare const AGENT_INSTRUCTION_FILES: readonly ["CLAUDE.md", "AGENTS.md", ".cursorrules", ".windsurfrules", ".clinerules", ".github/copilot-instructions.md"];
//# sourceMappingURL=integrations.d.ts.map