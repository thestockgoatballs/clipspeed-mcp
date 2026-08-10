// mcp/clipspeed-mcp/src/install.js
//
// `clipspeed-mcp install` — auto-edits the Claude Desktop config so the user
// doesn't have to hand-write JSON. Locates the per-OS config, reads-or-creates
// it, adds mcpServers.clipspeed with the user's key in env, and writes it back
// pretty-printed. The key is prompted on stdin when not passed via --key.
//
// The API key is NEVER logged. It only ever lands in the config file.

'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Per-OS Claude Desktop config location.
function configPath() {
  const home = os.homedir();
  switch (process.platform) {
    case 'darwin':
      return path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    case 'win32': {
      const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
      return path.join(appData, 'Claude', 'claude_desktop_config.json');
    }
    default: // linux + others
      return path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'Claude', 'claude_desktop_config.json');
  }
}

function looksLikeKey(key) {
  return typeof key === 'string' && /^csai_live_[a-f0-9]{16,}$/i.test(key.trim());
}

function parseKeyArg(argv) {
  // supports: --key VALUE  and  --key=VALUE
  const i = argv.indexOf('--key');
  if (i !== -1 && argv[i + 1]) return argv[i + 1].trim();
  const eq = argv.find((a) => a.startsWith('--key='));
  if (eq) return eq.slice('--key='.length).trim();
  return null;
}

function promptForKey() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    rl.question('Paste your ClipSpeed API key (csai_live_...): ', (answer) => {
      rl.close();
      resolve((answer || '').trim());
    });
  });
}

// Build the mcpServers.clipspeed block. Pinned to @1.0.0 so a bad publish
// can't silently upgrade the user.
function serverBlock(key) {
  return {
    command: 'npx',
    args: ['-y', 'clipspeed-mcp@1.0.0'],
    env: { CLIPSPEED_API_KEY: key },
  };
}

// Merge the clipspeed block into an existing config object (mutates + returns).
function mergeConfig(existing, key) {
  const cfg = existing && typeof existing === 'object' ? existing : {};
  if (!cfg.mcpServers || typeof cfg.mcpServers !== 'object') cfg.mcpServers = {};
  cfg.mcpServers.clipspeed = serverBlock(key);
  return cfg;
}

async function install(argv = process.argv.slice(3)) {
  const target = configPath();

  let key = parseKeyArg(argv);
  if (!key) key = await promptForKey();

  if (!key) {
    console.error('No API key provided. Get one at https://www.clipspeed.ai/dashboard/api-key/ then run: clipspeed-mcp install --key csai_live_...');
    return 1;
  }
  if (!looksLikeKey(key)) {
    console.error("That doesn't look like a ClipSpeed key (expected csai_live_...). Get one at https://www.clipspeed.ai/dashboard/api-key/");
    return 1;
  }

  // Read-or-create.
  let existing = {};
  try {
    if (fs.existsSync(target)) {
      const raw = fs.readFileSync(target, 'utf8');
      existing = raw.trim() ? JSON.parse(raw) : {};
    }
  } catch (e) {
    console.error(`Could not read the existing Claude Desktop config at ${target}: ${e.message}`);
    console.error('Fix or remove that file and re-run, or configure clipspeed manually (see the README).');
    return 1;
  }

  const merged = mergeConfig(existing, key);

  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  } catch (e) {
    console.error(`Could not write the Claude Desktop config at ${target}: ${e.message}`);
    return 1;
  }

  // Never print the key.
  console.error('ClipSpeed connected to Claude Desktop ✓');
  console.error(`  config: ${target}`);
  console.error('  Quit and reopen Claude Desktop for the tools to appear.');
  return 0;
}

module.exports = { install, configPath, mergeConfig, serverBlock, looksLikeKey, parseKeyArg };
