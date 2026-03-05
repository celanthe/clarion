/**
 * Clarion TTS Server
 * Hono-based router — runs as a Cloudflare Worker or Node server.
 *
 * Routes:
 *   GET  /health              → backend status (edge always up, kokoro/piper if configured)
 *   GET  /voices?backend=...  → voice list for a backend
 *   POST /speak               → synthesize speech, returns audio directly
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { synthesize as edgeSynthesize, getVoices as edgeVoices } from './edge.js';
import { synthesize as kokoroSynthesize, checkHealth as kokoroHealth, getVoices as kokoroVoices } from './kokoro.js';
import { synthesize as piperSynthesize, checkHealth as piperHealth, getVoices as piperVoices } from './piper.js';

const app = new Hono();

// CORS — defaults to open (*) for self-hosted use.
// Set ALLOWED_ORIGIN env var to restrict to a specific origin.
app.use('*', cors({
  origin: (origin, c) => {
    const allowed = c.env?.ALLOWED_ORIGIN;
    if (!allowed || allowed === '*') return '*';
    return origin === allowed ? origin : null;
  },
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  maxAge: 86400
}));

// --- Health ---

app.get('/', (c) => c.json({ service: 'clarion', status: 'ok' }));

app.get('/health', async (c) => {
  const kokoroServer = c.env?.KOKORO_SERVER;
  const piperServer = c.env?.PIPER_SERVER;

  const [kokoro, piper] = await Promise.all([
    kokoroHealth(kokoroServer),
    piperHealth(piperServer)
  ]);

  return c.json({
    edge: 'up',    // Edge TTS is always available (Microsoft-hosted, no config needed)
    kokoro,
    piper,
    timestamp: new Date().toISOString()
  });
});

// --- Voices ---

app.get('/voices', (c) => {
  const backend = c.req.query('backend') || 'edge';

  const voiceMap = {
    edge: edgeVoices,
    kokoro: kokoroVoices,
    piper: piperVoices
  };

  const fn = voiceMap[backend];
  if (!fn) {
    return c.json({ error: `Unknown backend: ${backend}. Use edge, kokoro, or piper.` }, 400);
  }

  return c.json({ backend, voices: fn() });
});

// --- Speak ---

/**
 * POST /speak
 * Body: { text, backend, voice, speed }
 *   text    — required, string, max 5000 chars
 *   backend — "edge" (default) | "kokoro" | "piper"
 *   voice   — backend-specific voice ID (uses backend default if omitted)
 *   speed   — number, default 1.0 (edge and kokoro only)
 *
 * Returns audio/mpeg (edge/kokoro) or audio/wav (piper) directly.
 */
app.post('/speak', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { text, backend = 'edge', voice, speed = 1.0 } = body;

  if (!text || typeof text !== 'string') {
    return c.json({ error: 'Missing or invalid text' }, 400);
  }

  if (text.length > 5000) {
    return c.json({ error: 'Text too long. Max 5000 characters.' }, 400);
  }

  console.log(`[speak] backend=${backend} voice=${voice || 'default'} len=${text.length}`);

  try {
    let audioResponse;

    switch (backend) {
      case 'edge':
        audioResponse = await edgeSynthesize(text, voice, speed);
        break;

      case 'kokoro':
        audioResponse = await kokoroSynthesize(text, voice, speed, c.env?.KOKORO_SERVER);
        break;

      case 'piper':
        audioResponse = await piperSynthesize(text, voice, c.env?.PIPER_SERVER);
        break;

      default:
        return c.json({ error: `Unknown backend: ${backend}` }, 400);
    }

    // Pass CORS header through
    audioResponse.headers.set('Access-Control-Allow-Origin', '*');
    return audioResponse;

  } catch (err) {
    console.error(`[speak] ${backend} error: ${err.message}`);

    const status = err.message.includes('not configured') ? 503 :
                   err.message.includes('unreachable') ? 503 : 500;

    return c.json({ error: err.message }, status);
  }
});

export default app;
