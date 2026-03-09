/**
 * ElevenLabs TTS proxy.
 * Requires ELEVENLABS_API_KEY env var.
 * Uses eleven_turbo_v2_5 — fast, high quality, supports all pre-made voices.
 * Returns audio/mpeg.
 */

const API_BASE = 'https://api.elevenlabs.io/v1';

export async function synthesize(text, voice, apiKey, speed = 1.0) {
  if (!apiKey) {
    throw new Error('ElevenLabs not configured. Set ELEVENLABS_API_KEY in your environment.');
  }

  const voiceId = voice || '21m00Tcm4TlvDq8ikWAM'; // Rachel default

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  let res;
  try {
    res = await fetch(`${API_BASE}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          speed
        }
      }),
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timeoutId);
    throw new Error(`ElevenLabs unreachable: ${err.message}`);
  }

  clearTimeout(timeoutId);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body.detail?.message || body.detail || res.statusText;
    throw new Error(`ElevenLabs error ${res.status}: ${msg}`);
  }

  return new Response(res.body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'X-Backend': 'elevenlabs'
    }
  });
}

/**
 * Check if the ElevenLabs API key is valid.
 * @param {string} apiKey
 * @returns {'up' | 'down' | 'unconfigured'}
 */
export async function checkHealth(apiKey) {
  if (!apiKey) return 'unconfigured';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${API_BASE}/user`, {
      headers: { 'xi-api-key': apiKey },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return res.ok ? 'up' : 'down';
  } catch {
    return 'down';
  }
}

/**
 * Curated pre-made ElevenLabs voices.
 * Used as fallback when no API key is configured or when the API fetch fails.
 */
const STATIC_VOICES = [
  // American English
  { id: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel',  lang: 'en-US', gender: 'F' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', label: 'Elli',    lang: 'en-US', gender: 'F' },
  { id: 'XrExE9yKIg1WjnnlVkGX', label: 'Matilda', lang: 'en-US', gender: 'F' },
  { id: 'pNInz6obpgDQGcFmaJgB', label: 'Adam',    lang: 'en-US', gender: 'M' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', label: 'Josh',    lang: 'en-US', gender: 'M' },
  { id: 'SOYHLrjzK2X1ezoPC6cr', label: 'Harry',   lang: 'en-US', gender: 'M' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', label: 'Liam',    lang: 'en-US', gender: 'M' },
  // British English
  { id: 'onwK4e9ZLuTAKqWW03F9', label: 'Daniel',  lang: 'en-GB', gender: 'M' },
  { id: 'ThT5KcBeYPX3keUQqHPh', label: 'Dorothy', lang: 'en-GB', gender: 'F' },
  { id: 'LcfcDJNUP1GQjkzn1xUU', label: 'Emily',   lang: 'en-GB', gender: 'F' },
  // Australian English
  { id: 'IKne3meq5aSn9XLyUdCD', label: 'Charlie', lang: 'en-AU', gender: 'M' },
];

/**
 * Normalize a language tag from the ElevenLabs API to a BCP 47 locale.
 * - Full locale like "en-US" → "en-US" (pass through)
 * - Short code like "en" → "en-US"
 * - Unknown/missing → "en"
 */
function normalizeLang(raw) {
  if (!raw || typeof raw !== 'string') return 'en';
  // Already a full locale (e.g. "en-US", "fr-FR")
  if (/^[a-z]{2}-[A-Z]{2}$/.test(raw)) return raw;
  // Short language code — map "en" → "en-US", keep others as-is with a region suffix
  if (raw === 'en') return 'en-US';
  return raw;
}

/**
 * Fetch voices from the ElevenLabs API.
 * Falls back to the curated static list if no API key is provided or on any error.
 *
 * Users can use any voice ID from their ElevenLabs library —
 * pass it directly via the API or CLI with --voice <id>.
 *
 * @param {string|undefined} apiKey
 * @returns {Promise<Array<{id: string, label: string, lang: string, gender: string|null}>>}
 */
export async function getVoices(apiKey) {
  if (!apiKey) return STATIC_VOICES;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${API_BASE}/voices`, {
      headers: { 'xi-api-key': apiKey },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) return STATIC_VOICES;

    const data = await res.json();
    const voices = Array.isArray(data?.voices) ? data.voices : [];

    return voices.map(voice => ({
      id: voice.voice_id,
      label: voice.name,
      lang: normalizeLang(voice.labels?.language),
      gender: voice.labels?.gender === 'male' ? 'M'
            : voice.labels?.gender === 'female' ? 'F'
            : null
    }));
  } catch {
    clearTimeout(timeoutId);
    return STATIC_VOICES;
  }
}
