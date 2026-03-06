import { VOICES, LANG_LABELS } from '../../core/voices.js';
import './VoiceSelector.css';

/**
 * Grouped voice picker for a given backend.
 * @param {{ backend: string, value: string, onChange: (id: string) => void }} props
 */
export default function VoiceSelector({ backend, value, onChange }) {
  const voices = VOICES[backend] || [];

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
      >
        {Object.entries(groups).map(([groupLabel, groupVoices]) => (
          <optgroup key={groupLabel} label={groupLabel}>
            {groupVoices.map(v => (
              <option key={v.id} value={v.id}>
                {v.label} ({v.gender === 'F' ? 'Female' : 'Male'})
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

export { VOICES };
