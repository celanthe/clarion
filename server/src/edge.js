/**
 * Edge TTS proxy using Microsoft Translator API
 * Ported from Everbloom — rate limiting and shared-infra code removed.
 * This is your server, so there's no rate limiting by default.
 */

// Token cache
let tokenCache = { endpoint: null, token: null, expiredAt: null };
const TOKEN_REFRESH_BEFORE_EXPIRY = 5 * 60; // Refresh 5 minutes early

/**
 * Synthesize speech using Microsoft Edge TTS.
 * Called by the unified /speak handler in index.js.
 * @param {string} text
 * @param {string} voice - e.g. "en-GB-RyanNeural"
 * @param {number} speed - multiplier, 1.0 = normal
 * @returns {Response} audio/mpeg
 */
// Valid voice IDs — validated before insertion into SSML attributes
const VALID_VOICES = new Set([
  'en-US-JennyNeural','en-US-AriaNeural','en-US-MichelleNeural','en-US-AnaNeural',
  'en-US-GuyNeural','en-US-RyanNeural','en-US-ChristopherNeural','en-US-EricNeural',
  'en-GB-SoniaNeural','en-GB-LibbyNeural','en-GB-MiaNeural','en-GB-RyanNeural','en-GB-ThomasNeural',
  'en-AU-NatashaNeural','en-AU-AnnetteNeural','en-AU-WilliamNeural','en-AU-DarrenNeural',
  'en-IE-EmilyNeural','en-IE-ConnorNeural',
  'en-CA-ClaraNeural','en-CA-LiamNeural',
  'en-ZA-LeahNeural','en-ZA-LukeNeural',
  'en-NZ-MollyNeural','en-NZ-MitchellNeural',
  'en-IN-NeerjaNeural','en-IN-PrabhatNeural',
]);

export async function synthesize(text, voice, speed = 1.0, env = {}) {
  const endpoint = await getEndpoint(env);

  const voiceName = voice || 'en-US-JennyNeural';

  // Whitelist voice before it enters an XML attribute
  if (!VALID_VOICES.has(voiceName)) {
    throw new Error(`Unknown Edge voice: ${voiceName}`);
  }
  const ratePercent = ((speed - 1) * 100).toFixed(0);
  const ssml = buildSsml(text, voiceName, ratePercent);

  const ttsUrl = `https://${endpoint.r}.tts.speech.microsoft.com/cognitiveservices/v1`;

  const response = await fetch(ttsUrl, {
    method: 'POST',
    headers: {
      'Authorization': endpoint.t,
      'Content-Type': 'application/ssml+xml',
      'User-Agent': 'okhttp/4.5.0',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3'
    },
    body: ssml
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Edge TTS API error ${response.status}: ${errorText}`);
  }

  return new Response(response.body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'X-Backend': 'edge'
    }
  });
}

/**
 * Return the list of available Edge TTS voices.
 */
export function getVoices() {
  return [
    // US Female
    { id: 'en-US-JennyNeural',       label: 'Jenny',       lang: 'en-US', gender: 'F' },
    { id: 'en-US-AriaNeural',        label: 'Aria',        lang: 'en-US', gender: 'F' },
    { id: 'en-US-MichelleNeural',    label: 'Michelle',    lang: 'en-US', gender: 'F' },
    { id: 'en-US-AnaNeural',         label: 'Ana',         lang: 'en-US', gender: 'F' },
    // US Male
    { id: 'en-US-GuyNeural',         label: 'Guy',         lang: 'en-US', gender: 'M' },
    { id: 'en-US-RyanNeural',        label: 'Ryan',        lang: 'en-US', gender: 'M' },
    { id: 'en-US-ChristopherNeural', label: 'Christopher', lang: 'en-US', gender: 'M' },
    { id: 'en-US-EricNeural',        label: 'Eric',        lang: 'en-US', gender: 'M' },
    // UK Female
    { id: 'en-GB-SoniaNeural',       label: 'Sonia',       lang: 'en-GB', gender: 'F' },
    { id: 'en-GB-LibbyNeural',       label: 'Libby',       lang: 'en-GB', gender: 'F' },
    { id: 'en-GB-MiaNeural',         label: 'Mia',         lang: 'en-GB', gender: 'F' },
    // UK Male
    { id: 'en-GB-RyanNeural',        label: 'Ryan (UK)',   lang: 'en-GB', gender: 'M' },
    { id: 'en-GB-ThomasNeural',      label: 'Thomas',      lang: 'en-GB', gender: 'M' },
    // Australian
    { id: 'en-AU-NatashaNeural',     label: 'Natasha',     lang: 'en-AU', gender: 'F' },
    { id: 'en-AU-AnnetteNeural',     label: 'Annette',     lang: 'en-AU', gender: 'F' },
    { id: 'en-AU-WilliamNeural',     label: 'William',     lang: 'en-AU', gender: 'M' },
    { id: 'en-AU-DarrenNeural',      label: 'Darren',      lang: 'en-AU', gender: 'M' },
    // Irish
    { id: 'en-IE-EmilyNeural',       label: 'Emily',       lang: 'en-IE', gender: 'F' },
    { id: 'en-IE-ConnorNeural',      label: 'Connor',      lang: 'en-IE', gender: 'M' },
    // Canadian
    { id: 'en-CA-ClaraNeural',       label: 'Clara',       lang: 'en-CA', gender: 'F' },
    { id: 'en-CA-LiamNeural',        label: 'Liam',        lang: 'en-CA', gender: 'M' },
    // South African
    { id: 'en-ZA-LeahNeural',        label: 'Leah',        lang: 'en-ZA', gender: 'F' },
    { id: 'en-ZA-LukeNeural',        label: 'Luke',        lang: 'en-ZA', gender: 'M' },
    // New Zealand
    { id: 'en-NZ-MollyNeural',       label: 'Molly',       lang: 'en-NZ', gender: 'F' },
    { id: 'en-NZ-MitchellNeural',    label: 'Mitchell',    lang: 'en-NZ', gender: 'M' },
    // Indian
    { id: 'en-IN-NeerjaNeural',      label: 'Neerja',      lang: 'en-IN', gender: 'F' },
    { id: 'en-IN-PrabhatNeural',     label: 'Prabhat',     lang: 'en-IN', gender: 'M' },
  ];
}

// --- Internal helpers ---

async function getEndpoint(env = {}) {
  const now = Date.now() / 1000;

  if (tokenCache.token && tokenCache.expiredAt &&
      now < tokenCache.expiredAt - TOKEN_REFRESH_BEFORE_EXPIRY) {
    return tokenCache.endpoint;
  }

  const endpointUrl = 'https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0';
  const clientId = crypto.randomUUID().replace(/-/g, '');

  const response = await fetch(endpointUrl, {
    method: 'POST',
    headers: {
      'Accept-Language': 'en-US',
      'X-ClientVersion': '4.0.530a 5fe1dc6c',
      'X-UserId': '0f04d16a175c411e',
      'X-HomeGeographicRegion': 'en-US',
      'X-ClientTraceId': clientId,
      'X-MT-Signature': await sign(endpointUrl, env),
      'User-Agent': 'okhttp/4.5.0',
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': '0',
      'Accept-Encoding': 'gzip'
    }
  });

  if (!response.ok) {
    if (tokenCache.endpoint) {
      console.warn('[edge] Failed to refresh token, using cached');
      return tokenCache.endpoint;
    }
    throw new Error(`Failed to get Edge token: ${response.status}`);
  }

  const data = await response.json();
  const jwt = data.t.split('.')[1];
  const decoded = JSON.parse(atob(jwt));

  tokenCache = { endpoint: data, token: data.t, expiredAt: decoded.exp };
  console.log(`[edge] Token refreshed, expires in ${((decoded.exp - now) / 60).toFixed(1)}m`);
  return data;
}

async function sign(urlStr, env = {}) {
  const url = urlStr.split('://')[1];
  const encodedUrl = encodeURIComponent(url);
  const uuid = crypto.randomUUID().replace(/-/g, '');
  const date = (new Date()).toUTCString().replace(/GMT/, '').trim() + ' GMT';
  const toSign = `MSTranslatorAndroidApp${encodedUrl}${date}${uuid}`.toLowerCase();

  // This is the publicly reverse-engineered MSTranslatorAndroidApp HMAC key.
  // It's not a secret — it ships in Microsoft's Android app and is used by all
  // open-source edge-tts implementations. Set EDGE_TTS_KEY to override if needed.
  const keyBase64 = env.EDGE_TTS_KEY || 'oik6PdDdMnOXemTbwvMn9de/h9lFnfBaCWbGMMZqqoSaQaqUOqjVGm5NqsmjcBI1x+sS9ugjB55HEJWRiFXYFw==';
  const keyBytes = base64ToBytes(keyBase64);
  const sig = await hmacSha256(keyBytes, toSign);

  return `MSTranslatorAndroidApp::${bytesToBase64(sig)}::${date}::${uuid}`;
}

async function hmacSha256(key, data) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function buildSsml(text, voiceName, ratePercent) {
  const safe = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  return `<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" version="1.0" xml:lang="en-US">
  <voice name="${voiceName}">
    <mstts:express-as style="general">
      <prosody rate="${ratePercent}%" pitch="+0%">${safe}</prosody>
    </mstts:express-as>
  </voice>
</speak>`;
}
