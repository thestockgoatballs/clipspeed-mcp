// mcp/clipspeed-mcp/src/server.js
//
// The stdio MCP server. Wires the pure tool definitions from tools.js to the
// MCP SDK transport. Tool results are wrapped as MCP text content; thrown
// errors (including the standardized ClipSpeed error shape) are surfaced as
// isError text so the agent can read and relay them.

'use strict';

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { buildTools } = require('./tools');

async function startServer({ baseUrl, apiKey } = {}) {
  const tools = buildTools({ baseUrl, apiKey });
  const byName = Object.fromEntries(tools.map((t) => [t.name, t]));

  const server = new Server(
    { name: 'clipspeed', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = byName[req.params.name];
    if (!tool) {
      return { content: [{ type: 'text', text: `Unknown tool: ${req.params.name}` }], isError: true };
    }
    try {
      const result = await tool.handler(req.params.arguments || {});
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      // e.message may be a JSON string carrying { error:{type,message}, upgrade_url }.
      // Present it as-is if so, otherwise wrap a plain message. Either way the
      // agent gets an actionable payload it can relay to the user.
      let text;
      try {
        const parsed = JSON.parse(e.message);
        text = JSON.stringify(parsed, null, 2);
      } catch (_) {
        text = JSON.stringify({ error: { type: 'client_error', message: e.message } }, null, 2);
      }
      return { content: [{ type: 'text', text }], isError: true };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr only — never stdout (that's the JSON-RPC channel), never the key.
  console.error('clipspeed MCP server running (stdio)');
  return server;
}

module.exports = { startServer };
