#!/usr/bin/env node
/**
 * clarion-mute — mute or unmute an agent in the CLI.
 *
 * Writes to ~/.config/clarion/agents.state.json.
 * clarion-stream reads this file before speaking.
 *
 * Usage:
 *   clarion-mute aria        # mute agent
 *   clarion-mute aria --off  # unmute
 *   clarion-mute --list      # show muted agents
 *   clarion-mute --help      # show this message
 */

import { readFileSync, writeFileSync } from 'fs';

import {
  CONFIG_DIR, STATE_FILE, loadAgentState, ensureConfigDir
} from './lib.js';

function loadState() {
  return loadAgentState();
}

function saveState(state) {
  ensureConfigDir();
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

function parseArgs(argv) {
  const flags = {};
  const raw = argv.slice(2);
  for (let i = 0; i < raw.length; i++) {
    if (raw[i].startsWith('--')) {
      const key  = raw[i].slice(2);
      const next = raw[i + 1];
      flags[key] = (next && !next.startsWith('--')) ? raw[++i] : true;
    } else if (!flags._agent) {
      flags._agent = raw[i];
    }
  }
  return flags;
}

const flags = parseArgs(process.argv);

if (flags.help) {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').match(/\/\*\*([\s\S]*?)\*\//)[1].replace(/^ \* ?/gm, ''));
  process.exit(0);
}

if (flags.list) {
  const state  = loadState();
  const muted  = Object.entries(state).filter(([, v]) => v.muted).map(([k]) => k);
  if (muted.length === 0) {
    console.log('No agents muted.');
  } else {
    console.log('Muted agents:');
    for (const id of muted) console.log(`  ${id}`);
  }
  process.exit(0);
}

if (!flags._agent) {
  console.error('Usage: clarion-mute <agent-id> [--off]');
  console.error('       clarion-mute --list');
  process.exit(1);
}

const id     = flags._agent;
const muting = !flags.off;
const state  = loadState();
state[id]    = { ...state[id], muted: muting };
saveState(state);

console.log(`${id}: ${muting ? 'muted' : 'unmuted'}`);
