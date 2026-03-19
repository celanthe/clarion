#!/usr/bin/env node
/**
 * clarion init — interactive setup wizard with multi-backend support.
 *
 * Creates an agent profile, saves it to ~/.config/clarion/agents.json,
 * and optionally writes the Claude Code stop hook.
 *
 * When the server is reachable, shows available backends and fetches
 * voice lists from the server. Falls back to embedded Edge TTS voices
 * if the server is unreachable.
 *
 * Usage:
 *   clarion-init
 */

import { createInterface } from 'readline';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { spawn } from 'child_process';

import {
  CONFIG_DIR, AGENTS_FILE, HOOK_FILE,
  loadConfig, loadAgents, ensureConfigDir
} from './lib.js';

// Edge TTS voices — embedded so setup works without a running server.
// Grouped to match server/src/edge.js.
const VOICE_GROUPS = [
  { label: 'US English', voices: [
    { id: 'en-US-JennyNeural',       label: 'Jenny',       gender: 'F' },
    { id: 'en-US-AriaNeural',        label: 'Aria',        gender: 'F' },
    { id: 'en-US-MichelleNeural',    label: 'Michelle',    gender: 'F' },
    { id: 'en-US-AnaNeural',         label: 'Ana',         gender: 'F' },
    { id: 'en-US-GuyNeural',         label: 'Guy',         gender: 'M' },
    { id: 'en-US-RyanNeural',        label: 'Ryan',        gender: 'M' },
    { id: 'en-US-ChristopherNeural', label: 'Christopher', gender: 'M' },
    { id: 'en-US-EricNeural',        label: 'Eric',        gender: 'M' },
  ]},
  { label: 'UK English', voices: [
    { id: 'en-GB-SoniaNeural',       label: 'Sonia',       gender: 'F' },
    { id: 'en-GB-LibbyNeural',       label: 'Libby',       gender: 'F' },
    { id: 'en-GB-MiaNeural',         label: 'Mia',         gender: 'F' },
    { id: 'en-GB-RyanNeural',        label: 'Ryan (UK)',   gender: 'M' },
    { id: 'en-GB-ThomasNeural',      label: 'Thomas',      gender: 'M' },
  ]},
  { label: 'Australian', voices: [
    { id: 'en-AU-NatashaNeural',     label: 'Natasha',     gender: 'F' },
    { id: 'en-AU-AnnetteNeural',     label: 'Annette',     gender: 'F' },
    { id: 'en-AU-WilliamNeural',     label: 'William',     gender: 'M' },
    { id: 'en-AU-DarrenNeural',      label: 'Darren',      gender: 'M' },
  ]},
  { label: 'Irish', voices: [
    { id: 'en-IE-EmilyNeural',       label: 'Emily',       gender: 'F' },
    { id: 'en-IE-ConnorNeural',      label: 'Connor',      gender: 'M' },
  ]},
  { label: 'Canadian', voices: [
    { id: 'en-CA-ClaraNeural',       label: 'Clara',       gender: 'F' },
    { id: 'en-CA-LiamNeural',        label: 'Liam',        gender: 'M' },
  ]},
  { label: 'South African', voices: [
    { id: 'en-ZA-LeahNeural',        label: 'Leah',        gender: 'F' },
    { id: 'en-ZA-LukeNeural',        label: 'Luke',        gender: 'M' },
  ]},
  { label: 'New Zealand', voices: [
    { id: 'en-NZ-MollyNeural',       label: 'Molly',       gender: 'F' },
    { id: 'en-NZ-MitchellNeural',    label: 'Mitchell',    gender: 'M' },
  ]},
  { label: 'Indian', voices: [
    { id: 'en-IN-NeerjaNeural',      label: 'Neerja',      gender: 'F' },
    { id: 'en-IN-PrabhatNeural',     label: 'Prabhat',     gender: 'M' },
  ]},
];

const BACKEND_LABELS = {
  edge:       'Edge TTS',
  kokoro:     'Kokoro',
  piper:      'Piper',
  elevenlabs: 'ElevenLabs',
  google:     'Google Chirp',
};

function allVoices() {
  return VOICE_GROUPS.flatMap(g => g.voices);
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'agent';
}

function saveAgents(agents) {
  ensureConfigDir();
  writeFileSync(AGENTS_FILE, JSON.stringify(agents, null, 2) + '\n');
}

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, answer => resolve(answer.trim())));
}

function hookScript(agentId) {
  if (!/^[a-z0-9-]+$/.test(agentId)) throw new Error(`Invalid agent ID for hook script: ${agentId}`);
  return `#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { spawn } from 'child_process';

const AGENT = '${agentId}';

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  const { session_id, cwd, stop_hook_active } = JSON.parse(raw);
  if (stop_hook_active) process.exit(0);

  const transcript = join(homedir(), '.claude', 'projects',
    cwd.replace(/\\//g, '-'), \`\${session_id}.jsonl\`);
  if (!existsSync(transcript)) process.exit(0);

  const lines = readFileSync(transcript, 'utf8').trim().split('\\n');
  let text = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    let e; try { e = JSON.parse(lines[i]); } catch { continue; }
    if (e.type !== 'assistant') continue;
    const t = (e.message?.content || [])
      .filter(b => b.type === 'text').map(b => b.text).join('\\n').trim();
    if (t) { text = t; break; }
  }
  if (!text) process.exit(0);

  const proc = spawn('clarion-stream', ['--agent', AGENT],
    { stdio: ['pipe', 'ignore', 'inherit'] });
  proc.stdin.write(text);
  proc.stdin.end();
  await new Promise(r => proc.on('close', r));
}

main().catch(() => process.exit(0));
`;
}

async function checkServer(config) {
  try {
    const headers = {};
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
    const res = await fetch(`${config.server}/health`, {
      headers,
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) return await res.json();
  } catch {}
  return null;
}

async function fetchVoicesFromServer(config, backend) {
  try {
    const headers = {};
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
    const res = await fetch(`${config.server}/voices?backend=${backend}`, {
      headers,
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await res.json();
      return data.voices || [];
    }
  } catch {}
  return null;
}

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const config = loadConfig();

  console.log('\nClarion setup\n');

  // Warn if agents already exist
  const existing = loadAgents();
  if (existing.length > 0) {
    console.log(`Found ${existing.length} existing agent${existing.length > 1 ? 's' : ''} in ${AGENTS_FILE}`);
    console.log('');
  }

  // Agent name
  const nameInput = await ask(rl, 'Agent name [My Agent]: ');
  const name = nameInput || 'My Agent';
  const defaultId = slugify(name);

  // Agent ID
  const idInput = await ask(rl, `Agent ID [${defaultId}]: `);
  const id = idInput || defaultId;

  // Warn if replacing an existing agent
  if (existing.some(a => a.id === id)) {
    console.log(`  Replacing existing agent "${id}".`);
  }

  // Server check — show which backends are available
  console.log(`\nChecking server at ${config.server}...`);
  const health = await checkServer(config);

  let backend = 'edge';
  let voices = null;
  let voice = null;

  if (health) {
    console.log('');
    console.log('Available backends:');
    const backends = ['edge', 'kokoro', 'piper', 'elevenlabs', 'google'];
    const available = [];
    for (let i = 0; i < backends.length; i++) {
      const b = backends[i];
      const status = health[b] || 'unconfigured';
      const icon = status === 'up' ? '✓ ready' : '✗ ' + status;
      console.log(`  ${i + 1}. ${BACKEND_LABELS[b].padEnd(14)} ${icon}`);
      available.push({ id: b, status });
    }
    console.log('');

    // Backend selection
    while (true) {
      const pick = await ask(rl, `Pick a backend [1–${backends.length}, default 1]: `);
      const idx = pick === '' ? 0 : parseInt(pick, 10) - 1;
      if (!isNaN(idx) && idx >= 0 && idx < backends.length) {
        backend = backends[idx];
        const status = available[idx].status;
        if (status !== 'up' && backend !== 'edge') {
          console.log(`  Warning: ${BACKEND_LABELS[backend]} is ${status}.`);
          const proceed = await ask(rl, '  Continue anyway? [y/N]: ');
          if (proceed.toLowerCase() !== 'y') continue;
        }
        break;
      }
      console.log(`  Enter a number from 1 to ${backends.length}.`);
    }

    // Fetch voice list from server
    console.log(`\nFetching ${BACKEND_LABELS[backend]} voices...`);
    const serverVoices = await fetchVoicesFromServer(config, backend);
    if (serverVoices && serverVoices.length > 0) {
      voices = serverVoices;
    }
  } else {
    console.log('  Server unreachable — using Edge TTS (always available).\n');
  }

  // Voice selection
  if (voices) {
    // Use server-provided voice list
    console.log(`\n${BACKEND_LABELS[backend]} voices\n`);
    for (let i = 0; i < voices.length; i++) {
      const v = voices[i];
      const label = v.label || v.id;
      const gender = v.gender ? `  ${v.gender}` : '';
      console.log(`  ${String(i + 1).padStart(3)}  ${label.padEnd(20)}${gender}   ${v.id}`);
    }
    console.log('');

    while (true) {
      const pick = await ask(rl, `Pick a voice [1–${voices.length}, default 1]: `);
      const idx = pick === '' ? 0 : parseInt(pick, 10) - 1;
      if (!isNaN(idx) && idx >= 0 && idx < voices.length) {
        voice = voices[idx];
        break;
      }
      console.log(`  Enter a number from 1 to ${voices.length}.`);
    }
  } else {
    // Fallback to embedded Edge voice list
    if (backend !== 'edge') {
      console.log(`  Could not fetch ${BACKEND_LABELS[backend]} voices. Falling back to Edge TTS.\n`);
      backend = 'edge';
    }
    console.log('\nEdge TTS voices (no server config needed)\n');
    const edgeVoices = allVoices();
    let n = 1;
    for (const group of VOICE_GROUPS) {
      console.log(`  ${group.label}`);
      for (const v of group.voices) {
        console.log(`  ${String(n).padStart(3)}  ${v.label.padEnd(14)} ${v.gender}   ${v.id}`);
        n++;
      }
      console.log('');
    }

    while (true) {
      const pick = await ask(rl, `Pick a voice [1–${edgeVoices.length}, default 1]: `);
      const idx = pick === '' ? 0 : parseInt(pick, 10) - 1;
      if (!isNaN(idx) && idx >= 0 && idx < edgeVoices.length) {
        voice = edgeVoices[idx];
        break;
      }
      console.log(`  Enter a number from 1 to ${edgeVoices.length}.`);
    }
  }

  // Optional audition
  const auditionAnswer = await ask(rl, '\nHear this voice? [y/N]: ');
  if (auditionAnswer.toLowerCase() === 'y') {
    console.log('  Playing sample...');
    try {
      const proc = spawn('clarion-speak', [
        '--backend', backend,
        '--voice', voice.id,
        'Hello. This is your agent speaking. The voice is configured and ready.'
      ], { stdio: ['ignore', 'ignore', 'inherit'] });
      await new Promise((resolve) => proc.on('close', resolve));
    } catch {
      console.log('  Could not play sample. Make sure clarion-speak is available.');
    }
  }

  // Speed
  let speed = 1.0;
  const speedInput = await ask(rl, 'Speed [1.0]: ');
  if (speedInput) {
    const s = parseFloat(speedInput);
    if (!isNaN(s) && s >= 0.25 && s <= 4.0) {
      speed = s;
    } else {
      console.log('  Invalid speed — using 1.0.');
    }
  }

  // Save agent
  const agent = { id, name, backend, voice: voice.id, speed, proseOnly: true };
  const updated = existing.filter(a => a.id !== id);
  saveAgents([...updated, agent]);

  console.log(`\n✓ Agent saved to ${AGENTS_FILE}`);
  console.log(`  ${name}  ·  ${BACKEND_LABELS[backend]}  ·  ${voice.id}  ·  ${speed}x`);

  // Hook
  console.log('');
  const hookAnswer = await ask(rl, `Write Claude Code stop hook to ${HOOK_FILE}? [Y/n]: `);

  if (hookAnswer.toLowerCase() !== 'n') {
    mkdirSync(join(homedir(), '.claude'), { recursive: true });
    writeFileSync(HOOK_FILE, hookScript(id), { mode: 0o755 });

    // Add ~/.claude/package.json if it doesn't already mark ESM
    const pkgPath = join(homedir(), '.claude', 'package.json');
    if (!existsSync(pkgPath)) {
      writeFileSync(pkgPath, '{"type":"module"}\n');
    } else {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        if (pkg.type !== 'module') {
          pkg.type = 'module';
          writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
        }
      } catch {}
    }

    console.log(`✓ Hook written to ${HOOK_FILE}`);
    console.log('');
    console.log('Add this to ~/.claude/settings.json:\n');
    const hookJson = JSON.stringify({
      hooks: { Stop: [{ hooks: [{ type: 'command', command: HOOK_FILE }] }] }
    }, null, 2);
    for (const line of hookJson.split('\n')) console.log(`  ${line}`);
    console.log('');
    console.log('If settings.json already has a hooks section, merge the Stop entry in.');
  }

  console.log('');
  console.log(`Done. Start the Clarion server, then every Claude reply will speak in ${name}'s voice.`);
  console.log('');
  console.log('  npm run server:start   (from the Clarion directory)');
  console.log('');

  rl.close();
}

main().catch(err => {
  console.error(`[clarion] ${err.message}`);
  process.exit(1);
});
