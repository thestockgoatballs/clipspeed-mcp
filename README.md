# clipspeed-mcp

Turn any video into scored, captioned, ready-to-post vertical clips — right inside **Claude**, **Cursor**, **Cline**, or **Windsurf**. `clipspeed-mcp` is a stdio [MCP](https://modelcontextprotocol.io) server that wraps the [ClipSpeed](https://www.clipspeed.ai) public API with your **personal API key**, and (unlike a hosted MCP) can **download the finished .mp4 clips straight to your `~/Downloads` folder**.

Requires a ClipSpeed **paid plan or the $1 trial**. Get your key at **https://www.clipspeed.ai/dashboard/api-key/** — keys look like `csai_live_...`.

> **Always pin `clipspeed-mcp@1.0.1`.** Pinning keeps a bad publish from silently upgrading your setup.

---

## Install

### Claude Desktop (one command)

```bash
npx clipspeed-mcp@1.0.1 install
```

It prompts for your API key and writes the `clipspeed` server into your Claude Desktop config for you. You can also pass the key directly:

```bash
npx clipspeed-mcp@1.0.1 install --key csai_live_your_key
```

Then **quit and reopen Claude Desktop.**

### Claude Code

```bash
claude mcp add clipspeed -- npx -y clipspeed-mcp@1.0.1
export CLIPSPEED_API_KEY=csai_live_your_key
```

### Cursor / Cline / Windsurf

Add this to your MCP servers config (`~/.cursor/mcp.json`, Cline's MCP settings, or Windsurf's `mcp_config.json`):

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

### Hosted (no install)

Prefer a remote server with no local process? ClipSpeed also exposes a hosted MCP:

```bash
claude mcp add --transport http clipspeed https://api.clipspeed.ai/mcp \
  --header "Authorization: Bearer csai_live_your_key"
```

The hosted server can do everything **except** write files to your disk — use this local package if you want `download_clip`.

---

## Environment

| Var | Required | Default | Notes |
|---|---|---|---|
| `CLIPSPEED_API_KEY` | yes (to serve) | — | Your personal `csai_live_` key. |
| `CLIPSPEED_BASE_URL` | no | `https://api.clipspeed.ai` | Override for testing. |

Node **>= 18** (uses global `fetch`).

---

## Tools

| Tool | Does |
|---|---|
| `clip_video` | Video URL → a clip job (`job_id`). Options: `aspect_ratio`, `caption_style`, `clip_count`, `platform`. |
| `get_clip_status` | Poll a `job_id` → status + finished clips (title, viral_score, duration, video_url). |
| `list_clips` | List your recent clip jobs to find a past `job_id`. |
| `download_clip` | **Save the .mp4 files to `~/Downloads`** — all clips, or one by `clip_index`. Skips files > 500MB. |
| `get_usage` | Credits remaining / total / used this month, plan, trial status. |
| `discover_trending` | Find the fastest-growing recent video in a niche to clip. ClipSpeed's differentiator. |
| `schedule_post` | Schedule a finished clip to tiktok / youtube / instagram / x / linkedin. |
| `list_scheduled_posts` | Review scheduled / posted / failed posts. |
| `cancel_scheduled_post` | Cancel a post that's still `scheduled`. |
| `restyle_captions` | Re-caption a project in a new style without re-clipping. |

**Caption styles:** `karaoke` (default), `hormozi`, `beasty`, `fire`, `youshaei`, `cinematic`, `bold`.
**Aspect ratios:** `9:16` (default), `1:1`, `16:9`.

To let ClipSpeed **publish to your socials**, connect each platform in the ClipSpeed app first (Scheduler). `schedule_post` posts under those connections.

---

## The demo prompt

> Clip this video into 9:16 shorts with Hormozi captions, then download the top 3 to my Downloads folder: https://youtu.be/…

Claude runs `clip_video` → polls `get_clip_status` → `download_clip` → the .mp4s land in `~/Downloads`.

A Claude **Skill** (`SKILL.md`) ships with this package — it teaches the outcome-first flow (find → clip → check → download → schedule).

---

## Security

- Your API key is **never logged**. It only ever lands in your MCP client's config file (or your shell env).
- **Never commit your key** or share it. Rotate it any time at https://www.clipspeed.ai/dashboard/api-key/.
- Keys are tied to one account, rate-limited per plan, and hashed at rest on ClipSpeed's servers.

## License

MIT
