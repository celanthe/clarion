#!/usr/bin/env node
/**
 * End-to-end test for Clarion HMAC request signing.
 *
 * Tests:
 *   1. No API_KEY set → requests pass without auth
 *   2. Correct HMAC signature → 200
 *   3. Wrong signature → 401
 *   4. Expired timestamp → 401
 *   5. Bearer fallback → 200 (CLI compat)
 *   6. Bearer wrong key → 401
 *   7. /speak with valid HMAC → audio response
 *
 * Usage:
 *   node test/hmac-auth.js [server-url]
 *   node test/hmac-auth.js http://localhost:8080
 */

import { createHmac } from 'crypto';

const SERVER = process.argv[2] || 'http://localhost:8080';
const TEST_KEY = 'clarion-test-key-do-not-use-in-prod';

let passed = 0;
let failed = 0;

function toBase64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function sign(key, method, path, ts) {
  const toSign = `${method}\n${path}\n${ts}`;
  const sig = createHmac('sha256', key).update(toSign).digest();
  return `Clarion ts=${ts},sig=${toBase64url(sig)}`;
}

async function req(method, path, { auth, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers['Authorization'] = auth;
  const res = await fetch(`${SERVER}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

function assert(label, got, expected) {
  if (got === expected) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label} — expected ${expected}, got ${got}`);
    failed++;
  }
}

// --- Tests ---

async function testNoKey() {
  console.log('\n1. No API_KEY set — open access');
  console.log('   (skip if server has API_KEY configured — run without it for this test)');
  const res = await req('GET', '/health');
  // Just check server is reachable
  assert('server reachable', res.status < 500, true);
}

async function testValidHmac(key) {
  console.log('\n2. Valid HMAC signature → 200');
  const ts = Math.floor(Date.now() / 1000).toString();
  const auth = sign(key, 'GET', '/health', ts);
  const res = await req('GET', '/health', { auth });
  assert('status 200', res.status, 200);
}

async function testWrongSig(key) {
  console.log('\n3. Wrong signature → 401');
  const ts = Math.floor(Date.now() / 1000).toString();
  const auth = sign(key + 'WRONG', 'GET', '/health', ts);
  const res = await req('GET', '/health', { auth });
  assert('status 401', res.status, 401);
}

async function testExpiredTimestamp(key) {
  console.log('\n4. Expired timestamp (6 min ago) → 401');
  const ts = (Math.floor(Date.now() / 1000) - 360).toString();
  const auth = sign(key, 'GET', '/health', ts);
  const res = await req('GET', '/health', { auth });
  assert('status 401', res.status, 401);
}

async function testFutureTimestamp(key) {
  console.log('\n5. Future timestamp (6 min ahead) → 401');
  const ts = (Math.floor(Date.now() / 1000) + 360).toString();
  const auth = sign(key, 'GET', '/health', ts);
  const res = await req('GET', '/health', { auth });
  assert('status 401', res.status, 401);
}

async function testBearerValid(key) {
  console.log('\n6. Bearer fallback (CLI compat) → 200');
  const res = await req('GET', '/health', { auth: `Bearer ${key}` });
  assert('status 200', res.status, 200);
}

async function testBearerWrong(key) {
  console.log('\n7. Bearer wrong key → 401');
  const res = await req('GET', '/health', { auth: `Bearer wrongkey` });
  assert('status 401', res.status, 401);
}

async function testSpeakHmac(key) {
  console.log('\n8. POST /speak with valid HMAC → audio');
  const ts = Math.floor(Date.now() / 1000).toString();
  const auth = sign(key, 'POST', '/speak', ts);
  const res = await req('POST', '/speak', {
    auth,
    body: { text: 'Hello.', backend: 'edge', voice: 'en-US-JennyNeural', speed: 1.0 }
  });
  assert('status 200', res.status, 200);
  const ct = res.headers.get('content-type') || '';
  assert('audio response', ct.startsWith('audio/'), true);
}

async function testSpeakNoAuth() {
  console.log('\n9. POST /speak without auth (API_KEY set) → 401');
  const res = await req('POST', '/speak', {
    body: { text: 'Hello.', backend: 'edge' }
  });
  assert('status 401', res.status, 401);
}

async function testInputValidation(key) {
  console.log('\n10. Input validation');

  const ts = () => Math.floor(Date.now() / 1000).toString();

  // Text too long
  const longTs = ts();
  const longAuth = sign(key, 'POST', '/speak', longTs);
  const r1 = await req('POST', '/speak', {
    auth: longAuth,
    body: { text: 'x'.repeat(5001), backend: 'edge' }
  });
  assert('text >5000 chars → 400', r1.status, 400);

  // Unknown backend
  const badTs = ts();
  const badAuth = sign(key, 'POST', '/speak', badTs);
  const r2 = await req('POST', '/speak', {
    auth: badAuth,
    body: { text: 'Hello.', backend: 'notabackend' }
  });
  assert('unknown backend → 400', r2.status, 400);

  // Voice injection attempt (special chars stripped)
  const injTs = ts();
  const injAuth = sign(key, 'POST', '/speak', injTs);
  const r3 = await req('POST', '/speak', {
    auth: injAuth,
    body: { text: 'Hello.', backend: 'edge', voice: '<script>alert(1)</script>' }
  });
  // Should either 400 (unknown voice after stripping) or 200 if default kicks in
  assert('voice injection → not 5xx', r3.status < 500, true);
}

// --- Main ---

async function main() {
  console.log(`Clarion HMAC auth test suite`);
  console.log(`Server: ${SERVER}`);
  console.log(`Test key: ${TEST_KEY}`);
  console.log(`\nNOTE: Server must be running with API_KEY=${TEST_KEY}`);
  console.log(`      cd server && API_KEY=${TEST_KEY} npm start`);

  // Check server is up
  try {
    await fetch(`${SERVER}/health`);
  } catch {
    console.error(`\nCannot reach ${SERVER} — is the server running?`);
    process.exit(1);
  }

  await testNoKey();
  await testValidHmac(TEST_KEY);
  await testWrongSig(TEST_KEY);
  await testExpiredTimestamp(TEST_KEY);
  await testFutureTimestamp(TEST_KEY);
  await testBearerValid(TEST_KEY);
  await testBearerWrong(TEST_KEY);
  await testSpeakHmac(TEST_KEY);
  await testSpeakNoAuth();
  await testInputValidation(TEST_KEY);

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
