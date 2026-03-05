/**
 * Piper TTS proxy.
 * Forwards requests to your self-hosted Piper server.
 * Returns audio/wav.
 */

/**
 * Synthesize speech using a self-hosted Piper server.
 * @param {string} text
 * @param {string} voice - e.g. "amy", "ryan"
 * @param {string} serverUrl - PIPER_SERVER env var value
 * @returns {Response} audio/wav
 */
export async function synthesize(text, voice, serverUrl) {
  if (!serverUrl) {
    throw new Error('Piper server not configured. Set PIPER_SERVER in your environment.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);

  let res;
  try {
    res = await fetch(`${serverUrl}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text, voice: voice || 'amy' }),
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timeoutId);
    throw new Error(`Piper server unreachable: ${err.message}`);
  }

  clearTimeout(timeoutId);

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Piper server error ${res.status}: ${errText}`);
  }

  const audioBuffer = await res.arrayBuffer();
  return new Response(audioBuffer, {
    headers: {
      'Content-Type': 'audio/wav',
      'X-Backend': 'piper'
    }
  });
}

/**
 * Check if the Piper server is reachable.
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
 * Return the list of available Piper voices.
 */
export function getVoices() {
  return [
    { id: 'amy',         label: 'Amy',     lang: 'en-US', gender: 'F' },
    { id: 'kathleen',    label: 'Kathleen', lang: 'en-US', gender: 'F' },
    { id: 'lessac',      label: 'Lessac',   lang: 'en-US', gender: 'F' },
    { id: 'ryan',        label: 'Ryan',     lang: 'en-US', gender: 'M' },
    { id: 'hfc_male',    label: 'HFC Male', lang: 'en-US', gender: 'M' },
    { id: 'alan',        label: 'Alan',     lang: 'en-GB', gender: 'M' },
    { id: 'jenny_dioco', label: 'Jenny',    lang: 'en-GB', gender: 'F' },
  ];
}
