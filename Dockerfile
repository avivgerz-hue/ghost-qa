# ghost-qa — production MCP server image
#
# Purpose: Glama (glama.ai/mcp/servers) and other MCP registries verify a
# server by starting this container and speaking MCP over stdio
# (`initialize`, then `tools/list`). ghost-qa answers both immediately:
# tools/list is served from the static tool manifest and never launches
# Chromium — a browser is only started when a tool is actually called.
#
# The repo ships a committed, prebuilt dist/, so this image performs no
# TypeScript compilation at build or run time.

FROM node:20-slim

LABEL org.opencontainers.image.title="ghost-qa" \
      org.opencontainers.image.description="Autonomous headless browser QA & self-healing verification loop for coding agents (CLI + native MCP server)." \
      org.opencontainers.image.source="https://github.com/avivgerz-hue/ghost-qa" \
      org.opencontainers.image.licenses="MIT"

ENV NODE_ENV=production \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

# Install production dependencies first (layer-cached unless the lockfile
# changes). --ignore-scripts also skips this package's own zero-build
# `prepare` hook and any Playwright browser download: introspection must
# work with no Chromium present.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

# Prebuilt CLI + MCP server (committed in the repository).
COPY dist/ ./dist/

# Run unprivileged; the MCP server only needs its own files readable.
USER node

# MCP over stdio: stdout is the JSON-RPC channel, diagnostics go to stderr.
ENTRYPOINT ["node", "dist/bin/ghost-qa.js", "mcp"]
