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
 * When a session is detected, registers a session→agent mapping in
 * ~/.config/clarion/sessions.json so the stop hook speaks as the correct agent.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { homedir } from 'os';
import { join, basename } from 'path';
import { spawn } from 'child_process';

const CONFIG_DIR    = join(homedir(), '.config', 'clarion');
const AGENTS_FILE   = join(CONFIG_DIR, 'agents.json');
const STATE_FILE    = join(CONFIG_DIR, 'agents.state.json');
const SESSIONS_FILE = join(CONFIG_DIR, 'sessions.json');

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

// --- Session-to-agent mapping (shared with stop hook) ---

function loadSessions() {
  try { return JSON.parse(readFileSync(SESSIONS_FILE, 'utf8')); } catch { return {}; }
}

function registerSession(sessionId, agentId) {
  const sessions = loadSessions();
  sessions[sessionId] = agentId;
  writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2) + '\n');
}

function unregisterSession(sessionId) {
  const sessions = loadSessions();
  delete sessions[sessionId];
  writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2) + '\n');
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

function latestJsonl(dir, ownAgentId, currentSessionFile) {
  if (!existsSync(dir)) return null;

  // Load sessions claimed by OTHER agents — skip those files
  const claimed = new Set();
  const sessions = loadSessions();
  for (const [sessionId, claimedAgent] of Object.entries(sessions)) {
    if (claimedAgent !== ownAgentId) claimed.add(sessionId);
  }

  let best = null;
  let bestMtime = 0;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.jsonl')) continue;
    const sessionId = name.slice(0, -6); // strip .jsonl

    // Allow our own current session, skip sessions claimed by others
    const full = join(dir, name);
    if (claimed.has(sessionId) && full !== currentSessionFile) continue;

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

    // Register session→agent mapping so the stop hook knows who's speaking
    const sessionId = basename(file, '.jsonl');
    registerSession(sessionId, agentId);

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
    const latest = latestJsonl(projDir, agentId, sessionFile);
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

  // Graceful shutdown — unregister session mapping
  function cleanup() {
    if (sessionFile) {
      const sessionId = basename(sessionFile, '.jsonl');
      try { unregisterSession(sessionId); } catch {}
    }
  }
  process.on('SIGINT',  () => { cleanup(); console.error('\n[clarion-watch] stopped'); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });

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
