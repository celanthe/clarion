/**
 * Kokoro TTS proxy.
 * Simplified from Everbloom — no RunPod GPU, no KV cache, no daily budget limits.
 * Points at your self-hosted Kokoro server (e.g. from docker-compose).
 * Uses the OpenAI-compatible /v1/audio/speech endpoint for direct audio/mpeg output.
 */

/**
 * Synthesize speech using a self-hosted Kokoro server.
 * @param {string} text
 * @param {string} voice - e.g. "bm_george"
 * @param {number} speed - multiplier, 1.0 = normal
 * @param {string} serverUrl - KOKORO_SERVER env var value
 * @returns {Response} audio/mpeg
 */
export async function synthesize(text, voice, speed = 1.0, serverUrl) {
  if (!serverUrl) {
    throw new Error('Kokoro server not configured. Set KOKORO_SERVER in your environment.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000); // CPU inference can take a while

  let res;
  try {
    res = await fetch(`${serverUrl}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: text,
        voice: voice || 'af_heart',
        speed: speed || 1.0,
        response_format: 'mp3'
      }),
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timeoutId);
    throw new Error(`Kokoro server unreachable: ${err.message}`);
  }

  clearTimeout(timeoutId);

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Kokoro server error ${res.status}: ${errText}`);
  }

  const audioBuffer = await res.arrayBuffer();
  return new Response(audioBuffer, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'X-Backend': 'kokoro'
    }
  });
}

/**
 * Check if the Kokoro server is reachable.
 * @param {string} serverUrl
 * @returns {'up' | 'down' | 'unconfigured'}
 */
export async function checkHealth(serverUrl) {
  if (!serverUrl) return 'unconfigured';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${serverUrl}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    return res.ok ? 'up' : 'down';
  } catch {
    return 'down';
  }
}

/**
 * Return the list of available Kokoro voices.
 */
export function getVoices() {
  return [
    // American Female
    { id: 'af_heart',    label: 'Heart',    lang: 'en-US', gender: 'F' },
    { id: 'af_bella',    label: 'Bella',    lang: 'en-US', gender: 'F' },
    { id: 'af_nicole',   label: 'Nicole',   lang: 'en-US', gender: 'F' },
    { id: 'af_sarah',    label: 'Sarah',    lang: 'en-US', gender: 'F' },
    { id: 'af_sky',      label: 'Sky',      lang: 'en-US', gender: 'F' },
    // American Male
    { id: 'am_adam',     label: 'Adam',     lang: 'en-US', gender: 'M' },
    { id: 'am_michael',  label: 'Michael',  lang: 'en-US', gender: 'M' },
    // British Female
    { id: 'bf_emma',     label: 'Emma',     lang: 'en-GB', gender: 'F' },
    { id: 'bf_isabella', label: 'Isabella', lang: 'en-GB', gender: 'F' },
    // British Male
    { id: 'bm_george',   label: 'George',   lang: 'en-GB', gender: 'M' },
    { id: 'bm_lewis',    label: 'Lewis',    lang: 'en-GB', gender: 'M' },
  ];
}
