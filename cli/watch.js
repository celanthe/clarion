#!/usr/bin/env node
/**
 * clarion-watch — persistent daemon for live session voice.
 *
 * Watches the Claude Code session JSONL for the current project directory and
 * speaks each assistant message as soon as it is written — including text blocks
 * that appear before tool use. Voice starts while Claude is still working.
 *
 * Usage:
 *   clarion-watch                       # watch cwd, auto-select agent if only one
 *   clarion-watch --agent <id>          # explicit agent by ID or name
 *   clarion-watch --cwd /path/to/proj   # explicit project dir (default: process.cwd())
 *   clarion-watch --verbose             # log detection events to stderr
 *   clarion-watch --help
 *
 * Note: if both clarion-watch and the stop hook are active, the same message
 * will be spoken twice — once mid-session from watch, once at stop from hook.
 * Use one or the other, not both.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { spawn } from 'child_process';

const CONFIG_DIR  = join(homedir(), '.config', 'clarion');
const AGENTS_FILE = join(CONFIG_DIR, 'agents.json');
const STATE_FILE  = join(CONFIG_DIR, 'agents.state.json');
const HOOK_FILE   = join(homedir(), '.claude', 'clarion-hook.js');
const SETTINGS_FILE = join(homedir(), '.claude', 'settings.json');

// --- Agent loading (mirrors cli/stream.js) ---

function loadAgents() {
  if (!existsSync(AGENTS_FILE)) return [];
  try { return JSON.parse(readFileSync(AGENTS_FILE, 'utf8')); } catch { return []; }
}

function findAgent(id) {
  return loadAgents().find(a => a.id === id || a.name.toLowerCase() === id.toLowerCase()) || null;
}

function isAgentMuted(agentId) {
  if (!agentId) return false;
  try {
    const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
    return !!(state[agentId]?.muted);
  } catch { return false; }
}

// --- Hook coexistence check ---

function isHookRegistered() {
  if (!existsSync(HOOK_FILE)) return false;
  if (!existsSync(SETTINGS_FILE)) return false;
  try {
    const settings = JSON.parse(readFileSync(SETTINGS_FILE, 'utf8'));
    const stopHooks = settings?.hooks?.Stop ?? [];
    return stopHooks.some(group =>
      (group.hooks ?? []).some(h => h.type === 'command' && h.command?.includes('clarion'))
    );
  } catch { return false; }
}

// --- Arg parsing ---

function parseArgs(argv) {
  const flags = {};
  const raw = argv.slice(2);
  for (let i = 0; i < raw.length; i++) {
    if (raw[i].startsWith('--')) {
      const key = raw[i].slice(2);
      const next = raw[i + 1];
      flags[key] = (next && !next.startsWith('--')) ? raw[++i] : true;
    }
  }
  return flags;
}

// --- JSONL helpers ---

function projectDir(cwd) {
  const slug = cwd.replace(/\//g, '-');
  return join(homedir(), '.claude', 'projects', slug);
}

function latestJsonl(dir) {
  if (!existsSync(dir)) return null;
  let best = null;
  let bestMtime = 0;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.jsonl')) continue;
    const full = join(dir, name);
    try {
      const mtime = statSync(full).mtimeMs;
      if (mtime > bestMtime) { bestMtime = mtime; best = full; }
    } catch {}
  }
  return best;
}

function extractText(entry) {
  if (entry.type !== 'assistant') return null;
  const blocks = entry.message?.content || [];
  const text = blocks.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  return text || null;
}

// --- Text speaker ---

function speak(text, agentId) {
  const proc = spawn('clarion-stream', ['--agent', agentId], {
    stdio: ['pipe', 'ignore', 'inherit']
  });
  proc.stdin.write(text);
  proc.stdin.end();
  // Don't await — lockfile in clarion-stream serializes concurrent calls
}

// --- Main ---

async function main() {
  const flags = parseArgs(process.argv);

  if (flags.help) {
    const src = readFileSync(new URL(import.meta.url), 'utf8');
    const doc = src.match(/\/\*\*([\s\S]*?)\*\//)[1].replace(/^ \* ?/gm, '');
    console.error(doc);
    process.exit(0);
  }

  // Resolve agent
  let agentId;
  if (flags.agent) {
    const agent = findAgent(flags.agent);
    if (!agent) {
      console.error(`[clarion-watch] Agent not found: ${flags.agent}`);
      console.error(`[clarion-watch] Run clarion-stream --list-agents to see saved profiles.`);
      process.exit(1);
    }
    agentId = agent.id;
    console.error(`[clarion-watch] Agent: ${agent.name} (${agentId})`);
  } else {
    const agents = loadAgents();
    if (agents.length === 0) {
      console.error(`[clarion-watch] No agents found. Run clarion-init first.`);
      process.exit(1);
    }
    if (agents.length > 1) {
      console.error(`[clarion-watch] Multiple agents found — use --agent <id> to select one.`);
      for (const a of agents) console.error(`  ${a.id.padEnd(20)} ${a.name}`);
      process.exit(1);
    }
    agentId = agents[0].id;
    console.error(`[clarion-watch] Agent: ${agents[0].name} (${agentId})`);
  }

  // Warn if the stop hook is also active — same message will be spoken twice
  if (isHookRegistered()) {
    console.error(`[clarion-watch] Warning: the Clarion stop hook is also registered in ~/.claude/settings.json.`);
    console.error(`[clarion-watch] Messages will be spoken twice — once mid-session (watch) and once at stop (hook).`);
    console.error(`[clarion-watch] Remove the Stop hook entry from settings.json if you want watch-only behavior.`);
  }

  const verbose = !!flags.verbose;
  const cwd = flags.cwd || process.cwd();
  const projDir = projectDir(cwd);

  console.error(`[clarion-watch] Watching: ${projDir}`);

  // State
  const spokenUuids = new Set();
  let sessionFile = null;
  let lastSize = -1;

  // Scan existing file to collect UUID set (without speaking) — prevents history replay on restart
  function initSession(file) {
    sessionFile = file;
    lastSize = -1;
    spokenUuids.clear();

    if (!existsSync(file)) return;
    let raw;
    try { raw = readFileSync(file, 'utf8'); } catch { return; }

    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const entry = JSON.parse(trimmed);
        if (entry.uuid) spokenUuids.add(entry.uuid);
      } catch {}
    }

    try { lastSize = statSync(file).size; } catch {}

    if (verbose) console.error(`[clarion-watch] Session: ${file} (${spokenUuids.size} existing entries)`);
  }

  // Poll the session file for new entries
  function pollSession() {
    if (!sessionFile || !existsSync(sessionFile)) return;

    let size;
    try { size = statSync(sessionFile).size; } catch { return; }
    if (size === lastSize) return;
    lastSize = size;

    let raw;
    try { raw = readFileSync(sessionFile, 'utf8'); } catch { return; }

    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let entry;
      try { entry = JSON.parse(trimmed); } catch { continue; }

      if (!entry.uuid || spokenUuids.has(entry.uuid)) continue;
      spokenUuids.add(entry.uuid);

      const text = extractText(entry);
      if (!text) continue;

      if (isAgentMuted(agentId)) {
        if (verbose) console.error(`[clarion-watch] Muted — skipping entry ${entry.uuid.slice(0, 8)}…`);
        continue;
      }

      if (verbose) console.error(`[clarion-watch] Speaking entry ${entry.uuid.slice(0, 8)}…`);
      speak(text, agentId);
    }
  }

  // Poll project dir for a newer session file (new Claude invocation = new JSONL)
  function pollProjectDir() {
    const latest = latestJsonl(projDir);
    if (!latest) {
      if (!sessionFile && verbose) console.error(`[clarion-watch] Waiting for session JSONL…`);
      return;
    }
    if (latest === sessionFile) return;

    if (sessionFile) {
      console.error(`[clarion-watch] New session: ${latest}`);
    } else {
      console.error(`[clarion-watch] Session: ${latest}`);
    }
    initSession(latest);
  }

  // Graceful shutdown
  process.on('SIGINT',  () => { console.error('\n[clarion-watch] stopped'); process.exit(0); });
  process.on('SIGTERM', () => { process.exit(0); });

  // Initial scan
  pollProjectDir();

  // Poll loops
  setInterval(pollSession, 200);
  setInterval(pollProjectDir, 2000);
}

main().catch(err => {
  console.error(`[clarion-watch] Fatal: ${err.message}`);
  process.exit(1);
});
