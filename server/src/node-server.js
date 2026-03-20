/**
 * Node.js entry point for docker-compose deployment and Electron-managed startup.
 * Wraps the Hono app with @hono/node-server.
 * For Cloudflare Worker deployment, use `wrangler deploy` instead.
 *
 * Readiness signal: prints a JSON line to stdout when the server is listening:
 *   {"status":"ready","port":8080}
 * Parent processes (Electron, scripts) can parse this to know the server is up.
 *
 * Required env vars for paid backends:
 *   ELEVENLABS_API_KEY, GOOGLE_TTS_API_KEY, KOKORO_SERVER, PIPER_SERVER
 */

import { serve } from '@hono/node-server';
import { createServer } from 'net';
import app from './index.js';

const port = parseInt(process.env.PORT || '8080', 10);

// Inject env vars as a fake CF env object — must include all vars that Hono
// middleware reads from c.env, otherwise auth/CORS are silently disabled.
const env = {
  KOKORO_SERVER:      process.env.KOKORO_SERVER,
  PIPER_SERVER:       process.env.PIPER_SERVER,
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
  GOOGLE_TTS_API_KEY: process.env.GOOGLE_TTS_API_KEY,
  API_KEY:            process.env.API_KEY,
  ALLOWED_ORIGIN:     process.env.ALLOWED_ORIGIN,
  RATE_LIMIT:         process.env.RATE_LIMIT,
};

// Patch the app to inject env from process.env in Node mode
const originalFetch = app.fetch.bind(app);
const patchedFetch = (request, e) => originalFetch(request, { ...env, ...(e || {}) });

// --- Port conflict detection ---
function checkPort(p) {
  return new Promise((resolve) => {
    const tester = createServer()
      .once('error', (err) => {
        if (err.code === 'EADDRINUSE') resolve(false);
        else resolve(true);
      })
      .once('listening', () => {
        tester.close(() => resolve(true));
      })
      .listen(p);
  });
}

// --- Graceful shutdown ---
let server = null;

function shutdown(signal) {
  console.log(`[clarion] ${signal} received, shutting down`);
  if (server) {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 3000);
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('disconnect', () => shutdown('disconnect'));

// --- Start ---
async function start() {
  const available = await checkPort(port);
  if (!available) {
    console.error(`[clarion] Error: port ${port} is already in use`);
    console.error(`[clarion] Another Clarion server or service may be running on this port.`);
    console.error(`[clarion] Set PORT=<number> to use a different port.`);
    process.exit(1);
  }

  server = serve({
    fetch: patchedFetch,
    port
  }, () => {
    // Structured readiness signal for parent process (Electron)
    console.log(JSON.stringify({ status: 'ready', port }));
    console.error(`[clarion] Server running on http://localhost:${port}`);
    console.error(`[clarion] KOKORO_SERVER=${env.KOKORO_SERVER || 'not set'}`);
    console.error(`[clarion] PIPER_SERVER=${env.PIPER_SERVER || 'not set'}`);
  });
}

start().catch(err => {
  console.error(`[clarion] Failed to start: ${err.message}`);
  process.exit(1);
});
