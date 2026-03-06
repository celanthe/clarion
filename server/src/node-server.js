/**
 * Node.js entry point for docker-compose deployment.
 * Wraps the Hono app with @hono/node-server.
 * For Cloudflare Worker deployment, use `wrangler deploy` instead.
 */

import { serve } from '@hono/node-server';
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

serve({
  fetch: patchedFetch,
  port
}, () => {
  console.log(`[clarion] Server running on http://localhost:${port}`);
  console.log(`[clarion] KOKORO_SERVER=${env.KOKORO_SERVER || 'not set'}`);
  console.log(`[clarion] PIPER_SERVER=${env.PIPER_SERVER || 'not set'}`);
});
