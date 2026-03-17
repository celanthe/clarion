#!/usr/bin/env node
/**
 * clarion init — interactive first-run setup wizard.
 *
 * Creates an agent profile using Edge TTS (no server config needed),
 * saves it to ~/.config/clarion/agents.json, and optionally writes the
 * Claude Code stop hook to ~/.claude/clarion-hook.js.
 *
 * Usage:
 *   clarion-init
 */

import { createInterface } from 'readline';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CONFIG_DIR   = join(homedir(), '.config', 'clarion');
const AGENTS_FILE  = join(CONFIG_DIR, 'agents.json');
const HOOK_FILE    = join(homedir(), '.claude', 'clarion-hook.js');

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

function allVoices() {
  return VOICE_GROUPS.flatMap(g => g.voices);
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'agent';
}

function loadAgents() {
  if (!existsSync(AGENTS_FILE)) return [];
  try { return JSON.parse(readFileSync(AGENTS_FILE, 'utf8')); } catch { return []; }
}

function saveAgents(agents) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(AGENTS_FILE, JSON.stringify(agents, null, 2) + '\n');
}

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, answer => resolve(answer.trim())));
}

function hookScript(agentId) {
  // Backslashes and template expressions that must survive the template literal:
  //   \/   → \\/ in source  → \/ in output (regex escape)
  //   \n   → \\n in source  → \n in output (string literal)
  //   `    → \` in source   → ` in output
  //   ${…} → \${…} in source → ${…} in output (template expression)
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

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

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

  // Voice selection
  console.log('\nEdge TTS voices (no server config needed)\n');
  const voices = allVoices();
  let n = 1;
  for (const group of VOICE_GROUPS) {
    console.log(`  ${group.label}`);
    for (const v of group.voices) {
      console.log(`  ${String(n).padStart(3)}  ${v.label.padEnd(14)} ${v.gender}   ${v.id}`);
      n++;
    }
    console.log('');
  }

  let voice;
  while (true) {
    const pick = await ask(rl, `Pick a voice [1–${voices.length}, default 1]: `);
    const idx = pick === '' ? 0 : parseInt(pick, 10) - 1;
    if (!isNaN(idx) && idx >= 0 && idx < voices.length) {
      voice = voices[idx];
      break;
    }
    console.log(`  Enter a number from 1 to ${voices.length}.`);
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
  const agent = { id, name, backend: 'edge', voice: voice.id, speed, proseOnly: true };
  const updated = existing.filter(a => a.id !== id);
  saveAgents([...updated, agent]);

  console.log(`\n✓ Agent saved to ${AGENTS_FILE}`);
  console.log(`  ${name}  ·  ${voice.id}  ·  ${speed}x`);

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
