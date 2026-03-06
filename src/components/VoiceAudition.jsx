import { useState, useRef } from 'react';
import { speak, stop } from '../../services/tts.js';
import { saveAgent } from '../../services/storage/agent-storage.js';
import { createAgent } from '../../core/domain/agent.js';
import { VOICES, LANG_LABELS, groupByLang } from '../../core/voices.js';
import Waveform from './Waveform.jsx';
import './VoiceAudition.css';

const BACKENDS = ['edge', 'kokoro', 'piper'];

const DEFAULT_TEXT = "The pattern holds. We're moving forward.";

/**
 * Voice audition view — paste an agent's dialogue, hear each voice read it,
 * pick the one that fits, save as an agent profile.
 */
export default function VoiceAudition({ onSave, health }) {
  const [text, setText] = useState('');
  const [backend, setBackend] = useState('edge');
  const [speed, setSpeed] = useState(1.0);
  const [playing, setPlaying] = useState(null); // voice id currently playing
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null); // { voice, label } just saved
  const [agentName, setAgentName] = useState('');
  const [saveTarget, setSaveTarget] = useState(null); // voice being saved
  const nameInputRef = useRef(null);

  const auditionText = text.trim() || DEFAULT_TEXT;
  const voices = VOICES[backend] || [];

  async function handlePlay(voice) {
    if (playing === voice.id) {
      stop();
      setPlaying(null);
      return;
    }
    stop();
    setPlaying(voice.id);
    setError(null);
    try {
      await speak(auditionText, { backend, voice: voice.id, speed });
    } catch (err) {
      console.error('[clarion] speak error:', err);
      setError(`${voice.label}: ${err.message}`);
    } finally {
      setPlaying(null);
    }
  }

  function handleUseVoice(voice) {
    stop();
    setPlaying(null);
    setSaveTarget(voice);
    setAgentName('');
    setTimeout(() => nameInputRef.current?.focus(), 50);
  }

  function handleSaveAgent(e) {
    e.preventDefault();
    if (!saveTarget || !agentName.trim()) return;

    const agent = createAgent({
      name: agentName.trim(),
      backend,
      voice: saveTarget.id,
      speed
    });

    saveAgent(agent);
    setSaved({ voice: saveTarget, label: agentName });
    setSaveTarget(null);
    setAgentName('');
    onSave?.(agent);
  }

  function handleCancelSave() {
    setSaveTarget(null);
    setAgentName('');
  }

  const groups = groupByLang(voices);

  const backendAvailable = (b) => {
    if (!health) return true;
    return health[b] === 'up' || b === 'edge';
  };

  return (
    <div className="audition">
      <div className="audition__intro">
        <h2 className="audition__title">Voice Audition</h2>
        <p className="audition__desc">
          Paste your agent's dialogue below. Each voice will read their words —
          find the one that fits, then save it as a profile.
        </p>
      </div>

      {/* Dialogue input */}
      <div className="audition__text-section">
        <label className="audition__label" htmlFor="audition-text">
          Agent dialogue
        </label>
        <textarea
          id="audition-text"
          className="audition__textarea"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={DEFAULT_TEXT}
          rows={5}
          spellCheck={false}
        />
        <p className="audition__hint">
          Paste a few lines. Short, characteristic sentences work best —
          the kind your agent actually says.
        </p>
      </div>

      {/* Backend selector */}
      <div className="audition__backends">
        {BACKENDS.map(b => {
          const available = backendAvailable(b);
          return (
            <button
              key={b}
              className={`audition__backend-btn ${backend === b ? 'audition__backend-btn--active' : ''} ${!available ? 'audition__backend-btn--unavailable' : ''}`}
              onClick={() => { if (available) setBackend(b); }}
              disabled={!available}
              type="button"
              title={!available ? `${b} not configured or unreachable` : undefined}
            >
              {b}
              {!available && <span className="audition__backend-status">offline</span>}
            </button>
          );
        })}
      </div>

      {/* Speed knob (hidden for piper — no speed support) */}
      {backend !== 'piper' && (
        <div className="audition__speed">
          <label className="audition__label" htmlFor="audition-speed">
            Speed
            <span className="audition__speed-value">{speed.toFixed(2)}×</span>
          </label>
          <input
            id="audition-speed"
            type="range"
            className="audition__speed-range"
            min="0.5"
            max="2.0"
            step="0.05"
            value={speed}
            onChange={e => setSpeed(parseFloat(e.target.value))}
            aria-valuemin="0.5"
            aria-valuemax="2.0"
            aria-valuenow={speed.toFixed(2)}
          />
        </div>
      )}

      {/* Waveform visualizer */}
      <Waveform active={playing !== null} />

      {/* Error */}
      {error && <p className="audition__error" role="alert">{error}</p>}

      {/* Save as agent form */}
      {saveTarget && (
        <form className="audition__save-form" onSubmit={handleSaveAgent}>
          <p className="audition__save-prompt">
            Save <strong>{saveTarget.label}</strong> ({LANG_LABELS[saveTarget.lang] || saveTarget.lang}) as an agent:
          </p>
          <div className="audition__save-row">
            <input
              ref={nameInputRef}
              className="audition__save-input"
              type="text"
              value={agentName}
              onChange={e => setAgentName(e.target.value)}
              placeholder="Agent name (e.g. Julian)"
              required
            />
            <button className="audition__save-btn" type="submit">Save</button>
            <button className="audition__cancel-btn" type="button" onClick={handleCancelSave}>Cancel</button>
          </div>
        </form>
      )}

      {/* Success flash */}
      {saved && (
        <p className="audition__saved-notice" role="status">
          Saved <strong>{saved.label}</strong> with {saved.voice.label} ({LANG_LABELS[saved.voice.lang] || saved.voice.lang}).
          {' '}<button className="audition__saved-dismiss" type="button" onClick={() => setSaved(null)} aria-label="Dismiss">×</button>
        </p>
      )}

      {/* Voice list */}
      <div className="audition__voices">
        {!backendAvailable(backend) ? (
          <p className="audition__offline">
            {backend} is offline — start your server to audition these voices.
          </p>
        ) : Object.entries(groups).map(([lang, langVoices]) => (
          <div key={lang} className="audition__group">
            <h3 className="audition__group-label">{lang}</h3>
            <div className="audition__voice-list">
              {langVoices.map(voice => (
                <div
                  key={voice.id}
                  className={`audition__voice ${playing === voice.id ? 'audition__voice--playing' : ''}`}
                >
                  <button
                    className="audition__play-btn"
                    onClick={() => handlePlay(voice)}
                    type="button"
                    aria-label={playing === voice.id ? `Stop ${voice.label}` : `Play ${voice.label}`}
                  >
                    {playing === voice.id ? '■' : '▶'}
                  </button>
                  <div className="audition__voice-info">
                    <span className="audition__voice-name">{voice.label}</span>
                    <span className="audition__voice-gender">{voice.gender === 'F' ? 'Female' : 'Male'}</span>
                  </div>
                  <button
                    className="audition__use-btn"
                    onClick={() => handleUseVoice(voice)}
                    type="button"
                  >
                    Use this voice
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
