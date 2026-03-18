#!/usr/bin/env node
/**
 * Unit tests for fleet-safe session routing logic in clarion-watch.
 *
 * Tests:
 *   1. registerSession() writes to sessions.json correctly
 *   2. unregisterSession() removes the entry
 *   3. loadSessions() returns {} when file doesn't exist
 *   4. latestJsonl() skips sessions claimed by OTHER agents
 *   5. latestJsonl() does NOT skip sessions claimed by the SAME agent
 *   6. latestJsonl() picks the most recent unclaimed JSONL by mtime
 *
 * Usage:
 *   node test/session-routing.js
 *
 * No external dependencies — vanilla Node.js assertions with temp directories.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, utimesSync, existsSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

let passed = 0;
let failed = 0;

function assert(label, got, expected) {
  if (got === expected) {
    console.log(`  \u2713 ${label}`);
    passed++;
  } else {
    console.error(`  \u2717 ${label} \u2014 expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`);
    failed++;
  }
}

function assertDeep(label, got, expected) {
  const gotStr = JSON.stringify(got);
  const expectedStr = JSON.stringify(expected);
  if (gotStr === expectedStr) {
    console.log(`  \u2713 ${label}`);
    passed++;
  } else {
    console.error(`  \u2717 ${label} \u2014 expected ${expectedStr}, got ${gotStr}`);
    failed++;
  }
}

// --- Re-implemented session routing functions with configurable paths ---
// Mirrors the logic in cli/watch.js but accepts a sessionsFile parameter
// so tests can use isolated temp directories.

import { readdirSync, statSync } from 'fs';

function loadSessions(sessionsFile) {
  try { return JSON.parse(readFileSync(sessionsFile, 'utf8')); } catch { return {}; }
}

function registerSession(sessionId, agentId, sessionsFile) {
  const sessions = loadSessions(sessionsFile);
  sessions[sessionId] = agentId;
  writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2) + '\n');
}

function unregisterSession(sessionId, sessionsFile) {
  const sessions = loadSessions(sessionsFile);
  delete sessions[sessionId];
  writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2) + '\n');
}

function latestJsonl(dir, ownAgentId, currentSessionFile, sessionsFile) {
  if (!existsSync(dir)) return null;

  // Load sessions claimed by OTHER agents — skip those files
  const claimed = new Set();
  const sessions = loadSessions(sessionsFile);
  for (const [sessionId, claimedAgent] of Object.entries(sessions)) {
    if (claimedAgent !== ownAgentId) claimed.add(sessionId);
  }

  let best = null;
  let bestMtime = 0;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.jsonl')) continue;
    const sessionId = name.slice(0, -6); // strip .jsonl

    // Allow our own current session, skip sessions claimed by others
    const full = join(dir, name);
    if (claimed.has(sessionId) && full !== currentSessionFile) continue;

    try {
      const mtime = statSync(full).mtimeMs;
      if (mtime > bestMtime) { bestMtime = mtime; best = full; }
    } catch {}
  }
  return best;
}

// --- Temp directory helpers ---

function tmpDir() {
  const id = randomBytes(8).toString('hex');
  const dir = join('/tmp', `clarion-test-session-${id}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir) {
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
}

// --- Tests ---

function testRegisterSession() {
  console.log('\n1. registerSession() writes to sessions.json correctly');
  const dir = tmpDir();
  const sessionsFile = join(dir, 'sessions.json');

  registerSession('sess-aaa', 'agent-1', sessionsFile);
  const data = JSON.parse(readFileSync(sessionsFile, 'utf8'));
  assertDeep('one session registered', data, { 'sess-aaa': 'agent-1' });

  // Register a second session
  registerSession('sess-bbb', 'agent-2', sessionsFile);
  const data2 = JSON.parse(readFileSync(sessionsFile, 'utf8'));
  assertDeep('two sessions registered', data2, { 'sess-aaa': 'agent-1', 'sess-bbb': 'agent-2' });

  // Overwrite existing session with new agent
  registerSession('sess-aaa', 'agent-3', sessionsFile);
  const data3 = JSON.parse(readFileSync(sessionsFile, 'utf8'));
  assert('overwritten agent', data3['sess-aaa'], 'agent-3');

  cleanup(dir);
}

function testUnregisterSession() {
  console.log('\n2. unregisterSession() removes the entry');
  const dir = tmpDir();
  const sessionsFile = join(dir, 'sessions.json');

  registerSession('sess-aaa', 'agent-1', sessionsFile);
  registerSession('sess-bbb', 'agent-2', sessionsFile);
  unregisterSession('sess-aaa', sessionsFile);

  const data = JSON.parse(readFileSync(sessionsFile, 'utf8'));
  assert('removed session absent', data['sess-aaa'], undefined);
  assert('other session intact', data['sess-bbb'], 'agent-2');

  // Unregistering non-existent session does not error
  unregisterSession('sess-zzz', sessionsFile);
  const data2 = JSON.parse(readFileSync(sessionsFile, 'utf8'));
  assert('unregister non-existent is no-op', Object.keys(data2).length, 1);

  cleanup(dir);
}

function testLoadSessionsMissingFile() {
  console.log('\n3. loadSessions() returns {} when file does not exist');
  const dir = tmpDir();
  const sessionsFile = join(dir, 'nonexistent.json');

  const result = loadSessions(sessionsFile);
  assertDeep('empty object', result, {});

  cleanup(dir);
}

function testLatestJsonlSkipsOtherAgent() {
  console.log('\n4. latestJsonl() skips sessions claimed by OTHER agents');
  const dir = tmpDir();
  const projDir = join(dir, 'project');
  const sessionsFile = join(dir, 'sessions.json');
  mkdirSync(projDir, { recursive: true });

  // Create two JSONL files
  const fileA = join(projDir, 'sess-aaa.jsonl');
  const fileB = join(projDir, 'sess-bbb.jsonl');
  writeFileSync(fileA, '{"uuid":"1"}\n');
  writeFileSync(fileB, '{"uuid":"2"}\n');

  // Make fileA newer
  const now = new Date();
  const past = new Date(now.getTime() - 10000);
  utimesSync(fileB, past, past);
  utimesSync(fileA, now, now);

  // Claim fileA for a different agent
  registerSession('sess-aaa', 'other-agent', sessionsFile);

  // Our agent should skip fileA and pick fileB
  const result = latestJsonl(projDir, 'my-agent', null, sessionsFile);
  assert('picks unclaimed file', result, fileB);

  cleanup(dir);
}

function testLatestJsonlAllowsSameAgent() {
  console.log('\n5. latestJsonl() does NOT skip sessions claimed by the SAME agent');
  const dir = tmpDir();
  const projDir = join(dir, 'project');
  const sessionsFile = join(dir, 'sessions.json');
  mkdirSync(projDir, { recursive: true });

  // Create two JSONL files
  const fileA = join(projDir, 'sess-aaa.jsonl');
  const fileB = join(projDir, 'sess-bbb.jsonl');
  writeFileSync(fileA, '{"uuid":"1"}\n');
  writeFileSync(fileB, '{"uuid":"2"}\n');

  // Make fileA newer
  const now = new Date();
  const past = new Date(now.getTime() - 10000);
  utimesSync(fileB, past, past);
  utimesSync(fileA, now, now);

  // Claim fileA for our OWN agent
  registerSession('sess-aaa', 'my-agent', sessionsFile);

  // Our agent should still see fileA (same agent claim is not skipped)
  const result = latestJsonl(projDir, 'my-agent', null, sessionsFile);
  assert('picks own-agent file', result, fileA);

  cleanup(dir);
}

function testLatestJsonlPicksMostRecent() {
  console.log('\n6. latestJsonl() picks the most recent unclaimed JSONL by mtime');
  const dir = tmpDir();
  const projDir = join(dir, 'project');
  const sessionsFile = join(dir, 'sessions.json');
  mkdirSync(projDir, { recursive: true });

  // Create three JSONL files with different mtimes
  const fileA = join(projDir, 'sess-aaa.jsonl');
  const fileB = join(projDir, 'sess-bbb.jsonl');
  const fileC = join(projDir, 'sess-ccc.jsonl');
  writeFileSync(fileA, '{"uuid":"1"}\n');
  writeFileSync(fileB, '{"uuid":"2"}\n');
  writeFileSync(fileC, '{"uuid":"3"}\n');

  const now = new Date();
  utimesSync(fileA, new Date(now.getTime() - 20000), new Date(now.getTime() - 20000));
  utimesSync(fileB, new Date(now.getTime() - 5000), new Date(now.getTime() - 5000));
  utimesSync(fileC, new Date(now.getTime() - 10000), new Date(now.getTime() - 10000));

  // No claims — should pick fileB (most recent)
  const result = latestJsonl(projDir, 'my-agent', null, sessionsFile);
  assert('picks most recent', result, fileB);

  // Now claim fileB for another agent — should fall back to fileC
  registerSession('sess-bbb', 'other-agent', sessionsFile);
  const result2 = latestJsonl(projDir, 'my-agent', null, sessionsFile);
  assert('falls back to next most recent', result2, fileC);

  cleanup(dir);
}

function testLatestJsonlNonexistentDir() {
  console.log('\n7. latestJsonl() returns null for non-existent directory');
  const dir = tmpDir();
  const sessionsFile = join(dir, 'sessions.json');

  const result = latestJsonl(join(dir, 'no-such-dir'), 'my-agent', null, sessionsFile);
  assert('returns null', result, null);

  cleanup(dir);
}

function testLatestJsonlIgnoresNonJsonl() {
  console.log('\n8. latestJsonl() ignores non-.jsonl files');
  const dir = tmpDir();
  const projDir = join(dir, 'project');
  const sessionsFile = join(dir, 'sessions.json');
  mkdirSync(projDir, { recursive: true });

  // Create a non-JSONL file and one JSONL file
  writeFileSync(join(projDir, 'notes.txt'), 'not a session\n');
  writeFileSync(join(projDir, 'readme.md'), '# hi\n');
  const jsonlFile = join(projDir, 'sess-aaa.jsonl');
  writeFileSync(jsonlFile, '{"uuid":"1"}\n');

  const result = latestJsonl(projDir, 'my-agent', null, sessionsFile);
  assert('picks only .jsonl file', result, jsonlFile);

  cleanup(dir);
}

// --- Main ---

function main() {
  console.log('Clarion session routing test suite');
  console.log('Testing fleet-safe session routing logic from cli/watch.js\n');

  testRegisterSession();
  testUnregisterSession();
  testLoadSessionsMissingFile();
  testLatestJsonlSkipsOtherAgent();
  testLatestJsonlAllowsSameAgent();
  testLatestJsonlPicksMostRecent();
  testLatestJsonlNonexistentDir();
  testLatestJsonlIgnoresNonJsonl();

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
