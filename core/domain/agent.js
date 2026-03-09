/**
 * Agent domain model.
 * An agent is a named persona with a specific TTS backend + voice + speed.
 */

/**
 * @typedef {Object} Agent
 * @property {string} id       - Unique slug (e.g. "julian")
 * @property {string} name     - Display name (e.g. "Julian")
 * @property {'edge'|'kokoro'|'piper'|'elevenlabs'|'google'} backend
 * @property {string} voice    - Backend-specific voice ID
 * @property {number} speed    - Playback speed multiplier (0.5–2.0, default 1.0)
 * @property {string} createdAt - ISO timestamp
 */

/**
 * Create a new agent with defaults.
 * @param {Partial<Agent>} fields
 * @returns {Agent}
 */
export function createAgent(fields = {}) {
  const name = fields.name || 'My Agent';
  return {
    id: fields.id || slugify(name),
    name,
    backend: fields.backend || 'edge',
    voice: fields.voice || defaultVoice(fields.backend || 'edge'),
    speed: fields.speed ?? 1.0,
    proseOnly: fields.proseOnly ?? true,
    createdAt: fields.createdAt || new Date().toISOString()
  };
}

/**
 * Validate an agent object.
 * @param {unknown} obj
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateAgent(obj) {
  const errors = [];

  if (!obj || typeof obj !== 'object') {
    return { valid: false, errors: ['Not an object'] };
  }

  if (!obj.id || typeof obj.id !== 'string') errors.push('Missing id');
  if (!obj.name || typeof obj.name !== 'string') errors.push('Missing name');
  if (!['edge', 'kokoro', 'piper', 'elevenlabs', 'google'].includes(obj.backend)) errors.push('Invalid backend');
  if (!obj.voice || typeof obj.voice !== 'string') errors.push('Missing voice');
  if (typeof obj.speed !== 'number' || obj.speed < 0.25 || obj.speed > 4.0) {
    errors.push('Speed must be a number between 0.25 and 4.0');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Convert a name to a URL-safe slug used as agent ID.
 * @param {string} name
 * @returns {string}
 */
export function slugify(name) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+$/, '') || 'agent';
}

/**
 * Default voice for each backend.
 * @param {'edge'|'kokoro'|'piper'|'elevenlabs'|'google'} backend
 * @returns {string}
 */
export function defaultVoice(backend) {
  switch (backend) {
    case 'kokoro':     return 'af_heart';
    case 'piper':      return 'amy';
    case 'elevenlabs': return '21m00Tcm4TlvDq8ikWAM'; // Rachel
    case 'google':     return 'en-US-Chirp3-HD-Achernar';
    case 'edge':
    default:           return 'en-US-JennyNeural';
  }
}
