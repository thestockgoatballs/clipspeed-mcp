#!/usr/bin/env node
// mcp/clipspeed-mcp/bin/cli.js
//
// Entry point for the clipspeed-mcp package.
//   clipspeed-mcp install [--key csai_live_...]   → wire up Claude Desktop config
//   clipspeed-mcp                                  → run the stdio MCP server
//
// Serving reads CLIPSPEED_API_KEY (required) and CLIPSPEED_BASE_URL
// (default https://api.clipspeed.ai). The key is never logged.

'use strict';

const DEFAULT_BASE_URL = 'https://api.clipspeed.ai';

async function main() {
  const sub = process.argv[2];

  if (sub === 'install') {
    const { install } = require('../src/install');
    const code = await install(process.argv.slice(3));
    process.exit(code || 0);
    return;
  }

  if (sub === '--help' || sub === '-h' || sub === 'help') {
    process.stderr.write(
      [
        'clipspeed-mcp — ClipSpeed MCP server',
        '',
        'Usage:',
        '  clipspeed-mcp install [--key csai_live_...]   Configure Claude Desktop',
        '  clipspeed-mcp                                 Run the stdio MCP server',
        '',
        'Env:',
        '  CLIPSPEED_API_KEY   (required to serve) your personal csai_live_ key',
        `  CLIPSPEED_BASE_URL  (default ${DEFAULT_BASE_URL})`,
        '',
        'Get a key: https://www.clipspeed.ai/dashboard/api-key/',
        '',
      ].join('\n')
    );
    process.exit(0);
    return;
  }

  // Default: serve.
  const apiKey = process.env.CLIPSPEED_API_KEY;
  const baseUrl = process.env.CLIPSPEED_BASE_URL || DEFAULT_BASE_URL;

  if (!apiKey) {
    process.stderr.write(
      'CLIPSPEED_API_KEY is not set. Set your personal ClipSpeed API key before starting the MCP server:\n' +
        '  export CLIPSPEED_API_KEY=csai_live_...\n' +
        'Get a key at https://www.clipspeed.ai/dashboard/api-key/ (or run: clipspeed-mcp install)\n'
    );
    process.exit(1);
    return;
  }

  const { startServer } = require('../src/server');
  await startServer({ baseUrl, apiKey });
}

main().catch((e) => {
  // Never include the key in error output.
  process.stderr.write(`[clipspeed-mcp] failed to start: ${e && e.message}\n`);
  process.exit(1);
});
