# clipspeed-mcp

[![Listed on mcpservers.org](https://mcpservers.org/badge.svg)](https://mcpservers.org/servers/thestockgoatballs/clipspeed-mcp)

Create and clip video from **Claude**, **ChatGPT**, **Cursor**, **Cline** or **Windsurf**: generate AI videos (Seedance 2.5, Kling 3.0, Veo 3.1, MiniMax H3) and images (Nano Banana Pro, GPT Image 2), build consistent AI influencer characters, swap a character into a clip with its original motion and sound (Morphaze), and turn any video **or live stream** into scored, captioned, ready-to-post vertical clips.

[ClipSpeedAI](https://www.clipspeed.ai) ships **two MCP transports**, and they expose **different tools**:

| | Hosted (remote) | This npm package (local) |
|---|---|---|
| Transport | `streamable-http` at `https://api.clipspeed.ai/mcp` | stdio |
| Auth | **OAuth — one click, no API key** | `CLIPSPEED_API_KEY` |
| Install | none | `npx clipspeed-mcp` |
| **AI video, images, AI influencers, Morphaze swaps, ad concepts** | **yes** — `generate_video`, `generate_image`, `create_influencer`, `morphaze_swap`, `marketing_concept_video`, `estimate_cost` (credits shown before every paid run) | **no** |
| **Clip a LIVE stream while it airs** | **yes** — `clip_livestream`, `check_livestream`, `extend_livestream`, `stop_livestream` | **no** |
| Save .mp4s to your disk | no | **yes** — `download_clip` |
| Schedule posts | via `publish_to_youtube` | `schedule_post` (5 platforms) |

**Most people want the hosted server** — it needs no install, no API key, and it is the only one
that can generate AI video and images or clip a stream that is still running. Use this npm package when you specifically need
finished files written to your local disk.

Requires a ClipSpeedAI **paid plan or the $1 trial**. For the npm package, get your key at
**https://www.clipspeed.ai/dashboard/api-key/** — keys look like `csai_live_...`.

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

### Hosted (no install, no API key) — recommended

The hosted server authenticates with **OAuth**, so there is no key to copy and nothing to install:

```bash
claude mcp add --transport http clipspeed https://api.clipspeed.ai/mcp
```

Your client opens a browser once, you approve, and it is connected. In **claude.ai** or
**ChatGPT**, add it as a custom connector with the same URL.

**Hosted tools** (10):

| Tool | Does |
|---|---|
| `submit_to_clipspeed` | Video URL → a clip job. |
| `check_clips` | Poll a job → finished clips with viral scores. |
| **`clip_livestream`** | **Attach to a stream that is STILL LIVE and cut clips while it airs.** |
| **`check_livestream`** | Clips produced so far from a live session. |
| **`extend_livestream`** | Keep clipping past the original window. |
| **`stop_livestream`** | End the live session. |
| `discover_trending` | Fastest-growing recent video in a niche. |
| `list_templates` | Available caption/layout templates. |
| `creator_pack` | Titles, hooks and hashtags for a finished clip. |
| `publish_to_youtube` | Publish a finished clip to YouTube. |

The four livestream tools exist **only** on the hosted server. If you want to clip a Twitch,
Kick or YouTube stream while it is running, use the hosted transport — the npm package cannot
do it. Conversely, only the npm package can write .mp4 files to your local disk.

---

## Environment

| Var | Required | Default | Notes |
|---|---|---|---|
| `CLIPSPEED_API_KEY` | yes (to serve) | — | Your personal `csai_live_` key. |
| `CLIPSPEED_BASE_URL` | no | `https://api.clipspeed.ai` | Override for testing. |

Node **>= 18** (uses global `fetch`).

---

## Tools (npm package / local stdio)

These are the tools **this package** exposes. For the hosted server's tool set — including the
four livestream tools — see [Hosted](#hosted-no-install-no-api-key--recommended) above.

| Tool | Does |
|---|---|
| `clip_video` | Video URL → a clip job (`job_id`). Options: `aspect_ratio`, `caption_style`, `clip_count`, `platform`. |
| `get_clip_status` | Poll a `job_id` → status + finished clips (title, viral_score, duration, video_url). |
| `list_clips` | List your recent clip jobs to find a past `job_id`. |
| `download_clip` | **Save the .mp4 files to `~/Downloads`** — all clips, or one by `clip_index`. Skips files > 500MB. |
| `get_usage` | Credits remaining / total / used this month, plan, trial status. |
| `discover_trending` | Find the fastest-growing recent video in a niche to clip. ClipSpeedAI's differentiator. |
| `schedule_post` | Schedule a finished clip to tiktok / youtube / instagram / x / linkedin. |
| `list_scheduled_posts` | Review scheduled / posted / failed posts. |
| `cancel_scheduled_post` | Cancel a post that's still `scheduled`. |
| `restyle_captions` | Re-caption a project in a new style without re-clipping. |

**Caption styles:** `karaoke` (default), `hormozi`, `beasty`, `fire`, `youshaei`, `cinematic`, `bold`.
**Aspect ratios:** `9:16` (default), `1:1`, `16:9`.

To let ClipSpeedAI **publish to your socials**, connect each platform in the ClipSpeedAI app first (Scheduler). `schedule_post` posts under those connections.

---

## The demo prompt

> Clip this video into 9:16 shorts with Hormozi captions, then download the top 3 to my Downloads folder: https://youtu.be/…

Claude runs `clip_video` → polls `get_clip_status` → `download_clip` → the .mp4s land in `~/Downloads`.

A Claude **Skill** (`SKILL.md`) ships with this package — it teaches the outcome-first flow (find → clip → check → download → schedule).

---

## Security

- Your API key is **never logged**. It only ever lands in your MCP client's config file (or your shell env).
- **Never commit your key** or share it. Rotate it any time at https://www.clipspeed.ai/dashboard/api-key/.
- Keys are tied to one account, rate-limited per plan, and hashed at rest on ClipSpeedAI's servers.

## License

MIT
