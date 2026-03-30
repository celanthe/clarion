/**
 * Chatterbox TTS adapter.
 * Connects to a self-hosted Chatterbox API (travisvn/chatterbox-tts-api).
 * Uses the OpenAI-compatible /v1/audio/speech endpoint — same pattern as Kokoro.
 *
 * Key differences from Kokoro:
 *   - No pre-built voices — all voices are cloned from reference audio
 *   - Extra params: exaggeration, cfg_weight, temperature
 *   - Returns WAV by default; we request MP3 for consistency with other backends
 *   - Voice list is dynamic (fetched from server, not hardcoded)
 */

/**
 * Synthesize speech using a self-hosted Chatterbox server.
 * @param {string} text
 * @param {string} voice - registered voice name (e.g. "arynna")
 * @param {number} speed - multiplier, 1.0 = normal
 * @param {string} serverUrl - CHATTERBOX_SERVER env var value
 * @returns {Response} audio/mpeg
 */
function validateServerUrl(url) {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Invalid server URL protocol: ${parsed.protocol}`);
  }
  return url;
}

export async function synthesize(text, voice, speed = 1.0, serverUrl) {
  if (!serverUrl) {
    throw new Error('Chatterbox server not configured. Set CHATTERBOX_SERVER in your environment.');
  }
  validateServerUrl(serverUrl);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // GPU inference, generous timeout

  let res;
  try {
    res = await fetch(`${serverUrl}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: text,
        voice: voice || 'default',
        speed: speed || 1.0,
        response_format: 'mp3'
      }),
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timeoutId);
    throw new Error(`Chatterbox server unreachable: ${err.message}`);
  }

  clearTimeout(timeoutId);

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Chatterbox server error ${res.status}: ${errText}`);
  }

  // Chatterbox may return audio/wav even if we asked for mp3.
  // Pass through whatever content type the server sends.
  const contentType = res.headers.get('content-type') || 'audio/mpeg';

  return new Response(res.body, {
    headers: {
      'Content-Type': contentType,
      'X-Backend': 'chatterbox'
    }
  });
}

/**
 * Check if the Chatterbox server is reachable.
 * @param {string} serverUrl
 * @returns {'up' | 'down' | 'unconfigured'}
 */
export async function checkHealth(serverUrl) {
  if (!serverUrl) return 'unconfigured';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${serverUrl}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    return res.ok ? 'up' : 'down';
  } catch {
    return 'down';
  }
}

/**
 * Return the list of registered Chatterbox voices.
 * Unlike Kokoro/Edge (static lists), Chatterbox voices are user-uploaded.
 * Fetches dynamically from the server.
 * @param {string} serverUrl
 * @returns {Array<{id: string, label: string, lang: string, gender: string}>}
 */
export async function getVoices(serverUrl) {
  if (!serverUrl) return [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${serverUrl}/voices`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) return [];

    const data = await res.json();

    // The API returns voice names as an array or object — normalize to Clarion format.
    // travisvn/chatterbox-tts-api returns { voices: ["name1", "name2", ...] } or similar.
    if (Array.isArray(data)) {
      return data.map(v => ({
        id: typeof v === 'string' ? v : v.name || v.id,
        label: typeof v === 'string' ? v : v.name || v.id,
        lang: 'en',
        gender: ''
      }));
    }

    if (data.voices && Array.isArray(data.voices)) {
      return data.voices.map(v => ({
        id: typeof v === 'string' ? v : v.name || v.id,
        label: typeof v === 'string' ? v : v.name || v.id,
        lang: 'en',
        gender: ''
      }));
    }

    return [];
  } catch {
    return [];
  }
}
