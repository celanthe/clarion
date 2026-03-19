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

import {
  SESSIONS_FILE,
  loadAgents, findAgent, isAgentMuted, parseArgs
} from './lib.js';

// Marker file that tells the stop hook "I'm handling voice for this session"
const WATCHER_LOCK = join(homedir(), '.config', 'clarion', 'watcher.lock');

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

// --- JSONL helpers ---

function projectDir(cwd) {
  const slug = cwd.replace(/[\\/]/g, '-');
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

// --- Multi-voice routing: detect subagent persona from tool calls ---

/**
 * Build a map of tool_use_id → agent ID by scanning for Agent tool calls
 * whose description or prompt matches a known agent name.
 */
function buildToolAgentMap(lines, agents) {
  const map = new Map();  // tool_use_id → agentId
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let entry;
    try { entry = JSON.parse(trimmed); } catch { continue; }
    if (entry.type !== 'assistant') continue;
    const blocks = entry.message?.content || [];
    for (const b of blocks) {
      if (b.type !== 'tool_use' || b.name !== 'Agent') continue;
      const desc = (b.input?.description || '').toLowerCase();
      const prompt = (b.input?.prompt || '').toLowerCase();
      for (const agent of agents) {
        const name = agent.name.toLowerCase();
        if (desc.includes(name) || prompt.startsWith(`you are ${name}`)) {
          map.set(b.id, agent.id);
          break;
        }
      }
    }
  }
  return map;
}

/**
 * Check if a JSONL entry contains a tool_result whose parent Agent call
 * matched a known agent. Returns { agentId, text } or null.
 *
 * Tool results appear inside user-type entries as content blocks:
 *   { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id, content }] } }
 */
function extractSubagentResult(entry, toolAgentMap) {
  if (entry.type !== 'user') return null;
  const blocks = entry.message?.content;
  if (!Array.isArray(blocks)) return null;

  for (const b of blocks) {
    if (b.type !== 'tool_result' || !b.tool_use_id) continue;
    const matchedAgent = toolAgentMap.get(b.tool_use_id);
    if (!matchedAgent) continue;

    // Extract text from the tool result content
    let text = '';
    if (typeof b.content === 'string') {
      text = b.content;
    } else if (Array.isArray(b.content)) {
      text = b.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
    }
    text = text.trim();
    if (text) return { agentId: matchedAgent, text };
  }
  return null;
}

// --- Text speaker with error tracking ---

const _backendFailures = new Map(); // backend → consecutive failure count
const FAILURE_SUPPRESS_THRESHOLD = 3;

function speak(text, agentId) {
  const agent = findAgent(agentId);
  const backend = agent?.backend || 'unknown';

  const proc = spawn('clarion-stream', ['--agent', agentId], {
    stdio: ['pipe', 'ignore', 'pipe']
  });

  let stderr = '';
  proc.stderr.on('data', (chunk) => { stderr += chunk; });

  proc.stdin.write(text);
  proc.stdin.end();

  proc.on('close', (code) => {
    if (code === 0) {
      // Reset failure count on success
      _backendFailures.delete(backend);
      return;
    }

    const count = (_backendFailures.get(backend) || 0) + 1;
    _backendFailures.set(backend, count);

    if (count === 1) {
      console.error(`[clarion-watch] Failed to speak as ${agentId} — run clarion-doctor`);
      if (stderr.trim()) console.error(`[clarion-watch]   ${stderr.trim().split('\n')[0]}`);
    } else if (count === FAILURE_SUPPRESS_THRESHOLD) {
      console.error(`[clarion-watch] ${backend} appears down. Suppressing further errors. Run clarion-doctor.`);
    }
    // After threshold, stay silent
  });
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
  let toolAgentMap = new Map();  // tool_use_id → agentId for multi-voice routing
  const allAgents = loadAgents();

  // Scan existing file to collect UUID set (without speaking) — prevents history replay on restart
  function initSession(file) {
    sessionFile = file;
    lastSize = -1;
    spokenUuids.clear();

    // Register session→agent mapping so the stop hook knows who's speaking
    const sessionId = basename(file, '.jsonl');
    registerSession(sessionId, agentId);
    writeLock(sessionId);

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

    const lines = raw.split('\n');

    // Rebuild tool→agent map for multi-voice routing
    toolAgentMap = buildToolAgentMap(lines, allAgents);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let entry;
      try { entry = JSON.parse(trimmed); } catch { continue; }

      if (!entry.uuid || spokenUuids.has(entry.uuid)) continue;
      spokenUuids.add(entry.uuid);

      // Multi-voice: check if this entry contains a subagent result with a known voice
      const subResult = extractSubagentResult(entry, toolAgentMap);
      if (subResult) {
        if (isAgentMuted(subResult.agentId)) {
          if (verbose) console.error(`[clarion-watch] Muted — skipping ${subResult.agentId} subagent entry ${entry.uuid.slice(0, 8)}…`);
          continue;
        }
        if (verbose) console.error(`[clarion-watch] Speaking entry ${entry.uuid.slice(0, 8)}… as ${subResult.agentId} (subagent)`);
        speak(subResult.text, subResult.agentId);
        continue;
      }

      // Regular assistant message — use session default voice
      const text = extractText(entry);
      if (!text) continue;

      if (isAgentMuted(agentId)) {
        if (verbose) console.error(`[clarion-watch] Muted — skipping entry ${entry.uuid.slice(0, 8)}…`);
        continue;
      }

      if (verbose) console.error(`[clarion-watch] Speaking entry ${entry.uuid.slice(0, 8)}… as ${agentId}`);
      speak(text, agentId);
    }
  }

  // Poll project dir for a newer session file (new Claude invocation = new JSONL)
  // Once locked, only switch if the current session file has been idle for 30s+
  // This prevents subagent sessions from hijacking the watcher.
  const SESSION_IDLE_THRESHOLD = 30_000; // 30 seconds

  function pollProjectDir() {
    const latest = latestJsonl(projDir, agentId, sessionFile);
    if (!latest) {
      if (!sessionFile && verbose) console.error(`[clarion-watch] Waiting for session JSONL…`);
      return;
    }
    if (latest === sessionFile) return;

    // If we already have a session, only switch if it's been idle
    if (sessionFile) {
      try {
        const currentMtime = statSync(sessionFile).mtimeMs;
        const age = Date.now() - currentMtime;
        if (age < SESSION_IDLE_THRESHOLD) {
          // Current session is still active — don't chase subagent sessions
          return;
        }
      } catch {}
      console.error(`[clarion-watch] New session: ${latest}`);
    } else {
      console.error(`[clarion-watch] Session: ${latest}`);
    }
    initSession(latest);
  }

  // Write watcher lock so the stop hook knows to stand down
  function writeLock(sessionId) {
    try { writeFileSync(WATCHER_LOCK, sessionId + '\n'); } catch {}
  }

  function clearLock() {
    try { if (existsSync(WATCHER_LOCK)) writeFileSync(WATCHER_LOCK, ''); } catch {}
  }

  // Graceful shutdown — unregister session mapping and remove lock
  function cleanup() {
    clearLock();
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
