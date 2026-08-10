// mcp/clipspeed-mcp/test/smoke.js
//
// OFFLINE smoke test. Stubs global fetch, then asserts every tool builds the
// correct request (method / path / headers / body) and parses the response,
// plus the 10 tool names + their required inputs. Own pass/fail counter and
// exit code — no test framework, no network.

'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');
const { buildTools, sanitizeFilename } = require('../src/tools');

let passed = 0;
let failed = 0;
const failures = [];

function ok(name, cond, detail) {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(`${name}${detail ? ' — ' + detail : ''}`);
    console.error(`  ✗ ${name}${detail ? ' — ' + detail : ''}`);
  }
}
function eq(name, actual, expected) {
  ok(name, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

const BASE = 'https://api.clipspeed.ai';
const KEY = 'csai_live_deadbeefdeadbeefdeadbeefdeadbeef11112222';

// ── Fake fetch: records every call, returns a scripted response. ──────────
function makeFetch(responder) {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, opts, method: opts.method });
    const r = responder(url, opts) || {};
    const status = r.status || 200;
    const bodyText = r.text !== undefined ? r.text : JSON.stringify(r.json !== undefined ? r.json : {});
    const headers = new Map(Object.entries(r.headers || {}).map(([k, v]) => [k.toLowerCase(), String(v)]));
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (k) => (headers.has(String(k).toLowerCase()) ? headers.get(String(k).toLowerCase()) : null) },
      text: async () => bodyText,
      arrayBuffer: async () => (r.buffer ? r.buffer : Buffer.from(bodyText)).buffer.slice(
        (r.buffer ? r.buffer : Buffer.from(bodyText)).byteOffset,
        (r.buffer ? r.buffer : Buffer.from(bodyText)).byteOffset + (r.buffer ? r.buffer : Buffer.from(bodyText)).byteLength
      ),
    };
  };
  return { fetchImpl, calls };
}

function toolsWith(responder, extra = {}) {
  const { fetchImpl, calls } = makeFetch(responder);
  const tools = buildTools({ baseUrl: BASE, apiKey: KEY, fetchImpl, ...extra });
  const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
  return { tools, byName, calls };
}

function lastApiCall(calls) {
  // the tool's primary /api/v1 call (ignore HEAD/GET file downloads)
  return calls.find((c) => String(c.url).includes('/api/v1/'));
}

(async () => {
  console.error('clipspeed-mcp smoke test\n');

  // ── 1. Tool inventory: exactly the 10 named tools + required inputs ──────
  {
    const { tools, byName } = toolsWith(() => ({ json: {} }));
    const expectedNames = [
      'clip_video', 'get_clip_status', 'list_clips', 'download_clip', 'get_usage',
      'discover_trending', 'schedule_post', 'list_scheduled_posts', 'cancel_scheduled_post', 'restyle_captions',
    ];
    eq('tool count is 10', tools.length, 10);
    for (const n of expectedNames) ok(`tool present: ${n}`, !!byName[n]);

    const requiredMap = {
      clip_video: ['video_url'],
      get_clip_status: ['job_id'],
      download_clip: ['job_id'],
      schedule_post: ['clip_id', 'platforms'],
      cancel_scheduled_post: ['post_id'],
      restyle_captions: ['project_id', 'style'],
      get_usage: [],
      list_clips: [],
      list_scheduled_posts: [],
      discover_trending: [],
    };
    for (const [n, req] of Object.entries(requiredMap)) {
      const got = byName[n].inputSchema.required || [];
      ok(`${n} required = [${req.join(',')}]`, JSON.stringify(got) === JSON.stringify(req), `got [${got.join(',')}]`);
      ok(`${n} inputSchema is object`, byName[n].inputSchema.type === 'object');
      ok(`${n} has non-empty description`, typeof byName[n].description === 'string' && byName[n].description.length > 20);
    }
  }

  // ── 2. Headers: X-API-Key present, key never elsewhere ──────────────────
  {
    const { byName, calls } = toolsWith(() => ({ json: {} }));
    await byName.get_usage.handler({});
    const c = lastApiCall(calls);
    eq('get_usage method GET', c.method, 'GET');
    eq('X-API-Key header set', c.opts.headers['X-API-Key'], KEY);
    eq('Content-Type json', c.opts.headers['Content-Type'], 'application/json');
    ok('GET usage has no body', c.opts.body === undefined);
  }

  // ── 3. clip_video → POST /clips/generate with mapped body + parsed resp ──
  {
    const { byName, calls } = toolsWith(() => ({ status: 202, json: { id: 'proj_1', status: 'queued', platform: 'youtube', status_url: '/api/v1/clips/proj_1', message: 'go' } }));
    const res = await byName.clip_video.handler({ video_url: 'https://youtu.be/x', caption_style: 'hormozi', clip_count: 5, aspect_ratio: '1:1', platform: 'youtube' });
    const c = lastApiCall(calls);
    eq('clip_video method POST', c.method, 'POST');
    eq('clip_video path', new URL(c.url).pathname, '/api/v1/clips/generate');
    const body = JSON.parse(c.opts.body);
    eq('clip_video body.url', body.url, 'https://youtu.be/x');
    eq('clip_video body.caption_style', body.caption_style, 'hormozi');
    eq('clip_video body.clip_count', body.clip_count, 5);
    eq('clip_video body.aspect_ratio', body.aspect_ratio, '1:1');
    eq('clip_video body.platform', body.platform, 'youtube');
    eq('clip_video parsed job_id', res.job_id, 'proj_1');
    eq('clip_video parsed status', res.status, 'queued');
    // status_url is absolutized against the base URL so it's directly fetchable
    eq('clip_video parsed status_url', res.status_url, 'https://api.clipspeed.ai/api/v1/clips/proj_1');
  }

  // ── 3b. clip_video defaults (karaoke / 9:16 / auto / 10) ────────────────
  {
    const { byName, calls } = toolsWith(() => ({ status: 202, json: { id: 'p', status: 'queued' } }));
    await byName.clip_video.handler({ video_url: 'https://x/y' });
    const body = JSON.parse(lastApiCall(calls).opts.body);
    eq('clip_video default caption_style', body.caption_style, 'karaoke');
    eq('clip_video default aspect_ratio', body.aspect_ratio, '9:16');
    eq('clip_video default platform', body.platform, 'auto');
    eq('clip_video default clip_count', body.clip_count, 10);
  }

  // ── 4. get_clip_status → GET /clips/:id, maps clips[] ───────────────────
  {
    const { byName, calls } = toolsWith(() => ({ json: { id: 'proj_1', status: 'completed', url: 'https://src', platform: 'youtube', clips_found: 1, clips: [{ id: 'c1', title: 'T', viral_score: 88, duration: 30, video_url: 'https://r2/c1.mp4', hook: 'h', hashtags: ['#a'] }] } }));
    const res = await byName.get_clip_status.handler({ job_id: 'proj_1' });
    const c = lastApiCall(calls);
    eq('get_clip_status method GET', c.method, 'GET');
    eq('get_clip_status path', new URL(c.url).pathname, '/api/v1/clips/proj_1');
    eq('get_clip_status job_id', res.job_id, 'proj_1');
    eq('get_clip_status clips length', res.clips.length, 1);
    eq('get_clip_status clip clip_id', res.clips[0].clip_id, 'c1');
    eq('get_clip_status clip viral_score', res.clips[0].viral_score, 88);
    eq('get_clip_status clip video_url', res.clips[0].video_url, 'https://r2/c1.mp4');
  }

  // ── 4b. job_id is URL-encoded in the path ───────────────────────────────
  {
    const { byName, calls } = toolsWith(() => ({ json: { id: 'a/b', status: 'queued' } }));
    await byName.get_clip_status.handler({ job_id: 'a/b c' });
    eq('get_clip_status encodes job_id', new URL(lastApiCall(calls).url).pathname, '/api/v1/clips/a%2Fb%20c');
  }

  // ── 5. list_clips → GET /clips with query ───────────────────────────────
  {
    const { byName, calls } = toolsWith(() => ({ json: { projects: [], total: 0 } }));
    await byName.list_clips.handler({ limit: 50, status: 'completed' });
    const u = new URL(lastApiCall(calls).url);
    eq('list_clips path', u.pathname, '/api/v1/clips');
    eq('list_clips query limit', u.searchParams.get('limit'), '50');
    eq('list_clips query status', u.searchParams.get('status'), 'completed');
  }
  {
    // omitted query params are not appended
    const { byName, calls } = toolsWith(() => ({ json: {} }));
    await byName.list_clips.handler({});
    const u = new URL(lastApiCall(calls).url);
    ok('list_clips omits empty limit', u.searchParams.get('limit') === null);
    ok('list_clips omits empty status', u.searchParams.get('status') === null);
  }

  // ── 6. get_usage → GET /usage passthrough ───────────────────────────────
  {
    const { byName, calls } = toolsWith(() => ({ json: { credits_remaining: 42, credits_total: 100, credits_used_this_month: 58, plan: 'pro', is_trialing: false } }));
    const res = await byName.get_usage.handler({});
    eq('get_usage path', new URL(lastApiCall(calls).url).pathname, '/api/v1/usage');
    eq('get_usage credits_remaining', res.credits_remaining, 42);
    eq('get_usage plan', res.plan, 'pro');
  }

  // ── 7. discover_trending → POST /discover, days default 7 ───────────────
  {
    const { byName, calls } = toolsWith(() => ({ json: { ok: true, scanned: 5, pick: { videoUrl: 'u' }, candidates: [] } }));
    const res = await byName.discover_trending.handler({ niche: 'AI tools' });
    const c = lastApiCall(calls);
    eq('discover method POST', c.method, 'POST');
    eq('discover path', new URL(c.url).pathname, '/api/v1/discover');
    const body = JSON.parse(c.opts.body);
    eq('discover body niche', body.niche, 'AI tools');
    eq('discover body days default', body.days, 7);
    eq('discover parsed ok', res.ok, true);
  }
  {
    // ok:false degrade passes through (no throw)
    const { byName } = toolsWith(() => ({ status: 200, json: { ok: false, reason: 'no_fresh_candidates' } }));
    const res = await byName.discover_trending.handler({ niche: 'x' });
    eq('discover degrade reason', res.reason, 'no_fresh_candidates');
  }

  // ── 8. schedule_post → POST /schedule, caption→description ──────────────
  {
    const { byName, calls } = toolsWith(() => ({ json: { success: true, scheduled: [] } }));
    await byName.schedule_post.handler({ clip_id: 'c1', platforms: ['tiktok', 'youtube'], caption: 'hi', title: 'T', scheduled_at: '2026-08-01T00:00:00Z' });
    const c = lastApiCall(calls);
    eq('schedule method POST', c.method, 'POST');
    eq('schedule path', new URL(c.url).pathname, '/api/v1/schedule');
    const body = JSON.parse(c.opts.body);
    eq('schedule body clip_id', body.clip_id, 'c1');
    ok('schedule body platforms', JSON.stringify(body.platforms) === JSON.stringify(['tiktok', 'youtube']));
    eq('schedule caption→description', body.description, 'hi');
    eq('schedule title', body.title, 'T');
    eq('schedule scheduled_at', body.scheduled_at, '2026-08-01T00:00:00Z');
  }

  // ── 9. list_scheduled_posts → GET /schedule with filters ────────────────
  {
    const { byName, calls } = toolsWith(() => ({ json: { posts: [], total: 0 } }));
    await byName.list_scheduled_posts.handler({ status: 'scheduled', platform: 'tiktok', limit: 5 });
    const u = new URL(lastApiCall(calls).url);
    eq('list_scheduled path', u.pathname, '/api/v1/schedule');
    eq('list_scheduled status', u.searchParams.get('status'), 'scheduled');
    eq('list_scheduled platform', u.searchParams.get('platform'), 'tiktok');
    eq('list_scheduled limit', u.searchParams.get('limit'), '5');
  }

  // ── 10. cancel_scheduled_post → DELETE /schedule/:id ────────────────────
  {
    const { byName, calls } = toolsWith(() => ({ json: { success: true, id: 'p1', status: 'cancelled' } }));
    const res = await byName.cancel_scheduled_post.handler({ post_id: 'p1' });
    const c = lastApiCall(calls);
    eq('cancel method DELETE', c.method, 'DELETE');
    eq('cancel path', new URL(c.url).pathname, '/api/v1/schedule/p1');
    eq('cancel parsed status', res.status, 'cancelled');
  }
  {
    // 409 cannot_cancel surfaces as a thrown error carrying the error shape
    const { byName } = toolsWith(() => ({ status: 409, json: { error: { type: 'cannot_cancel', message: 'Post already processing or sent.' } } }));
    let threw = null;
    try { await byName.cancel_scheduled_post.handler({ post_id: 'p1' }); } catch (e) { threw = e; }
    ok('cancel 409 throws', !!threw);
    const parsed = threw && JSON.parse(threw.message);
    eq('cancel 409 error type', parsed && parsed.error.type, 'cannot_cancel');
  }

  // ── 11. restyle_captions → POST /captions/restyle ───────────────────────
  {
    const { byName, calls } = toolsWith(() => ({ json: { success: true, style: 'hormozi' } }));
    await byName.restyle_captions.handler({ project_id: 'proj_1', style: 'hormozi' });
    const c = lastApiCall(calls);
    eq('restyle method POST', c.method, 'POST');
    eq('restyle path', new URL(c.url).pathname, '/api/v1/captions/restyle');
    const body = JSON.parse(c.opts.body);
    eq('restyle body project_id', body.project_id, 'proj_1');
    eq('restyle body style', body.style, 'hormozi');
  }

  // ── 12. Error shape + upgrade_url surfaced from a 402/403 ────────────────
  {
    const { byName } = toolsWith(() => ({ status: 402, json: { error: { type: 'insufficient_credits', message: 'out of credits' }, upgrade_url: 'https://www.clipspeed.ai/#pricingSection', credits_remaining: 0, credits_needed: 30 } }));
    let threw = null;
    try { await byName.clip_video.handler({ video_url: 'https://x/y' }); } catch (e) { threw = e; }
    ok('clip_video 402 throws', !!threw);
    const parsed = threw && JSON.parse(threw.message);
    eq('402 error type', parsed && parsed.error.type, 'insufficient_credits');
    eq('402 upgrade_url surfaced', parsed && parsed.upgrade_url, 'https://www.clipspeed.ai/#pricingSection');
    eq('402 credits_needed surfaced', parsed && parsed.credits_needed, 30);
  }

  // ── 13. download_clip → manifest, saves files to a temp Downloads dir ────
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'csai-dl-'));
    const mp4 = Buffer.from('FAKEMP4DATA');
    const responder = (url, opts) => {
      if (String(url).includes('/download/all')) {
        return { json: { project_id: 'proj_1', count: 2, clips: [
          { index: 1, clip_id: 'c1', title: 'First Clip!', viral_score: 90, duration_seconds: 30, url: 'https://r2/c1.mp4', filename: 'first-clip.mp4' },
          { index: 2, clip_id: 'c2', title: 'Second', viral_score: 80, duration_seconds: 20, url: 'https://r2/c2.mp4', filename: 'second.mp4' },
        ] } };
      }
      if (opts && opts.method === 'HEAD') return { status: 200, headers: { 'content-length': String(mp4.length) } };
      return { status: 200, buffer: mp4, headers: { 'content-length': String(mp4.length) } };
    };
    const { byName } = toolsWith(responder, { downloadsDir: tmpDir });

    // all clips
    const resAll = await byName.download_clip.handler({ job_id: 'proj_1' });
    eq('download all count', resAll.count, 2);
    eq('download dir echoed', resAll.downloads_dir, tmpDir);
    ok('download saved file 1 on disk', fs.existsSync(resAll.saved[0].path));
    ok('download saved file 2 on disk', fs.existsSync(resAll.saved[1].path));
    eq('download saved bytes', resAll.saved[0].bytes, mp4.length);

    // single clip by index
    const resOne = await byName.download_clip.handler({ job_id: 'proj_1', clip_index: 2 });
    eq('download single count', resOne.count, 1);
    eq('download single title', resOne.saved[0].title, 'Second');

    // bad index throws not_found
    let threw = null;
    try { await byName.download_clip.handler({ job_id: 'proj_1', clip_index: 99 }); } catch (e) { threw = e; }
    const parsed = threw && JSON.parse(threw.message);
    eq('download bad index → not_found', parsed && parsed.error.type, 'not_found');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  // ── 13b. download_clip 500MB guard skips (does not write) ────────────────
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'csai-big-'));
    const big = 600 * 1024 * 1024;
    const responder = (url, opts) => {
      if (String(url).includes('/download/all')) {
        return { json: { clips: [{ index: 1, title: 'Huge', url: 'https://r2/huge.mp4', filename: 'huge.mp4' }] } };
      }
      if (opts && opts.method === 'HEAD') return { status: 200, headers: { 'content-length': String(big) } };
      return { status: 200, buffer: Buffer.from('x'), headers: { 'content-length': String(big) } };
    };
    const { byName } = toolsWith(responder, { downloadsDir: tmpDir });
    const res = await byName.download_clip.handler({ job_id: 'proj_1' });
    eq('oversize count is 0', res.count, 0);
    ok('oversize skipped with reason', typeof res.saved[0].skipped === 'string' && /500MB/.test(res.saved[0].skipped));
    ok('oversize wrote nothing', fs.readdirSync(tmpDir).length === 0);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  // ── 13c. download_clip skips null-url clips ─────────────────────────────
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'csai-null-'));
    const responder = (url) => {
      if (String(url).includes('/download/all')) return { json: { clips: [{ index: 1, title: 'NoUrl', url: null }] } };
      return { status: 200, buffer: Buffer.from('x') };
    };
    const { byName } = toolsWith(responder, { downloadsDir: tmpDir });
    const res = await byName.download_clip.handler({ job_id: 'proj_1' });
    eq('null-url count is 0', res.count, 0);
    ok('null-url skipped', typeof res.saved[0].skipped === 'string');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  // ── 14. sanitizeFilename ────────────────────────────────────────────────
  {
    eq('sanitize adds .mp4', sanitizeFilename('My Clip'), 'my clip.mp4');
    eq('sanitize strips path sep', sanitizeFilename('a/b\\c'), 'abc.mp4');
    ok('sanitize strips reserved chars', !/[<>:"|?*]/.test(sanitizeFilename('a<b>c:"|?*')));
    eq('sanitize empty → fallback', sanitizeFilename('', 'fallback'), 'fallback.mp4');
    ok('sanitize keeps existing .mp4', sanitizeFilename('clip.mp4') === 'clip.mp4');
  }

  // ── done ────────────────────────────────────────────────────────────────
  console.error(`\n${passed} passed, ${failed} failed`);
  if (failed) {
    console.error('\nFAILURES:');
    for (const f of failures) console.error('  - ' + f);
  }
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error('smoke test crashed:', e && e.stack || e);
  process.exit(1);
});
