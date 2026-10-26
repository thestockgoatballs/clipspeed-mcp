# Installing the ClipSpeed MCP server (for AI agents such as Cline)

ClipSpeed turns a video URL or a live Twitch, Kick or YouTube stream into scored, captioned, vertical clips.
There are two ways to connect. Prefer the hosted server.

## Option 1 — Hosted server (recommended, no install, no API key)

Add this to Cline's MCP settings (`cline_mcp_settings.json`):

```json
{
  "mcpServers": {
    "clipspeed": {
      "type": "streamableHttp",
      "url": "https://api.clipspeed.ai/mcp"
    }
  }
}
```

- Transport: Streamable HTTP. Auth: OAuth — on the first tool call the user's browser opens once to sign in and approve.
- No environment variables are needed.
- A ClipSpeed plan or the $1 3-day trial is required; the sign-in page offers the trial if the account has neither.
- Only the hosted server has the live-stream tools (`clip_livestream`, `check_livestream`, `extend_livestream`, `stop_livestream`).

## Option 2 — Local npm package (stdio, API key)

Use this if the client cannot do OAuth, or to save finished .mp4 files to the local disk.

1. The user generates an API key in the ClipSpeed app: Account → API & Integrations → Generate API Key. Keys start with `csai_live_`.
2. Add to Cline's MCP settings:

```json
{
  "mcpServers": {
    "clipspeed": {
      "command": "npx",
      "args": ["-y", "clipspeed-mcp@1.0.1"],
      "env": { "CLIPSPEED_API_KEY": "csai_live_your_key" }
    }
  }
}
```

Requires Node.js 18+. No build step.

## Verify

Ask: "Use ClipSpeed to clip https://www.youtube.com/watch?v=<id> into vertical shorts." The agent calls
`submit_to_clipspeed`, then polls `check_clips` until the clips are ready.

Docs: https://www.clipspeed.ai/mcp/
