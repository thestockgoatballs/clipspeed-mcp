---
name: clipspeed
description: Use when the user wants to turn a video into ready-to-post vertical clips, download those clips to disk, find a trending video to clip, or schedule clips to their socials via ClipSpeed — e.g. "clip this YouTube video", "make me shorts from this stream", "download the top 3 clips", "what should I clip today", or "schedule that clip to TikTok". Requires the ClipSpeed MCP tools (clipspeed-mcp) to be connected.
---

# ClipSpeed

Drive ClipSpeed end-to-end from one prompt: (optionally) find a trending video, turn it into scored, captioned vertical clips, save the .mp4s to disk, and schedule them to socials. Assumes the ClipSpeed MCP is connected (tools: `clip_video`, `get_clip_status`, `list_clips`, `download_clip`, `get_usage`, `discover_trending`, `schedule_post`, `list_scheduled_posts`, `cancel_scheduled_post`, `restyle_captions`).

> Install: copy this file to `.claude/skills/clipspeed/SKILL.md` (Claude Code) or your client's skills dir. It ships with the `clipspeed-mcp` package.

## Core principle

The user speaks in **outcomes** ("clip this", "give me shorts", "download the good ones"), not mechanics. Do the plumbing silently and narrate the interesting parts: which clips are strongest and where the files landed.

## The standard flow

1. **(Optional) Discover** — if the user wants ideas ("what should I clip today", "grow my page"), call `discover_trending` with their niche. Lead with the **pick + one-line reason** ("1.8M views in 36h, 3.2× this channel's norm"), then offer to clip it. Don't make the search the story.
2. **Clip** — call `clip_video` with the video URL. Pass `caption_style` if they asked for a look and `aspect_ratio` if not 9:16. You get back a `job_id`. Jobs take **~10–30 minutes**.
3. **Check** — poll `get_clip_status` with the `job_id` every ~30–60s. Report progress conversationally. When `status` is `completed`, you have `clips[]` with `viral_score`, `title`, `duration`, and `video_url`. **Present the top clips by `viral_score`**, not all of them.
4. **Download (the local win)** — when the user wants the files, call `download_clip` with the `job_id` (and `clip_index` for a single clip). The .mp4s land in `~/Downloads`. Tell them the paths. This is something a hosted MCP can't do.
5. **Schedule (optional)** — if they say "post it" / "schedule for tomorrow", call `schedule_post` with the `clip_id` (from `get_clip_status`) and a `platforms` array. The platform must be connected in the ClipSpeed app first.

## Quick reference

| Tool | When | Key args |
|---|---|---|
| `discover_trending` | "what should I clip / grow my page" | `niche`, `days` |
| `clip_video` | a video URL to turn into clips | `video_url`, `caption_style`, `aspect_ratio`, `clip_count` |
| `get_clip_status` | poll until `status: completed` | `job_id` |
| `download_clip` | "download them / save the top 3" | `job_id`, `clip_index` |
| `get_usage` | "how many credits do I have" | — |
| `schedule_post` | "post it / schedule it" | `clip_id`, `platforms[]`, `caption`, `scheduled_at` |
| `list_scheduled_posts` | "what's queued" | `status`, `platform` |
| `cancel_scheduled_post` | "cancel that post" | `post_id` |
| `restyle_captions` | "make the captions hormozi" | `project_id`, `style` |

## Caption styles

Set at `clip_video` time via `caption_style`, or change later with `restyle_captions`:
- **karaoke** — green highlight, bold (default, highest-converting)
- **hormozi** — yellow pill, black text (bold branded)
- **beasty** — pink, largest font (MrBeast energy)
- **fire** — orange highlight
- **youshaei** — clean blue highlight
- **cinematic** — gold italic, refined
- **bold** — plain bold

Aspect ratios: `9:16` (default, vertical), `1:1`, `16:9`.

## Handling the money/limit errors

Tool results may come back as an error payload with `{ error: { type, message } }` and sometimes `upgrade_url`. **Relay it plainly and helpfully:**
- `insufficient_credits` → tell them how many credits they need and point to the `upgrade_url`. Offer `get_usage` to confirm the balance. (1 credit = 1 minute of source video.)
- `subscription_required` → API access needs a paid plan or the $1 trial; share the `upgrade_url`.
- `rate_limit_error` → they hit today's request cap; suggest trying again later.
- `cannot_cancel` → the post is already processing/sent, so it can't be cancelled.

## Common mistakes

- **Don't poll too fast or forever.** Every 30–60s; clip jobs are 10–30 min. Tell the user it's cooking rather than spamming status.
- **Don't dump every clip.** Show the top 3–5 by `viral_score`.
- **Publishing needs connected accounts.** If `schedule_post` fails because a platform isn't connected, tell the user to connect it in the ClipSpeed app (Scheduler) first.
- **`download_clip` writes to `~/Downloads`.** Files over 500MB are skipped for safety — say so if a clip is skipped.
- **Private by default.** Don't schedule/publish anything the user didn't ask you to.
