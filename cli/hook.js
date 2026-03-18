#!/usr/bin/env node
/**
 * Clarion Claude Code Stop hook.
 * Reads the last assistant reply from the session transcript and speaks it
 * via clarion-stream (globally available via npm link). Looks up which agent
 * owns this session from the session-to-agent mapping written by clarion-watch.
 *
 * Install:
 *   cp cli/hook.js ~/.claude/clarion-hook.js
 *
 * Then configure in ~/.claude/settings.json:
 *   { "hooks": { "Stop": [{ "hooks": [{ "type": "command", "command": "~/.claude/clarion-hook.js" }] }] } }
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { spawn } from 'child_process';

const CONFIG_DIR     = join(homedir(), '.config', 'clarion');
const SESSIONS_FILE  = join(CONFIG_DIR, 'sessions.json');
const AGENTS_FILE    = join(CONFIG_DIR, 'agents.json');

function resolveAgent(sessionId) {
  // First: check session→agent mapping (written by clarion-watch)
  try {
    const sessions = JSON.parse(readFileSync(SESSIONS_FILE, 'utf8'));
    if (sessions[sessionId]) return sessions[sessionId];
  } catch {}

  // Fallback: first agent in agents.json
  try {
    const agents = JSON.parse(readFileSync(AGENTS_FILE, 'utf8'));
    if (agents.length > 0) return agents[0].id;
  } catch {}

  return null;
}

async function main() {
  // Read hook input from stdin
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;

  let hookData;
  try { hookData = JSON.parse(raw); } catch { process.exit(0); }

  const { session_id, cwd, stop_hook_active } = hookData;

  // Guard against infinite loops
  if (stop_hook_active) process.exit(0);

  // Resolve which agent owns this session
  const agent = resolveAgent(session_id);
  if (!agent) process.exit(0);

  // Locate the transcript JSONL
  const projectsDir = join(homedir(), '.claude', 'projects');
  const encoded = cwd.replace(/\//g, '-');
  let transcriptPath = join(projectsDir, encoded, `${session_id}.jsonl`);

  if (!existsSync(transcriptPath)) {
    try {
      for (const dir of readdirSync(projectsDir)) {
        const candidate = join(projectsDir, dir, `${session_id}.jsonl`);
        if (existsSync(candidate)) { transcriptPath = candidate; break; }
      }
    } catch {}
  }

  if (!existsSync(transcriptPath)) process.exit(0);

  // Parse JSONL — find the last assistant message
  const lines = readFileSync(transcriptPath, 'utf8').trim().split('\n');
  let lastText = null;

  for (let i = lines.length - 1; i >= 0; i--) {
    let entry;
    try { entry = JSON.parse(lines[i]); } catch { continue; }

    if (entry.type !== 'assistant') continue;

    const content = entry.message?.content;
    if (!Array.isArray(content)) continue;

    const text = content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();

    if (text) { lastText = text; break; }
  }

  if (!lastText) process.exit(0);

  // Pipe to clarion-stream (globally available via npm link)
  const proc = spawn('clarion-stream', ['--agent', agent], {
    stdio: ['pipe', 'ignore', 'inherit'],
    env: {
      ...process.env,
      CLARION_SERVER: process.env.CLARION_SERVER || 'http://localhost:8080'
    }
  });

  proc.stdin.write(lastText);
  proc.stdin.end();

  await new Promise(r => proc.on('close', r));
}

main().catch(() => process.exit(0));
