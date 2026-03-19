#!/usr/bin/env node
/**
 * Clarion speak — speak text in any agent's voice on demand.
 *
 * Designed for use inside Claude Code sessions: an agent can call
 * clarion-speak mid-turn to voice a line as a different agent, then the
 * stop hook will skip any text that was already spoken.
 *
 * Usage:
 *   clarion-speak --agent my-agent "The pattern holds."
 *   echo "Hello." | clarion-speak --agent my-agent
 *   clarion-speak --list-agents
 *   clarion-speak --export
 *
 * Options:
 *   --agent   <id>    Agent profile by ID or name (required for speaking)
 *   --backend <name>  edge | kokoro | piper | elevenlabs | google  (default: edge)
 *   --voice   <id>    Voice ID for the backend
 *   --speed   <n>     Speed multiplier (default: 1.0)
 *   --server  <url>   Clarion server URL (default: $CLARION_SERVER or localhost:8080)
 *   --player  <cmd>   Audio player: afplay (macOS default), mpv, ffplay, aplay
 *   --raw             Write audio to stdout instead of playing (old behavior)
 *   --export          Print saved agents as JSON to stdout
 *   --list-agents     Show saved agent profiles
 *   --help            This message
 *
 * Spoken log:
 *   Each spoken text is hashed (SHA-256) and logged to
 *   ~/.config/clarion/spoken.log with a timestamp. The stop hook reads
 *   this log to avoid double-speaking text that was already voiced via
 *   clarion-speak during the turn.
 */

import { createHash } from 'crypto';
import { readFileSync, existsSync, writeFileSync, appendFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawn } from 'child_process';

import {
  SPOKEN_LOG,
  loadConfig, loadAgents, findAgent, detectPlayer, ensureConfigDir
} from './lib.js';

// Ensure config directory exists on first run
ensureConfigDir();

// --- Speak ---

async function fetchAudio(text, { server, apiKey, backend, voice, speed }) {
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

  return Buffer.from(await res.arrayBuffer());
}

// --- Audio playback ---

function playBuffer(buffer, player) {
  const tmp = join(tmpdir(), `clarion-speak-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);

  const playerArgs = {
    'afplay':  [tmp],
    'mpv':     ['--no-video', '--really-quiet', tmp],
    'ffplay':  ['-nodisp', '-autoexit', '-loglevel', 'quiet', tmp],
    'paplay':  [tmp],
    'cvlc':    ['--play-and-exit', '-q', tmp],
  };

  return new Promise((resolve, reject) => {
    try {
      writeFileSync(tmp, buffer, { mode: 0o600 });
    } catch (err) {
      return reject(err);
    }
    const args = playerArgs[player] || [tmp];
    const proc = spawn(player, args, { stdio: 'ignore' });
    proc.on('close', () => { try { unlinkSync(tmp); } catch {} resolve(); });
    proc.on('error', (err) => { try { unlinkSync(tmp); } catch {} reject(err); });
  });
}

// --- Spoken log ---

function hashText(text) {
  return createHash('sha256').update(text.trim()).digest('hex');
}

function logSpoken(text) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    hash: hashText(text),
    length: text.trim().length
  });
  appendFileSync(SPOKEN_LOG, entry + '\n');
}

// --- Args ---

function parseArgs(argv) {
  const args = { flags: {}, text: null };
  const raw = argv.slice(2);
  const positional = [];

  for (let i = 0; i < raw.length; i++) {
    if (raw[i].startsWith('--')) {
      const key = raw[i].slice(2);
      const val = raw[i + 1] && !raw[i + 1].startsWith('--') ? raw[++i] : true;
      args.flags[key] = val;
    } else {
      positional.push(raw[i]);
    }
  }

  if (positional.length) args.text = positional.join(' ');
  return args;
}

// --- Stdin reader ---

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve(null);
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data.trim() || null));
  });
}

// --- Main ---

async function main() {
  const { flags, text: argText } = parseArgs(process.argv);
  const config = loadConfig();

  // --help
  if (flags.help) {
    console.error(readFileSync(new URL(import.meta.url), 'utf8').match(/\/\*\*([\s\S]*?)\*\//)[1].replace(/^ \* ?/gm, ''));
    process.exit(0);
  }

  // --list-agents
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

  // --export: print agents JSON to stdout
  if (flags.export) {
    const agents = loadAgents();
    process.stdout.write(JSON.stringify(agents, null, 2) + '\n');
    process.exit(0);
  }

  const server = flags.server || config.server;
  const player = flags.player || detectPlayer();

  // Resolve text from args or stdin
  const stdinText = await readStdin();
  const text = (argText || stdinText || '').trim();

  if (!text) {
    console.error('[clarion] Error: provide text as argument or via stdin');
    console.error('[clarion]   clarion-speak --agent my-agent "Hello."');
    console.error('[clarion]   echo "Hello." | clarion-speak --agent my-agent');
    process.exit(1);
  }

  // --agent is required for speaking
  if (!flags.agent && !flags.backend) {
    console.error('[clarion] Error: --agent <id> is required');
    console.error('[clarion]   clarion-speak --agent my-agent "Hello."');
    process.exit(1);
  }

  // Resolve voice settings — agent profile or explicit flags
  let backend = flags.backend;
  let voice   = flags.voice;
  let speed   = flags.speed ? parseFloat(flags.speed) : undefined;

  if (flags.agent) {
    const agent = findAgent(flags.agent);
    if (!agent) {
      console.error(`[clarion] Agent not found: ${flags.agent}`);
      console.error(`[clarion] Run clarion-speak --list-agents to see saved profiles, or clarion-init to create a new one.`);
      process.exit(1);
    }
    backend = backend || agent.backend;
    voice   = voice   || agent.voice;
    speed   = speed   ?? agent.speed;
    console.error(`[clarion] Speaking as ${agent.name} (${backend}/${voice})`);
  }

  try {
    const audio = await fetchAudio(text, { server, apiKey: config.apiKey, backend, voice, speed });

    if (flags.raw) {
      // Legacy: write raw audio to stdout
      process.stdout.write(audio);
    } else {
      // Play directly
      await playBuffer(audio, player);
    }

    // Log the spoken text hash so the stop hook can skip it
    logSpoken(text);
    console.error('[clarion] Logged to spoken.log');
  } catch (err) {
    console.error(`[clarion] Error: ${err.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`[clarion] ${err.message}`);
  process.exit(1);
});
