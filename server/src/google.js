/**
 * Google Cloud Text-to-Speech proxy.
 * Requires GOOGLE_TTS_API_KEY env var (Cloud TTS API key with TTS enabled).
 * Uses Chirp 3 HD voices — Google's highest quality neural voices.
 * Returns audio/mpeg.
 *
 * Get an API key: https://console.cloud.google.com → APIs & Services → Credentials
 * Enable: Cloud Text-to-Speech API
 */

const API_BASE = 'https://texttospeech.googleapis.com';

export async function synthesize(text, voice, speed = 1.0, apiKey) {
  if (!apiKey) {
    throw new Error('Google TTS not configured. Set GOOGLE_TTS_API_KEY in your environment.');
  }

  const voiceName = voice || 'en-US-Chirp3-HD-Achernar';
  // Language code is the first two segments: en-US-Chirp3-HD-Achernar → en-US
  const langCode = voiceName.match(/^([a-z]{2}-[A-Z]{2})/)?.[1] || 'en-US';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  let res;
  try {
    res = await fetch(`${API_BASE}/v1beta1/text:synthesize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: langCode, name: voiceName },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: speed
        }
      }),
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timeoutId);
    throw new Error(`Google TTS unreachable: ${err.message}`);
  }

  clearTimeout(timeoutId);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body.error?.message || res.statusText;
    throw new Error(`Google TTS error ${res.status}: ${msg}`);
  }

  // Google returns base64-encoded audio in a JSON envelope
  const data = await res.json();
  const audioBytes = Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0));

  return new Response(audioBytes, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'X-Backend': 'google'
    }
  });
}

/**
 * Verify the API key works.
 * @param {string} apiKey
 * @returns {'up' | 'down' | 'unconfigured'}
 */
export async function checkHealth(apiKey) {
  if (!apiKey) return 'unconfigured';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(
      `${API_BASE}/v1/voices?languageCode=en-US`,
      {
        headers: { 'x-goog-api-key': apiKey },
        signal: controller.signal
      }
    );
    clearTimeout(timeoutId);
    return res.ok ? 'up' : 'down';
  } catch {
    return 'down';
  }
}

/**
 * Chirp 3 HD voices — Google's highest quality neural TTS.
 * Full list: https://cloud.google.com/text-to-speech/docs/chirp3-hd
 */
export function getVoices() {
  return [
    // American English
    { id: 'en-US-Chirp3-HD-Achernar',      label: 'Achernar',      lang: 'en-US', gender: 'F' },
    { id: 'en-US-Chirp3-HD-Aoede',         label: 'Aoede',         lang: 'en-US', gender: 'F' },
    { id: 'en-US-Chirp3-HD-Kore',          label: 'Kore',          lang: 'en-US', gender: 'F' },
    { id: 'en-US-Chirp3-HD-Leda',          label: 'Leda',          lang: 'en-US', gender: 'F' },
    { id: 'en-US-Chirp3-HD-Vindemiatrix',  label: 'Vindemiatrix',  lang: 'en-US', gender: 'F' },
    { id: 'en-US-Chirp3-HD-Charon',        label: 'Charon',        lang: 'en-US', gender: 'M' },
    { id: 'en-US-Chirp3-HD-Fenrir',        label: 'Fenrir',        lang: 'en-US', gender: 'M' },
    { id: 'en-US-Chirp3-HD-Orus',          label: 'Orus',          lang: 'en-US', gender: 'M' },
    { id: 'en-US-Chirp3-HD-Puck',          label: 'Puck',          lang: 'en-US', gender: 'M' },
    { id: 'en-US-Chirp3-HD-Rasalgethi',    label: 'Rasalgethi',    lang: 'en-US', gender: 'M' },
    // British English
    { id: 'en-GB-Chirp3-HD-Achernar',      label: 'Achernar (UK)', lang: 'en-GB', gender: 'F' },
    { id: 'en-GB-Chirp3-HD-Aoede',         label: 'Aoede (UK)',    lang: 'en-GB', gender: 'F' },
    { id: 'en-GB-Chirp3-HD-Leda',          label: 'Leda (UK)',     lang: 'en-GB', gender: 'F' },
    { id: 'en-GB-Chirp3-HD-Charon',        label: 'Charon (UK)',   lang: 'en-GB', gender: 'M' },
    { id: 'en-GB-Chirp3-HD-Fenrir',        label: 'Fenrir (UK)',   lang: 'en-GB', gender: 'M' },
    { id: 'en-GB-Chirp3-HD-Puck',          label: 'Puck (UK)',     lang: 'en-GB', gender: 'M' },
  ];
}
