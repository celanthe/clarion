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

// Constant-time string comparison — prevents timing side-channel on token verification.
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function toBase64url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Verify a Clarion HMAC-SHA256 signature.
 * Header format: "Clarion ts=<unix>,sig=<base64url>"
 * Signed payload: "METHOD\n/path\ntimestamp"
 * Rejects signatures older than 5 minutes (replay protection).
 */
async function verifyClarionSig(apiKey, authHeader, method, url) {
  const match = authHeader.match(/^Clarion ts=(\d+),sig=([A-Za-z0-9_-]+)$/);
  if (!match) return false;

  const ts  = parseInt(match[1], 10);
  const sig = match[2];

  // Reject stale or future-dated requests (±5 min clock skew tolerance)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) return false;

  const path    = new URL(url).pathname;
  const toSign  = `${method}\n${path}\n${ts}`;
  const enc     = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(apiKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const expected    = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(toSign));
  const expectedSig = toBase64url(new Uint8Array(expected));

  return timingSafeEqual(sig, expectedSig);
}

import { synthesize as edgeSynthesize, getVoices as edgeVoices } from './edge.js';
import { synthesize as kokoroSynthesize, checkHealth as kokoroHealth, getVoices as kokoroVoices } from './kokoro.js';
import { synthesize as piperSynthesize, checkHealth as piperHealth, getVoices as piperVoices } from './piper.js';
import { synthesize as elevenlabsSynthesize, checkHealth as elevenlabsHealth, getVoices as elevenlabsVoices } from './elevenlabs.js';
import { synthesize as googleSynthesize, checkHealth as googleHealth, getVoices as googleVoices } from './google.js';
import { synthesize as chatterboxSynthesize, checkHealth as chatterboxHealth, getVoices as chatterboxVoices } from './chatterbox.js';

// Valid backend IDs
const VALID_BACKENDS = new Set(['edge', 'kokoro', 'piper', 'elevenlabs', 'google', 'chatterbox']);

// Rate limiting — opt-in via RATE_LIMIT env var (max requests per minute per IP).
// Set RATE_LIMIT=20 to allow 20 /speak requests per minute per IP.
// Default is 0 (no limit) — it's your server.
// NOTE: This in-memory rate limiter only works in Node/long-lived process mode.
// On Cloudflare Workers, each request gets a fresh isolate — use CF's built-in
// rate limiting or Durable Objects for Worker deployments.
const _rateBuckets = new Map();

function checkRateLimit(ip, maxPerMinute) {
  if (!maxPerMinute) return true;
  const now = Date.now();
  let timestamps = _rateBuckets.get(ip) || [];
  timestamps = timestamps.filter(t => now - t < 60000);
  if (timestamps.length >= maxPerMinute) return false;
  timestamps.push(now);
  _rateBuckets.set(ip, timestamps);
  // Prune stale IPs to prevent unbounded memory growth
  if (_rateBuckets.size > 10000) {
    for (const [k, v] of _rateBuckets) {
      if (v.every(t => now - t >= 60000)) _rateBuckets.delete(k);
    }
  }
  return true;
}

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
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}));

// Optional API key auth — set API_KEY env var to enable.
// Browser UI sends HMAC-SHA256 signatures (raw key never transmitted).
// CLI and other non-browser clients may use Bearer <key> as a fallback.
app.use('*', async (c, next) => {
  if (c.req.method === 'OPTIONS') return next();
  const apiKey = c.env?.API_KEY;
  if (!apiKey) return next();

  const auth = c.req.header('Authorization') || '';
  let authed = false;

  if (auth.startsWith('Clarion ')) {
    authed = await verifyClarionSig(apiKey, auth, c.req.method, c.req.url);
  } else {
    // Bearer fallback — CLI and scripts. Still timing-safe.
    authed = timingSafeEqual(auth, `Bearer ${apiKey}`);
  }

  if (!authed) return c.json({ error: 'Unauthorized' }, 401);
  return next();
});

// --- Health ---

app.get('/', (c) => c.json({ service: 'clarion', status: 'ok' }));

app.get('/health', async (c) => {
  const kokoroServer = c.env?.KOKORO_SERVER;
  const piperServer  = c.env?.PIPER_SERVER;
  const elevenKey    = c.env?.ELEVENLABS_API_KEY;
  const googleKey    = c.env?.GOOGLE_TTS_API_KEY;

  // Warn if paid backends are configured without rate limiting — cost attack surface.
  const rateLimit = parseInt(c.env?.RATE_LIMIT || '0', 10);
  if (!rateLimit && (elevenKey || googleKey)) {
    console.warn('[clarion] WARNING: Paid backend configured (ElevenLabs/Google) with RATE_LIMIT=0. Set RATE_LIMIT to cap requests per minute per IP.');
  }

  const chatterboxServer = c.env?.CHATTERBOX_SERVER;

  const [kokoro, piper, elevenlabs, google, chatterbox] = await Promise.all([
    kokoroHealth(kokoroServer),
    piperHealth(piperServer),
    elevenlabsHealth(elevenKey),
    googleHealth(googleKey),
    chatterboxHealth(chatterboxServer)
  ]);

  return c.json({
    edge: 'up',    // Edge TTS is always available (Microsoft-hosted, no config needed)
    kokoro,
    piper,
    elevenlabs,
    google,
    chatterbox,
    timestamp: new Date().toISOString()
  });
});

// --- Diagnostics ---

app.get('/diagnostics', async (c) => {
  const kokoroServer = c.env?.KOKORO_SERVER;
  const piperServer  = c.env?.PIPER_SERVER;
  const elevenKey    = c.env?.ELEVENLABS_API_KEY;
  const googleKey    = c.env?.GOOGLE_TTS_API_KEY;
  const chatterboxServer = c.env?.CHATTERBOX_SERVER;

  const [kokoro, piper, elevenlabs, google, chatterbox] = await Promise.all([
    kokoroHealth(kokoroServer),
    piperHealth(piperServer),
    elevenlabsHealth(elevenKey),
    googleHealth(googleKey),
    chatterboxHealth(chatterboxServer)
  ]);

  return c.json({
    server: { version: '0.7.0' },
    backends: {
      edge: { status: 'up', configured: true, detail: 'Microsoft Translator API — always available' },
      kokoro: {
        status: kokoro,
        configured: !!kokoroServer,
        detail: kokoro === 'up' ? 'Connected' :
                kokoro === 'unconfigured' ? 'Set KOKORO_SERVER env var' :
                'Connection refused'
      },
      piper: {
        status: piper,
        configured: !!piperServer,
        detail: piper === 'up' ? 'Connected' :
                piper === 'unconfigured' ? 'Set PIPER_SERVER env var' :
                'Connection refused'
      },
      elevenlabs: {
        status: elevenlabs,
        configured: !!elevenKey,
        detail: elevenlabs === 'up' ? 'API key valid' :
                elevenlabs === 'unconfigured' ? 'Set ELEVENLABS_API_KEY env var' :
                'API key invalid or expired'
      },
      google: {
        status: google,
        configured: !!googleKey,
        detail: google === 'up' ? 'API key valid' :
                google === 'unconfigured' ? 'Set GOOGLE_TTS_API_KEY env var' :
                'API key invalid or expired'
      },
      chatterbox: {
        status: chatterbox,
        configured: !!chatterboxServer,
        detail: chatterbox === 'up' ? 'Connected' :
                chatterbox === 'unconfigured' ? 'Set CHATTERBOX_SERVER env var' :
                'Connection refused'
      }
    }
  });
});

// --- Voices ---

app.get('/voices', async (c) => {
  const backend = c.req.query('backend') || 'edge';

  const voiceMap = {
    edge: edgeVoices,
    kokoro: kokoroVoices,
    piper: piperVoices,
    google: googleVoices
  };

  if (!voiceMap[backend] && backend !== 'elevenlabs' && backend !== 'chatterbox') {
    return c.json({ error: `Unknown backend: ${backend}. Use edge, kokoro, piper, elevenlabs, google, or chatterbox.` }, 400);
  }

  let voices;
  if (backend === 'elevenlabs') {
    voices = await elevenlabsVoices(c.env?.ELEVENLABS_API_KEY);
  } else if (backend === 'chatterbox') {
    voices = await chatterboxVoices(c.env?.CHATTERBOX_SERVER);
  } else {
    voices = voiceMap[backend]();
  }

  return c.json({ backend, voices });
});

// --- Speak ---

/**
 * POST /speak
 * Body: { text, backend, voice, speed }
 *   text    — required, string, max 5000 chars
 *   backend — "edge" (default) | "kokoro" | "piper" | "elevenlabs" | "google"
 *   voice   — backend-specific voice ID (uses backend default if omitted)
 *   speed   — number, default 1.0 (not supported by piper)
 *
 * Returns audio/mpeg (edge/kokoro) or audio/wav (piper) directly.
 */
app.post('/speak', async (c) => {
  // Reject oversized bodies before parsing (prevents memory exhaustion)
  const contentLength = parseInt(c.req.header('content-length') || '0', 10);
  if (contentLength > 50000) {
    return c.json({ error: 'Request too large' }, 413);
  }

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

  // Rate limiting (opt-in)
  const rateLimit = parseInt(c.env?.RATE_LIMIT || '0', 10);
  if (rateLimit > 0) {
    const ip = c.req.header('CF-Connecting-IP')
      || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim()
      || 'unknown';
    if (!checkRateLimit(ip, rateLimit)) {
      return c.json({ error: 'Rate limit exceeded. Try again in a minute.' }, 429);
    }
  }

  // Whitelist backends before anything else
  if (!VALID_BACKENDS.has(backend)) {
    return c.json({ error: `Unknown backend: ${backend}` }, 400);
  }

  // Clamp speed to a safe finite range
  const safeSpeed = (typeof speed === 'number' && isFinite(speed))
    ? Math.max(0.25, Math.min(4.0, speed))
    : 1.0;

  // Sanitize voice ID — only alphanumeric, hyphen, underscore allowed.
  // Edge validates against its own whitelist; this prevents junk reaching
  // Kokoro/Piper regardless.
  const safeVoice = (typeof voice === 'string')
    ? voice.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100) || undefined
    : undefined;

  console.log(`[speak] backend=${backend} voice=${safeVoice || 'default'} len=${text.length}`);

  try {
    let audioResponse;

    switch (backend) {
      case 'edge':
        audioResponse = await edgeSynthesize(text, safeVoice, safeSpeed, c.env);
        break;

      case 'kokoro':
        audioResponse = await kokoroSynthesize(text, safeVoice, safeSpeed, c.env?.KOKORO_SERVER);
        break;

      case 'piper':
        audioResponse = await piperSynthesize(text, safeVoice, c.env?.PIPER_SERVER);
        break;

      case 'elevenlabs':
        audioResponse = await elevenlabsSynthesize(text, safeVoice, c.env?.ELEVENLABS_API_KEY, safeSpeed);
        break;

      case 'google':
        audioResponse = await googleSynthesize(text, safeVoice, safeSpeed, c.env?.GOOGLE_TTS_API_KEY);
        break;

      case 'chatterbox':
        audioResponse = await chatterboxSynthesize(text, safeVoice, safeSpeed, c.env?.CHATTERBOX_SERVER);
        break;
    }

    // Respect ALLOWED_ORIGIN on audio responses — don't hardcode '*'.
    const allowedOrigin = c.env?.ALLOWED_ORIGIN;
    audioResponse.headers.set(
      'Access-Control-Allow-Origin',
      allowedOrigin && allowedOrigin !== '*' ? allowedOrigin : '*'
    );
    return audioResponse;

  } catch (err) {
    console.error(`[speak] ${backend} error: ${err.message}`);

    const status = err.message.includes('not configured') ? 503 :
                   err.message.includes('unreachable') ? 503 :
                   err.message.includes('Unknown') ? 400 : 500;

    // Auto-fallback to Edge TTS when a backend is unavailable (503)
    if (status === 503 && backend !== 'edge') {
      console.log(`[speak] ${backend} failed, falling back to edge`);
      try {
        const fallbackResponse = await edgeSynthesize(text, 'en-US-JennyNeural', safeSpeed, c.env);
        const allowedOrigin = c.env?.ALLOWED_ORIGIN;
        // Copy headers from the edge response and add fallback indicator
        for (const [k, v] of fallbackResponse.headers) {
          c.header(k, v);
        }
        c.header('X-Clarion-Fallback', 'edge');
        c.header('Access-Control-Allow-Origin',
          allowedOrigin && allowedOrigin !== '*' ? allowedOrigin : '*');
        return c.body(fallbackResponse.body, 200);
      } catch (fallbackErr) {
        console.error(`[speak] Edge fallback also failed: ${fallbackErr.message}`);
      }
    }

    return c.json({ error: `${backend} synthesis failed` }, status);
  }
});

export default app;
