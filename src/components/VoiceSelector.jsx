import { useState, useEffect } from 'react';
import { VOICES, LANG_LABELS } from '../../core/voices.js';
import { fetchVoices } from '../../services/tts.js';
import './VoiceSelector.css';

const DYNAMIC_BACKENDS = new Set(['elevenlabs']);

/**
 * Grouped voice picker for a given backend.
 * For backends in DYNAMIC_BACKENDS, fetches live voices from the server.
 * Falls back to the static list on error.
 * @param {{ backend: string, value: string, onChange: (id: string) => void }} props
 */
export default function VoiceSelector({ backend, value, onChange }) {
  const [voices, setVoices] = useState(VOICES[backend] || []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!DYNAMIC_BACKENDS.has(backend)) {
      setVoices(VOICES[backend] || []);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchVoices(backend)
      .then(v => { if (!cancelled) setVoices(v.length ? v : (VOICES[backend] || [])); })
      .catch(() => { if (!cancelled) setVoices(VOICES[backend] || []); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [backend]);

  // Group by lang
  const groups = {};
  for (const v of voices) {
    const group = LANG_LABELS[v.lang] || v.lang;
    if (!groups[group]) groups[group] = [];
    groups[group].push(v);
  }

  return (
    <div className="voice-selector">
      <select
        className="voice-selector__select"
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label="Voice"
        disabled={loading}
      >
        {loading && <option value="">Loading voices…</option>}
        {!loading && Object.entries(groups).map(([groupLabel, groupVoices]) => (
          <optgroup key={groupLabel} label={groupLabel}>
            {groupVoices.map(v => (
              <option key={v.id} value={v.id}>
                {v.label}{v.gender ? ` (${v.gender === 'F' ? 'Female' : 'Male'})` : ''}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

export { VOICES };
