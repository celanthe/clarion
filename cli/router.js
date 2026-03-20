#!/usr/bin/env node
/**
 * clarion-router — multi-agent voice router.
 *
 * Watches ALL active Claude Code project directories for JSONL transcripts and
 * routes each assistant message through the correct agent voice automatically.
 * Handles subagent detection, audio queuing, and persona-to-voice mapping.
 *
 * Unlike clarion-watch (1 watcher = 1 agent = 1 terminal), this is a single
 * process that handles all active sessions across all projects.
 *
 * Usage:
 *   clarion-router                      # watch all active projects
 *   clarion-router --default <id>       # fallback agent voice (default: first in agents.json)
 *   clarion-router --verbose            # log detection events to stderr
 *   clarion-router --dry-run            # detect agents but don't speak (for testing)
 *   clarion-router --help
 *
 * Agent detection strategy (in priority order):
 *   1. Agent tool call: "description" or "prompt" field contains a known agent name
 *   2. System prompt persona: assistant message preceded by a system prompt naming an agent
 *   3. "You are <Name>" pattern in the first assistant message of a session
 *   4. Session→agent mapping from sessions.json (written by clarion-watch)
 *   5. Fallback to --default agent
 *
 * Audio queuing:
 *   All speech is serialized through a single FIFO queue. Agents never overlap.
 *   Each queued item carries the agent ID so the correct voice is used.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { homedir } from 'os';
import { join, basename } from 'path';
import { spawn } from 'child_process';

import {
  SESSIONS_FILE,
  loadAgents, findAgent, isAgentMuted, parseArgs
} from './lib.js';

// --- Constants ---

const PROJECTS_DIR = join(homedir(), '.claude', 'projects');
const WATCHER_LOCK = join(homedir(), '.config', 'clarion', 'router.lock');

// How recently a JSONL must have been modified to count as "active"
const ACTIVE_THRESHOLD = 5 * 60_000; // 5 minutes

// Poll intervals
const SESSION_POLL_MS = 200;
const PROJECT_SCAN_MS = 3000;

// --- Session tracker ---
// Each tracked session holds state for incremental JSONL parsing.

class SessionTracker {
  constructor(file, allAgents) {
    this.file = file;
    this.sessionId = basename(file, '.jsonl');
    this.allAgents = allAgents;
    this.spokenUuids = new Set();
    this.toolAgentMap = new Map(); // tool_use_id → agentId
    this.sessionAgentId = null;    // detected primary agent for this session
    this.lastSize = -1;
    this.lastActivity = Date.now();

    // Pre-scan existing entries (don't speak history on startup)
    this._prescan();
  }

  _prescan() {
    if (!existsSync(this.file)) return;
    let raw;
    try { raw = readFileSync(this.file, 'utf8'); } catch { return; }

    const lines = raw.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const entry = JSON.parse(trimmed);
        if (entry.uuid) this.spokenUuids.add(entry.uuid);
        // Detect session agent from early messages
        if (!this.sessionAgentId) {
          this._detectSessionAgent(entry);
        }
      } catch {}
    }

    // Also build the tool→agent map from existing content
    this.toolAgentMap = buildToolAgentMap(lines, this.allAgents);

    try { this.lastSize = statSync(this.file).size; } catch {}
  }

  /** Try to detect which agent this session belongs to from entry content */
  _detectSessionAgent(entry) {
    if (entry.type !== 'assistant') return;
    const blocks = entry.message?.content || [];
    for (const b of blocks) {
      if (b.type !== 'text') continue;
      const text = b.text || '';
      // Look for "You are <Name>" or "I am <Name>" patterns
      const match = text.match(/(?:You are|I am|I'm)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/);
      if (match) {
        const agent = this.allAgents.find(
          a => a.name.toLowerCase() === match[1].toLowerCase()
        );
        if (agent) {
          this.sessionAgentId = agent.id;
          return;
        }
      }
    }
  }

  /**
   * Poll for new entries. Returns an array of { agentId, text } items to speak.
   */
  poll() {
    if (!existsSync(this.file)) return [];

    let size;
    try { size = statSync(this.file).size; } catch { return []; }
    if (size === this.lastSize) return [];
    this.lastSize = size;
    this.lastActivity = Date.now();

    let raw;
    try { raw = readFileSync(this.file, 'utf8'); } catch { return []; }

    const lines = raw.split('\n');

    // Rebuild tool→agent map
    this.toolAgentMap = buildToolAgentMap(lines, this.allAgents);

    const items = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let entry;
      try { entry = JSON.parse(trimmed); } catch { continue; }

      if (!entry.uuid || this.spokenUuids.has(entry.uuid)) continue;
      this.spokenUuids.add(entry.uuid);

      // Try to detect session agent from content (updates sessionAgentId)
      if (!this.sessionAgentId) {
        this._detectSessionAgent(entry);
      }

      // Check for subagent tool results first
      const subResult = extractSubagentResult(entry, this.toolAgentMap);
      if (subResult) {
        items.push({ agentId: subResult.agentId, text: subResult.text });
        continue;
      }

      // Regular assistant message
      const text = extractText(entry);
      if (!text) continue;

      // Determine which agent voice to use
      const agentId = this.sessionAgentId
        || resolveAgentFromSessions(this.sessionId)
        || null; // caller will apply default

      items.push({ agentId, text });
    }

    return items;
  }

  get isStale() {
    return (Date.now() - this.lastActivity) > ACTIVE_THRESHOLD;
  }
}

// --- JSONL helpers (shared with watch.js logic) ---

function extractText(entry) {
  if (entry.type !== 'assistant') return null;
  const blocks = entry.message?.content || [];
  const parts = [];
  for (const b of blocks) {
    if (b.type === 'text') {
      const t = b.text?.trim();
      if (t) parts.push(t);
    }
  }
  const text = parts.join('\n').trim();
  // Skip code-only messages (proseOnly heuristic: if it's mostly code fences, skip)
  if (!text) return null;
  if (isCodeOnly(text)) return null;
  return text;
}

/**
 * Heuristic: a message is "code only" if >80% of its lines are inside code fences
 * or are blank lines between code fences.
 */
function isCodeOnly(text) {
  const lines = text.split('\n');
  if (lines.length === 0) return true;

  let inFence = false;
  let codeLines = 0;

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inFence = !inFence;
      codeLines++;
    } else if (inFence) {
      codeLines++;
    }
  }

  return codeLines / lines.length > 0.8;
}

function buildToolAgentMap(lines, agents) {
  const map = new Map();
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
        if (desc.includes(name) || prompt.includes(`you are ${name}`)) {
          map.set(b.id, agent.id);
          break;
        }
      }
    }
  }
  return map;
}

function extractSubagentResult(entry, toolAgentMap) {
  if (entry.type !== 'user') return null;
  const blocks = entry.message?.content;
  if (!Array.isArray(blocks)) return null;

  for (const b of blocks) {
    if (b.type !== 'tool_result' || !b.tool_use_id) continue;
    const matchedAgent = toolAgentMap.get(b.tool_use_id);
    if (!matchedAgent) continue;

    let text = '';
    if (typeof b.content === 'string') {
      text = b.content;
    } else if (Array.isArray(b.content)) {
      text = b.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
    }
    text = text.trim();
    if (text && !isCodeOnly(text)) return { agentId: matchedAgent, text };
  }
  return null;
}

function resolveAgentFromSessions(sessionId) {
  try {
    const sessions = JSON.parse(readFileSync(SESSIONS_FILE, 'utf8'));
    return sessions[sessionId] || null;
  } catch {
    return null;
  }
}

// --- Audio queue ---
// Serializes all speech across all sessions so agents never overlap.

class AudioQueue {
  constructor(speakFn) {
    this.speakFn = speakFn;
    this.queue = [];
    this.draining = false;
  }

  enqueue(agentId, text) {
    this.queue.push({ agentId, text });
    if (!this.draining) this._drain();
  }

  async _drain() {
    this.draining = true;
    while (this.queue.length > 0) {
      const { agentId, text } = this.queue.shift();
      await this.speakFn(agentId, text);
    }
    this.draining = false;
  }
}

// --- Speaker with error suppression ---

const _backendFailures = new Map();
const FAILURE_SUPPRESS_THRESHOLD = 3;

function speakAsync(text, agentId) {
  return new Promise((resolve) => {
    const agent = findAgent(agentId);
    const backend = agent?.backend || 'unknown';

    // Check if this backend has been failing repeatedly
    const failCount = _backendFailures.get(backend) || 0;
    if (failCount >= FAILURE_SUPPRESS_THRESHOLD) {
      resolve(); // silently skip
      return;
    }

    const proc = spawn('clarion-stream', ['--agent', agentId], {
      stdio: ['pipe', 'ignore', 'pipe']
    });

    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk; });

    proc.stdin.write(text);
    proc.stdin.end();

    proc.on('close', (code) => {
      if (code === 0) {
        _backendFailures.delete(backend);
      } else {
        const count = (_backendFailures.get(backend) || 0) + 1;
        _backendFailures.set(backend, count);

        if (count === 1) {
          console.error(`[clarion-router] TTS failed for ${agentId} — run clarion-doctor`);
          if (stderr.trim()) console.error(`[clarion-router]   ${stderr.trim().split('\n')[0]}`);
        } else if (count === FAILURE_SUPPRESS_THRESHOLD) {
          console.error(`[clarion-router] ${backend} appears down. Suppressing further errors.`);
        }
      }
      resolve();
    });

    proc.on('error', () => resolve());
  });
}

// --- Project scanner ---
// Discovers all active JSONL files across ~/.claude/projects/

function discoverActiveJsonls() {
  if (!existsSync(PROJECTS_DIR)) return [];

  const results = [];
  const now = Date.now();

  try {
    for (const projName of readdirSync(PROJECTS_DIR)) {
      const projPath = join(PROJECTS_DIR, projName);
      let st;
      try { st = statSync(projPath); } catch { continue; }
      if (!st.isDirectory()) continue;

      try {
        for (const fileName of readdirSync(projPath)) {
          if (!fileName.endsWith('.jsonl')) continue;
          const filePath = join(projPath, fileName);
          try {
            const fst = statSync(filePath);
            if (now - fst.mtimeMs < ACTIVE_THRESHOLD) {
              results.push({ file: filePath, project: projName });
            }
          } catch {}
        }
      } catch {}
    }
  } catch {}

  return results;
}

// --- Lock file ---

function writeLock() {
  try { writeFileSync(WATCHER_LOCK, `${process.pid}:${Date.now()}\n`); } catch {}
}

function clearLock() {
  try { if (existsSync(WATCHER_LOCK)) writeFileSync(WATCHER_LOCK, ''); } catch {}
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

  const allAgents = loadAgents();
  if (allAgents.length === 0) {
    console.error('[clarion-router] No agents found. Run clarion-init first.');
    process.exit(1);
  }

  // Resolve default/fallback agent
  let defaultAgentId;
  if (flags.default) {
    const agent = findAgent(flags.default);
    if (!agent) {
      console.error(`[clarion-router] Default agent not found: ${flags.default}`);
      process.exit(1);
    }
    defaultAgentId = agent.id;
  } else {
    defaultAgentId = allAgents[0].id;
  }

  const verbose = !!flags.verbose;
  const dryRun = !!flags['dry-run'];

  console.error(`[clarion-router] Starting multi-agent voice router`);
  console.error(`[clarion-router] Default voice: ${defaultAgentId}`);
  console.error(`[clarion-router] Watching: ${PROJECTS_DIR}`);
  console.error(`[clarion-router] Agents loaded: ${allAgents.map(a => a.id).join(', ')}`);

  writeLock();

  // Tracked sessions: file path → SessionTracker
  const sessions = new Map();

  // Audio queue — serializes all speech
  const audioQueue = new AudioQueue(async (agentId, text) => {
    if (dryRun) {
      console.error(`[clarion-router] [dry-run] Would speak as ${agentId}: ${text.slice(0, 80)}…`);
      return;
    }
    await speakAsync(text, agentId);
  });

  // Scan for active sessions
  function scanProjects() {
    const active = discoverActiveJsonls();

    for (const { file, project } of active) {
      if (!sessions.has(file)) {
        if (verbose) console.error(`[clarion-router] Tracking: ${file}`);
        sessions.set(file, new SessionTracker(file, allAgents));
      }
    }

    // Prune stale sessions
    for (const [file, tracker] of sessions) {
      if (tracker.isStale) {
        if (verbose) console.error(`[clarion-router] Dropping stale session: ${file}`);
        sessions.delete(file);
      }
    }
  }

  // Poll all tracked sessions for new messages
  function pollAll() {
    for (const [file, tracker] of sessions) {
      const items = tracker.poll();
      for (const item of items) {
        const agentId = item.agentId || defaultAgentId;

        // Skip if agent is muted
        if (isAgentMuted(agentId)) {
          if (verbose) console.error(`[clarion-router] Muted — skipping ${agentId}`);
          continue;
        }

        // Skip empty or whitespace-only text
        if (!item.text || !item.text.trim()) continue;

        if (verbose) {
          const preview = item.text.slice(0, 60).replace(/\n/g, ' ');
          console.error(`[clarion-router] Queuing ${agentId}: "${preview}…"`);
        }

        audioQueue.enqueue(agentId, item.text);
      }
    }
  }

  // Graceful shutdown
  function cleanup() {
    clearLock();
    console.error('\n[clarion-router] stopped');
  }
  process.on('SIGINT',  () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });

  // Initial scan
  scanProjects();

  // Poll loops
  setInterval(pollAll, SESSION_POLL_MS);
  setInterval(scanProjects, PROJECT_SCAN_MS);
}

main().catch(err => {
  console.error(`[clarion-router] Fatal: ${err.message}`);
  process.exit(1);
});
