#!/usr/bin/env node
/**
 * Clarion CLI — pipe your agent's text to their voice.
 *
 * Usage:
 *   node cli/speak.js "Hello, world." --backend kokoro --voice bm_george
 *   node cli/speak.js --agent julian "The pattern holds."
 *   echo "Hello." | node cli/speak.js --agent julian
 *   node cli/speak.js --list-agents
 *
 * Config (env or ~/.config/clarion/config.json):
 *   CLARION_SERVER=http://localhost:8787
 *
 * Agent profiles (~/.config/clarion/agents.json):
 *   Export from the Clarion UI and save to ~/.config/clarion/agents.json, or
 *   print the current agent list: node cli/speak.js --export
 */

import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { writeFileSync, mkdirSync } from 'fs';

const CONFIG_DIR  = join(homedir(), '.config', 'clarion');
const AGENTS_FILE = join(CONFIG_DIR, 'agents.json');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

// Ensure config directory exists on first run
mkdirSync(CONFIG_DIR, { recursive: true });

// --- Config ---

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

// --- Agents ---

function loadAgents() {
  if (!existsSync(AGENTS_FILE)) return [];
  try { return JSON.parse(readFileSync(AGENTS_FILE, 'utf8')); } catch { return []; }
}

function findAgent(id) {
  return loadAgents().find(a => a.id === id || a.name.toLowerCase() === id.toLowerCase()) || null;
}

// --- Speak ---

async function speak(text, { server, apiKey, backend, voice, speed }) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const res = await fetch(`${server}/speak`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text, backend: backend || 'edge', voice, speed: speed || 1.0 })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Server error ${res.status}`);
  }

  // Write raw audio to stdout — pipe to a player or file
  const buf = await res.arrayBuffer();
  process.stdout.write(Buffer.from(buf));
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
    console.error(`
clarion speak — pipe your agent's text to their voice

Usage:
  node cli/speak.js "text" [options]
  echo "text" | node cli/speak.js [options]

Options:
  --agent  <id>      Use a saved agent profile (by ID or name)
  --backend <name>   edge | kokoro | piper | elevenlabs | google  (default: edge)
  --voice  <id>      Voice ID for the backend
  --speed  <n>       Playback speed multiplier (default: 1.0)
  --server <url>     Clarion server URL (default: $CLARION_SERVER or localhost:8787)
  --export           Print saved agents as JSON to stdout
  --list-agents      Show saved agent profiles
  --help             This message

Output:
  Raw audio/mpeg piped to stdout. Pipe to a player:
    node cli/speak.js "Hello." | mpv -
    node cli/speak.js "Hello." | ffplay -nodisp -autoexit -

Agent profiles:
  Export from Clarion UI → save to ~/.config/clarion/agents.json
    `);
    process.exit(0);
  }

  // --list-agents
  if (flags['list-agents']) {
    const agents = loadAgents();
    if (!agents.length) {
      console.error('No agents found. Export from the Clarion UI to ~/.config/clarion/agents.json');
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

  // Resolve text from args or stdin
  const stdinText = await readStdin();
  const text = (argText || stdinText || '').trim();

  if (!text) {
    console.error('[clarion] Error: provide text as argument or via stdin');
    console.error('[clarion]   node cli/speak.js "Hello."');
    console.error('[clarion]   echo "Hello." | node cli/speak.js --agent julian');
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
      console.error(`[clarion] Run --list-agents to see saved profiles, or export from the UI.`);
      process.exit(1);
    }
    backend = backend || agent.backend;
    voice   = voice   || agent.voice;
    speed   = speed   ?? agent.speed;
    console.error(`[clarion] Speaking as ${agent.name} (${backend}/${voice})`);
  }

  try {
    await speak(text, { server, apiKey: config.apiKey, backend, voice, speed });
  } catch (err) {
    console.error(`[clarion] Error: ${err.message}`);
    process.exit(1);
  }
}

main();
