/**
 * Shared CLI utilities — config loading, agent resolution, arg parsing.
 *
 * Extracted from cli/status.js, cli/stream.js, cli/watch.js, cli/speak.js,
 * cli/mute.js, cli/log.js to eliminate duplication across CLI scripts.
 *
 * Zero npm dependencies — uses only Node.js built-ins.
 */

import { readFileSync, existsSync, mkdirSync } from 'fs';
import { homedir, tmpdir, platform } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

// --- Path constants ---

export const CONFIG_DIR    = join(homedir(), '.config', 'clarion');
export const AGENTS_FILE   = join(CONFIG_DIR, 'agents.json');
export const CONFIG_FILE   = join(CONFIG_DIR, 'config.json');
export const STATE_FILE    = join(CONFIG_DIR, 'agents.state.json');
export const SESSIONS_FILE = join(CONFIG_DIR, 'sessions.json');
export const LOG_FILE      = join(CONFIG_DIR, 'crew-log.jsonl');
export const SPOKEN_LOG    = join(CONFIG_DIR, 'spoken.log');
export const HOOK_FILE     = join(homedir(), '.claude', 'clarion-hook.js');
export const SETTINGS_FILE = join(homedir(), '.claude', 'settings.json');
export const LOCK_FILE     = join(tmpdir(), 'clarion-stream.lock');

// --- Config ---

export function loadConfig() {
  const cfg = {};
  if (existsSync(CONFIG_FILE)) {
    try { Object.assign(cfg, JSON.parse(readFileSync(CONFIG_FILE, 'utf8'))); } catch {}
  }
  return {
    server: process.env.CLARION_SERVER || cfg.server || 'http://localhost:8080',
    apiKey: process.env.CLARION_API_KEY || cfg.apiKey || null,
  };
}

// --- Agents ---

export function loadAgents() {
  if (!existsSync(AGENTS_FILE)) return [];
  try { return JSON.parse(readFileSync(AGENTS_FILE, 'utf8')); } catch { return []; }
}

export function findAgent(id) {
  return loadAgents().find(a => a.id === id || a.name.toLowerCase() === id.toLowerCase()) || null;
}

export function isAgentMuted(agentId) {
  if (!agentId) return false;
  try {
    const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
    return !!(state[agentId]?.muted);
  } catch { return false; }
}

export function loadAgentState() {
  if (!existsSync(STATE_FILE)) return {};
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
}

// --- Arg parsing ---

export function parseArgs(argv) {
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

// --- Audio player detection ---

export function detectPlayer() {
  if (platform() === 'darwin') return 'afplay';
  const which = platform() === 'win32' ? 'where' : 'which';
  if (platform() === 'win32') {
    // Windows: try powershell media player, then common CLI players
    for (const player of ['mpv', 'ffplay', 'vlc']) {
      try { execSync(`${which} ${player}`, { stdio: 'pipe' }); return player; } catch {}
    }
    return 'powershell'; // fallback — will use [System.Media.SoundPlayer]
  }
  // Linux: check what's actually installed (paplay/mpv/ffplay handle MP3; aplay does not)
  for (const player of ['mpv', 'ffplay', 'paplay', 'cvlc']) {
    try { execSync(`${which} ${player}`, { stdio: 'pipe' }); return player; } catch {}
  }
  return 'mpv'; // fallback even if not found — will error at playback time
}

// --- Ensure config dir ---

export function ensureConfigDir() {
  mkdirSync(CONFIG_DIR, { recursive: true });
}

// --- Project directory ---

/**
 * Convert a working directory path to the Claude Code projects slug.
 * Handles both forward slashes (POSIX) and backslashes (Windows).
 */
export function projectDir(cwd) {
  const slug = cwd.replace(/[\\/]/g, '-');
  return join(homedir(), '.claude', 'projects', slug);
}

// --- Audio fetch (shared by speak.js and stream.js) ---

export async function fetchAudio(text, { server, apiKey, backend, voice, speed }) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const res = await fetch(`${server}/speak`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text, backend: backend || 'edge', voice, speed: speed || 1.0 }),
    signal: AbortSignal.timeout(30000)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Server error ${res.status}`);
  }

  const fallback = res.headers.get('X-Clarion-Fallback');
  if (fallback) {
    console.error(`[clarion] Warning: ${backend || 'backend'} unavailable, fell back to ${fallback}`);
  }

  return Buffer.from(await res.arrayBuffer());
}
