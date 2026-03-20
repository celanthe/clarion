#!/usr/bin/env node
/**
 * clarion-migrate — one-time config migration.
 *
 * Merges voice fields from ~/.config/terminus-dev/agent-preferences.json
 * into ~/.config/clarion/agents.json and strips them from the source.
 *
 * Safe to run multiple times — skips agents that already exist in
 * agents.json and only removes voice fields that were successfully merged.
 *
 * Usage:
 *   clarion-migrate              # run migration
 *   clarion-migrate --dry-run    # show what would change without writing
 *   clarion-migrate --help
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

import { AGENTS_FILE, loadAgents, ensureConfigDir, parseArgs } from './lib.js';

const TERMINUS_PREFS = join(homedir(), '.config', 'terminus-dev', 'agent-preferences.json');

const VOICE_FIELDS = ['voiceBackend', 'voiceName', 'voiceSpeed'];

function main() {
  const flags = parseArgs(process.argv);

  if (flags.help) {
    const src = readFileSync(new URL(import.meta.url), 'utf8');
    const doc = src.match(/\/\*\*([\s\S]*?)\*\//)[1].replace(/^ \* ?/gm, '');
    console.error(doc);
    process.exit(0);
  }

  const dryRun = !!flags['dry-run'];

  if (!existsSync(TERMINUS_PREFS)) {
    console.error('[clarion-migrate] No terminus agent-preferences.json found — nothing to migrate.');
    process.exit(0);
  }

  let prefs;
  try {
    prefs = JSON.parse(readFileSync(TERMINUS_PREFS, 'utf8'));
  } catch (err) {
    console.error(`[clarion-migrate] Failed to read ${TERMINUS_PREFS}: ${err.message}`);
    process.exit(1);
  }

  ensureConfigDir();
  const agents = loadAgents();
  const existingIds = new Set(agents.map(a => a.id));
  const existingNames = new Set(agents.map(a => a.name.toLowerCase()));

  let merged = 0;
  let skipped = 0;
  let stripped = 0;

  // Iterate over all keys in prefs that aren't _global
  for (const [key, value] of Object.entries(prefs)) {
    if (key === '_global') continue;
    if (typeof value !== 'object' || value === null) continue;

    // Only process entries that have voice fields
    const hasVoice = VOICE_FIELDS.some(f => value[f]);
    if (!hasVoice) continue;

    // Check if this agent already exists in agents.json
    const slug = key.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (existingIds.has(slug) || existingNames.has(key.toLowerCase())) {
      console.error(`[clarion-migrate] Skip: "${key}" already exists in agents.json`);
      skipped++;
      continue;
    }

    // Map terminus voice fields to Clarion agent format
    const agent = {
      id: slug,
      name: key.charAt(0).toUpperCase() + key.slice(1),
      backend: value.voiceBackend || 'edge',
      voice: value.voiceName || 'en-US-JennyNeural',
      speed: parseFloat(value.voiceSpeed) || 1.0,
      proseOnly: true,
      createdAt: new Date().toISOString(),
      migratedFrom: 'terminus-dev'
    };

    console.error(`[clarion-migrate] Merge: "${key}" → ${agent.id} (${agent.backend}/${agent.voice})`);
    agents.push(agent);
    merged++;

    // Mark voice fields for stripping
    if (!dryRun) {
      for (const f of VOICE_FIELDS) {
        if (value[f]) {
          delete value[f];
          stripped++;
        }
      }
    }
  }

  if (merged === 0 && skipped === 0) {
    console.error('[clarion-migrate] No voice entries found in terminus prefs — nothing to migrate.');
    process.exit(0);
  }

  if (dryRun) {
    console.error(`\n[clarion-migrate] Dry run: would merge ${merged}, skip ${skipped}`);
    console.error('[clarion-migrate] Run without --dry-run to apply.');
    process.exit(0);
  }

  // Write updated agents.json
  if (merged > 0) {
    writeFileSync(AGENTS_FILE, JSON.stringify(agents, null, 2) + '\n');
    console.error(`[clarion-migrate] Updated ${AGENTS_FILE}`);
  }

  // Write updated terminus prefs (with voice fields stripped)
  if (stripped > 0) {
    writeFileSync(TERMINUS_PREFS, JSON.stringify(prefs, null, 2) + '\n');
    console.error(`[clarion-migrate] Stripped ${stripped} voice fields from ${TERMINUS_PREFS}`);
  }

  console.error(`\n[clarion-migrate] Done: ${merged} merged, ${skipped} skipped, ${stripped} fields stripped.`);
}

main();
