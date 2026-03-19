#!/usr/bin/env node
/**
 * clarion doctor — diagnose setup issues.
 *
 * Runs 10 checks with pass/fail and remediation hints.
 * Pure read-only — never writes anything.
 *
 * Usage:
 *   clarion-doctor
 *   clarion-doctor --help
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { homedir, tmpdir, platform } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

import {
  CONFIG_DIR, AGENTS_FILE, CONFIG_FILE, SESSIONS_FILE, LOCK_FILE,
  loadConfig, loadAgents
} from './lib.js';

const BACKENDS = ['edge', 'kokoro', 'piper', 'elevenlabs', 'google'];

const BACKEND_HINTS = {
  kokoro:      'Is Docker running? Check with: docker ps\n    Then: docker-compose up -d',
  piper:       'Is the Piper server running? Check PIPER_SERVER in your server .env',
  elevenlabs:  'API key may be expired or invalid. Renew at elevenlabs.io/account',
  google:      'API key may be invalid. Check GOOGLE_TTS_API_KEY in your server .env',
};

function pass(msg) { console.log(`  ✓ ${msg}`); }
function fail(msg, hint) {
  console.log(`  ✗ ${msg}`);
  if (hint) {
    for (const line of hint.split('\n')) {
      console.log(`    ${line}`);
    }
  }
}

async function main() {
  // --help
  if (process.argv.includes('--help')) {
    console.log(readFileSync(new URL(import.meta.url), 'utf8').match(/\/\*\*([\s\S]*?)\*\//)[1].replace(/^ \* ?/gm, ''));
    process.exit(0);
  }

  console.log('\nClarion doctor\n');

  const config = loadConfig();
  let passed = 0;
  let failed = 0;

  function track(ok) { ok ? passed++ : failed++; }

  // 1. Config directory exists
  if (existsSync(CONFIG_DIR)) {
    pass('Config directory');
    track(true);
  } else {
    fail('Config directory missing', `Run: mkdir -p ${CONFIG_DIR}`);
    track(false);
  }

  // 2. Config file valid JSON with well-formed server URL
  if (existsSync(CONFIG_FILE)) {
    try {
      const cfg = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
      const url = cfg.server || config.server;
      new URL(url); // throws if invalid
      pass(`Config file valid (server: ${url})`);
      track(true);
    } catch (err) {
      fail('Config file invalid', `${CONFIG_FILE} has invalid JSON or server URL.\n    ${err.message}`);
      track(false);
    }
  } else {
    pass('Config file (using defaults)');
    track(true);
  }

  // 3. Server reachable
  let serverUp = false;
  let health = null;
  try {
    const headers = {};
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
    const res = await fetch(`${config.server}/health`, {
      headers,
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) {
      health = await res.json();
      serverUp = true;
      pass(`Server reachable (${config.server})`);
    } else {
      fail(`Server returned ${res.status}`, `Check server logs. URL: ${config.server}`);
    }
  } catch (err) {
    fail(`Server unreachable (${config.server})`, `Start with: npm run server:start  (from the Clarion directory)\n    Or check CLARION_SERVER env var / ${CONFIG_FILE}`);
  }
  track(serverUp);

  // 4. Backend health
  if (serverUp && health) {
    for (const backend of BACKENDS) {
      const status = health[backend];
      if (backend === 'edge') {
        // Edge is always available
        pass(`${backend} — ${status}`);
        track(true);
        continue;
      }
      if (status === 'up') {
        pass(`${backend} — up`);
        track(true);
      } else if (status === 'unconfigured') {
        // Not a failure — just informational
        pass(`${backend} — not configured (optional)`);
        track(true);
      } else {
        fail(`${backend} — ${status}`, BACKEND_HINTS[backend] || `Check ${backend} server configuration.`);
        track(false);
      }
    }
  } else {
    console.log('  - Skipping backend checks (server unreachable)');
  }

  // 5. At least one agent configured
  const agents = loadAgents();
  if (agents.length > 0) {
    pass(`${agents.length} agent${agents.length > 1 ? 's' : ''} configured`);
    track(true);
  } else {
    fail('No agents configured', 'Run: clarion-init');
    track(false);
  }

  // 6. Agent-backend alignment
  if (agents.length > 0 && serverUp && health) {
    let allAligned = true;
    for (const agent of agents) {
      const backendStatus = health[agent.backend];
      if (backendStatus !== 'up' && agent.backend !== 'edge') {
        if (backendStatus === 'unconfigured') continue; // skip unconfigured — user may not care
        fail(`Agent "${agent.id}" uses ${agent.backend} which is currently ${backendStatus}`,
          `Switch backend or fix ${agent.backend}. See above.`);
        allAligned = false;
        track(false);
      }
    }
    if (allAligned) {
      pass('All agents aligned with available backends');
      track(true);
    }
  }

  // 7. Audio player available
  const expectedPlayer = platform() === 'darwin' ? 'afplay' : 'mpv';
  const fallbackPlayers = ['mpv', 'ffplay', 'aplay'];
  let foundPlayer = null;
  try {
    execSync(`which ${expectedPlayer}`, { stdio: 'pipe' });
    foundPlayer = expectedPlayer;
  } catch {
    for (const p of fallbackPlayers) {
      try {
        execSync(`which ${p}`, { stdio: 'pipe' });
        foundPlayer = p;
        break;
      } catch {}
    }
  }
  if (foundPlayer) {
    pass(`Audio player: ${foundPlayer}`);
    track(true);
  } else {
    fail('No audio player found',
      platform() === 'darwin'
        ? 'afplay should be available on macOS. Check your PATH.'
        : 'Install mpv or ffplay: sudo apt install mpv');
    track(false);
  }

  // 8. Stale lock file
  if (existsSync(LOCK_FILE)) {
    try {
      const raw = readFileSync(LOCK_FILE, 'utf8').trim();
      const [pid, ts] = raw.split(':').map(Number);
      let alive = false;
      if (pid) {
        try { process.kill(pid, 0); alive = true; } catch {}
      }
      if (alive) {
        pass(`Lock file held by active process (pid ${pid})`);
        track(true);
      } else {
        fail('Stale lock file', `Process ${pid || '?'} is no longer running.\n    Remove: rm ${LOCK_FILE}`);
        track(false);
      }
    } catch {
      fail('Lock file unreadable', `Remove: rm ${LOCK_FILE}`);
      track(false);
    }
  } else {
    pass('No stale locks');
    track(true);
  }

  // 9. Sessions.json integrity
  if (existsSync(SESSIONS_FILE)) {
    try {
      const sessions = JSON.parse(readFileSync(SESSIONS_FILE, 'utf8'));
      const agentIds = new Set(agents.map(a => a.id));
      const orphaned = Object.entries(sessions).filter(([, aid]) => !agentIds.has(aid));
      if (orphaned.length > 0) {
        fail(`${orphaned.length} session(s) reference missing agents`,
          `Agents not found: ${[...new Set(orphaned.map(([, a]) => a))].join(', ')}\n    This is harmless but may cause voice routing issues.`);
        track(false);
      } else {
        pass('Sessions file valid');
        track(true);
      }
    } catch {
      fail('Sessions file invalid JSON', `Remove and re-create: rm ${SESSIONS_FILE}`);
      track(false);
    }
  } else {
    pass('Sessions file (none yet — OK)');
    track(true);
  }

  // 10. Docker containers (if docker-compose.yml present + Kokoro configured)
  const composeFile = join(process.cwd(), 'docker-compose.yml');
  const composeFileAlt = join(process.cwd(), 'docker-compose.yaml');
  const hasCompose = existsSync(composeFile) || existsSync(composeFileAlt);
  const kokoroConfigured = health && health.kokoro && health.kokoro !== 'unconfigured';

  if (hasCompose && kokoroConfigured) {
    try {
      const output = execSync('docker ps --format "{{.Names}}"', { stdio: 'pipe', timeout: 5000 }).toString();
      if (output.toLowerCase().includes('kokoro')) {
        pass('Docker: Kokoro container running');
        track(true);
      } else {
        fail('Docker: Kokoro container not found',
          'Start containers: docker-compose up -d');
        track(false);
      }
    } catch {
      fail('Docker not running or not installed',
        'Install Docker Desktop, then: docker-compose up -d');
      track(false);
    }
  } else if (hasCompose) {
    // Compose exists but Kokoro not configured — informational
    try {
      execSync('docker info', { stdio: 'pipe', timeout: 5000 });
      pass('Docker available (Kokoro not configured)');
      track(true);
    } catch {
      fail('Docker not running', 'Start Docker Desktop to use Kokoro.');
      track(false);
    }
  }

  // Summary
  console.log('');
  console.log(`  ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('  All checks passed.');
  }
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(`[clarion-doctor] ${err.message}`);
  process.exit(1);
});
