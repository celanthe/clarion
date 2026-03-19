#!/usr/bin/env node
/**
 * clarion-log — show recent crew log entries from the CLI.
 *
 * Usage:
 *   clarion-log                      # show last 20 entries across all agents
 *   clarion-log --agent aria         # show last 20 entries for aria
 *   clarion-log --since 2026-03-15   # filter by date
 *   clarion-log --count 50           # more entries
 *   clarion-log --help               # show this message
 */

import { readFileSync, existsSync } from 'fs';

import { LOG_FILE, parseArgs } from './lib.js';

const flags = parseArgs(process.argv);

if (flags.help) {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').match(/\/\*\*([\s\S]*?)\*\//)[1].replace(/^ \* ?/gm, ''));
  process.exit(0);
}

const agentFilter = flags.agent || null;
const since       = flags.since ? new Date(flags.since).toISOString() : null;
const count       = parseInt(flags.count || '20', 10);

if (!existsSync(LOG_FILE)) {
  console.log('No crew log found. Speak as an agent via clarion-stream to create one.');
  process.exit(0);
}

const raw     = readFileSync(LOG_FILE, 'utf8').trim();
const lines   = raw ? raw.split('\n').filter(Boolean) : [];
const entries = lines
  .map(l => { try { return JSON.parse(l); } catch { return null; } })
  .filter(Boolean);

const filtered = entries
  .filter(e => !agentFilter || e.agentId === agentFilter)
  .filter(e => !since || e.timestamp >= since)
  .slice(-count);

if (filtered.length === 0) {
  console.log('No matching log entries.');
  process.exit(0);
}

for (const e of filtered) {
  const ts      = new Date(e.timestamp).toLocaleString();
  const id      = (e.agentId || 'unknown').padEnd(16);
  const preview = e.text.length > 80 ? e.text.slice(0, 77) + '...' : e.text;
  console.log(`${ts}  ${id}  ${preview}`);
}
