#!/usr/bin/env node
/**
 * clarion status — show server health, loaded agents, and hook state.
 *
 * Usage:
 *   clarion-status
 */

import { readFileSync, existsSync } from 'fs';

import {
  CONFIG_DIR, AGENTS_FILE, HOOK_FILE, SETTINGS_FILE, LOCK_FILE,
  loadConfig, loadAgents, loadAgentState
} from './lib.js';

function checkLock() {
  if (!existsSync(LOCK_FILE)) return null;
  try {
    const [pid] = readFileSync(LOCK_FILE, 'utf8').trim().split(':').map(Number);
    if (!pid) return null;
    try { process.kill(pid, 0); return pid; } catch { return null; }
  } catch { return null; }
}

function hookRegistered() {
  if (!existsSync(SETTINGS_FILE)) return false;
  try {
    const settings = JSON.parse(readFileSync(SETTINGS_FILE, 'utf8'));
    return (settings?.hooks?.Stop || []).some(group =>
      (group.hooks || []).some(h => h.command?.includes('clarion'))
    );
  } catch { return false; }
}

async function main() {
  const config = loadConfig();

  // Fetch server health
  let health = null;
  let serverUp = false;
  try {
    const headers = {};
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
    const res = await fetch(`${config.server}/health`, {
      headers,
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) { health = await res.json(); serverUp = true; }
  } catch {}

  console.log('');

  // Server
  if (serverUp) {
    console.log(`Server    ${config.server}  ✓ up`);
    for (const [backend, status] of Object.entries(health)) {
      const icon = status === 'up' ? '✓' : '✗';
      console.log(`          ${backend.padEnd(14)} ${icon} ${status}`);
    }
  } else {
    console.log(`Server    ${config.server}  ✗ unreachable`);
    console.log(`          Start with: npm run server:start  (from the Clarion directory)`);
  }
  console.log('');

  // Agents
  const agents = loadAgents();
  const state  = loadAgentState();
  if (agents.length === 0) {
    console.log(`Agents    none`);
    console.log(`          Run clarion-init to set up your first agent.`);
  } else {
    console.log(`Agents    ${agents.length}  (${AGENTS_FILE})`);
    for (const a of agents) {
      const muteFlag = state[a.id]?.muted ? '  🔇 muted' : '';
      console.log(`          ${a.id.padEnd(16)} ${a.backend.padEnd(10)} ${a.voice.padEnd(26)} ${a.name}${muteFlag}`);
    }
  }
  console.log('');

  // Hook
  const hookExists = existsSync(HOOK_FILE);
  const hookReg = hookRegistered();
  if (!hookExists) {
    console.log(`Hook      not found`);
    console.log(`          Run clarion-init to create it.`);
  } else if (!hookReg) {
    console.log(`Hook      ${HOOK_FILE}  ✓ found`);
    console.log(`          Not registered in ~/.claude/settings.json`);
  } else {
    console.log(`Hook      ${HOOK_FILE}  ✓ active`);
  }
  console.log('');

  // Playback
  const pid = checkLock();
  console.log(`Playing   ${pid ? `yes  (stream.js pid ${pid})` : 'idle'}`);
  console.log('');
}

main().catch(err => {
  console.error(`[clarion] ${err.message}`);
  process.exit(1);
});
