#!/usr/bin/env node
/**
 * Clarion stream — real-time spoken output as text arrives.
 *
 * Reads stdin line by line, strips ANSI + Markdown, buffers into
 * sentences, and speaks each one in your agent's voice as soon as
 * it completes. Pre-fetches the next sentence while the current one
 * plays — minimal gaps between sentences.
 *
 * Usage:
 *   claude "What should I watch out for?" | node cli/stream.js --agent julian
 *   tail -f agent.log | node cli/stream.js --agent aria
 *   cat notes.md | node cli/stream.js --backend kokoro --voice bm_george
 *
 * Options:
 *   --agent   <id>    Agent profile by ID or name (~/.config/clarion/agents.json)
 *   --backend <name>  edge | kokoro | piper | elevenlabs | google  (default: edge)
 *   --voice   <id>    Voice ID for the backend
 *   --speed   <n>     Speed multiplier (default: 1.0)
 *   --server  <url>   Clarion server URL (default: $CLARION_SERVER or localhost:8787)
 *   --player  <cmd>   Audio player: afplay (macOS default), mpv, ffplay, aplay
 *   --plain           Skip ANSI/Markdown stripping — pass text through as-is
 *   --list-agents     Print saved agents and exit
 *   --help            Show this message
 *
 * Pipe patterns:
 *   ... | node cli/stream.js --agent julian | cat       ← audio to stdout too? No.
 *   Audio goes directly to --player. Text passthrough on stderr.
 */

import { createInterface }    from 'readline';
import { readFileSync, existsSync, writeFileSync, appendFileSync, mkdirSync, unlinkSync, openSync, writeSync, closeSync } from 'fs';
import { homedir, tmpdir, platform } from 'os';
import { join }               from 'path';
import { spawn }              from 'child_process';

// --- Playback lock ---
// Serializes multiple stream.js instances so agents speak in the order
// their responses completed. Each instance waits for the lock to clear
// before playing.
//
// Stale lock detection: a lock is stale only if the holder process is dead,
// OR if it has been held for >STALE_AGE (backstop for PID recycling edge cases).
// We do NOT bail out after a fixed wait — a long response can take several
// minutes, and all queued instances should wait their turn rather than stomp.

const LOCK_FILE  = join(tmpdir(), 'clarion-stream.lock');
const STALE_AGE  = 5 * 60_000;  // 5 min — only break locks from dead/hung processes
const LOCK_POLL  = 500;          // ms between lock-file checks

function acquireLock() {
  while (true) {
    // Atomic exclusive create — only one process wins the race.
    // openSync with 'wx' maps to O_CREAT|O_EXCL, which is atomic on POSIX.
    try {
      const fd = openSync(LOCK_FILE, 'wx');
      writeSync(fd, `${process.pid}:${Date.now()}`);
      closeSync(fd);
      return; // Lock acquired
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }

    // Lock exists — check if the holder is still alive
    try {
      const raw  = readFileSync(LOCK_FILE, 'utf8').trim();
      const [pid, ts] = raw.split(':').map(Number);
      const dead = !pid || (() => { try { process.kill(pid, 0); return false; } catch { return true; } })();
      const hung = Date.now() - (ts || 0) > STALE_AGE;
      if (dead || hung) {
        // Stale lock — remove and retry immediately
        try { unlinkSync(LOCK_FILE); } catch {}
        continue;
      }
    } catch {}

    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, LOCK_POLL);
  }
}

function releaseLock() {
  try {
    const raw = readFileSync(LOCK_FILE, 'utf8').trim();
    const pid = parseInt(raw.split(':')[0], 10);
    if (pid === process.pid) unlinkSync(LOCK_FILE);
  } catch {}
}

process.on('exit',    releaseLock);
process.on('SIGTERM', () => { releaseLock(); process.exit(0); });
process.on('SIGINT',  () => { releaseLock(); process.exit(0); });

const CONFIG_DIR   = join(homedir(), '.config', 'clarion');
const AGENTS_FILE  = join(CONFIG_DIR, 'agents.json');
const CONFIG_FILE  = join(CONFIG_DIR, 'config.json');
const LOG_FILE     = join(CONFIG_DIR, 'crew-log.jsonl');
const STATE_FILE   = join(CONFIG_DIR, 'agents.state.json');

// --- Config + agents (mirrors cli/speak.js) ---

function loadConfig() {
  const cfg = {};
  if (existsSync(CONFIG_FILE)) {
    try { Object.assign(cfg, JSON.parse(readFileSync(CONFIG_FILE, 'utf8'))); } catch {}
  }
  return {
    server: process.env.CLARION_SERVER || cfg.server || 'http://localhost:8787',
    apiKey: process.env.CLARION_API_KEY || cfg.apiKey || null
  };
}

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

// --- ANSI + Markdown cleaner ---

function clean(text) {
  // ANSI escape sequences (colors, cursor, OSC)
  text = text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
  text = text.replace(/\x1b\][^\x07\x1b]*[\x07\x1b\\]/g, '');
  // Remaining control chars (keep \n \t)
  text = text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');

  // Code fences — skip the contents (TTS should not read code)
  text = text.replace(/```[\s\S]*?```/g, '');
  // Inline code — keep the text
  text = text.replace(/`([^`]+)`/g, '$1');

  // HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Images → alt text; links → link text
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

  // Bold+italic → text
  text = text.replace(/\*{3}([^*]+)\*{3}/g, '$1');
  text = text.replace(/_{3}([^_]+)_{3}/g, '$1');
  text = text.replace(/\*{2}([^*]+)\*{2}/g, '$1');
  text = text.replace(/_{2}([^_]+)_{2}/g, '$1');
  text = text.replace(/\*([^*\n]+)\*/g, '$1');
  text = text.replace(/_([^_\n]+)_/g, '$1');
  // Strikethrough
  text = text.replace(/~~([^~]+)~~/g, '$1');

  // ATX headers — strip # markers
  text = text.replace(/^#{1,6}\s+/gm, '');
  // Blockquotes
  text = text.replace(/^>\s?/gm, '');
  // Horizontal rules
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');
  // List bullets/numbers
  text = text.replace(/^[ \t]*[-*+]\s+/gm, '');
  text = text.replace(/^[ \t]*\d+\.\s+/gm, '');

  // Collapse whitespace
  text = text.replace(/\t/g, ' ');
  text = text.replace(/ {2,}/g, ' ');

  return text;
}

// --- Sentence buffer ---
// Accumulates text and emits complete sentences to a callback.

class SentenceBuffer {
  constructor(onSentence) {
    this.buf = '';
    this.onSentence = onSentence;
  }

  push(text) {
    this.buf += text;
    this._extract();
  }

  flush() {
    const s = this.buf.trim();
    if (s) this.onSentence(s);
    this.buf = '';
  }

  _extract() {
    // Emit on:  `. `, `! `, `? ` before an uppercase letter, digit, or quote
    // Or on a blank line (paragraph boundary, represented as \n\n)
    const re = /[.!?]["']?\s+(?=[A-Z\d"([])|(?:\n\s*\n)/g;
    let last = 0;
    let m;
    while ((m = re.exec(this.buf)) !== null) {
      const end = m.index + m[0].length;
      const s = this.buf.slice(last, end).trim();
      if (s) this.onSentence(s);
      last = end;
    }
    if (last > 0) this.buf = this.buf.slice(last);

    // Safety flush — avoid buffering more than ~300 chars without a sentence break
    if (this.buf.length > 300) {
      // Find the last space to break cleanly
      const cut = this.buf.lastIndexOf(' ', 280);
      const s = (cut > 0 ? this.buf.slice(0, cut) : this.buf.slice(0, 300)).trim();
      if (s) this.onSentence(s);
      this.buf = cut > 0 ? this.buf.slice(cut + 1) : this.buf.slice(300);
    }
  }
}

// --- Audio fetch + play ---

async function fetchAudio(text, { server, apiKey, backend, voice, speed }) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const res = await fetch(`${server}/speak`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text, backend: backend || 'edge', voice, speed: speed || 1.0 })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Server ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function detectPlayer() {
  if (platform() === 'darwin') return 'afplay';
  return 'mpv';  // Linux/Windows default
}

function playBuffer(buffer, player) {
  const ext = '.mp3';
  const tmp = join(tmpdir(), `clarion-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);

  const playerArgs = {
    'afplay':  [tmp],
    'mpv':     ['--no-video', '--really-quiet', tmp],
    'ffplay':  ['-nodisp', '-autoexit', '-loglevel', 'quiet', tmp],
    'aplay':   [tmp],
  };

  return new Promise((resolve, reject) => {
    try {
      writeFileSync(tmp, buffer);
    } catch (err) {
      return reject(err);
    }
    const args = playerArgs[player] || [tmp];
    const proc = spawn(player, args, { stdio: 'ignore' });
    proc.on('close', () => { try { unlinkSync(tmp); } catch {} resolve(); });
    proc.on('error', (err) => { try { unlinkSync(tmp); } catch {} reject(err); });
  });
}

// --- Speaker queue ---
// Enqueuing a sentence immediately starts fetching its audio.
// The drain loop plays them in order — while N plays, N+1 is fetching.

class SpeakerQueue {
  constructor(fetchFn, playFn, onPlayed = null) {
    this.fetchFn  = fetchFn;
    this.playFn   = playFn;
    this.onPlayed = onPlayed;
    this.pending  = [];    // Array<{ fetch: Promise<Buffer>, text: string }>
    this.draining = false;
    this.finished = false;
    this._resolve = null;
  }

  enqueue(text) {
    if (!text.trim()) return;
    this.pending.push({ fetch: this.fetchFn(text), text });
    if (!this.draining) this._drain();
  }

  done() {
    this.finished = true;
    // If drain already ran out before done() was called
    if (!this.draining && this.pending.length === 0 && this._resolve) {
      this._resolve();
    }
  }

  wait() {
    return new Promise(r => {
      this._resolve = r;
      if (this.finished && !this.draining && this.pending.length === 0) r();
    });
  }

  async _drain() {
    this.draining = true;
    while (this.pending.length > 0) {
      const { fetch: p, text } = this.pending.shift();
      try {
        const buf = await p;
        await this.playFn(buf);
        this.onPlayed?.(text);
      } catch (err) {
        console.error(`[clarion] ${err.message}`);
      }
    }
    this.draining = false;
    if (this.finished && this._resolve) this._resolve();
  }
}

// --- Main ---

async function main() {
  acquireLock();
  const flags = parseArgs(process.argv);

  if (flags.help) {
    console.error(readFileSync(new URL(import.meta.url), 'utf8').match(/\/\*\*([\s\S]*?)\*\//)[1].replace(/^ \* ?/gm, ''));
    process.exit(0);
  }

  const config = loadConfig();

  if (flags['list-agents']) {
    const agents = loadAgents();
    if (!agents.length) {
      console.error('No agents found. Run clarion-init to set up your first agent.');
      process.exit(0);
    }
    for (const a of agents) {
      console.error(`  ${a.id.padEnd(20)} ${a.backend.padEnd(8)} ${a.voice.padEnd(20)} ${a.name}`);
    }
    process.exit(0);
  }

  const server = flags.server || config.server;
  const player = flags.player || detectPlayer();

  let backend = flags.backend;
  let voice   = flags.voice;
  let speed   = flags.speed ? parseFloat(flags.speed) : undefined;

  if (flags.agent) {
    const agent = findAgent(flags.agent);
    if (!agent) {
      console.error(`[clarion] Agent not found: ${flags.agent}`);
      console.error(`[clarion] Run clarion-stream --list-agents to see saved profiles, or clarion-init to create a new one.`);
      process.exit(1);
    }
    backend = backend || agent.backend;
    voice   = voice   || agent.voice;
    speed   = speed   ?? agent.speed;
    console.error(`[clarion] Speaking as ${agent.name} (${backend}/${voice})`);
  }

  const resolvedAgentId = flags.agent ? (findAgent(flags.agent)?.id || flags.agent) : null;

  const doFetch = (text) => fetchAudio(text, { server, apiKey: config.apiKey, backend, voice, speed });
  const doPlay  = (buf)  => playBuffer(buf, player);
  const doLog   = resolvedAgentId ? (text) => {
    try {
      if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
      const entry = JSON.stringify({
        timestamp: new Date().toISOString(),
        agentId:   resolvedAgentId,
        text,
        backend:   backend || 'edge',
        voice:     voice || null,
      });
      appendFileSync(LOG_FILE, entry + '\n');
    } catch {}
  } : null;

  const queue   = new SpeakerQueue(doFetch, doPlay, doLog);
  const sentBuf = new SentenceBuffer((s) => {
    if (resolvedAgentId && isAgentMuted(resolvedAgentId)) return;
    queue.enqueue(s);
  });
  const plain   = !!flags.plain;

  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

  rl.on('line', (rawLine) => {
    const line = plain ? rawLine : clean(rawLine);
    if (!line.trim()) {
      // Blank line = paragraph break — flush what we have
      sentBuf.flush();
    } else {
      sentBuf.push(line + ' ');
    }
  });

  rl.on('close', () => {
    sentBuf.flush();
    queue.done();
  });

  await queue.wait();
}

main().catch(err => {
  console.error(`[clarion] Fatal: ${err.message}`);
  process.exit(1);
});
