import { useState, useRef, useEffect } from 'react';
import { createAgent, slugify, defaultVoice } from '../../core/domain/agent.js';
import { saveAgent, deleteAgent, exportAgents } from '../../services/storage/agent-storage.js';
import { speakAsAgent, stop, onSpeakingChange, muteAgent, unmuteAgent, isMuted } from '../../services/tts.js';
import VoiceSelector from './VoiceSelector.jsx';
import './AgentCard.css';

const BACKENDS = [
  { id: 'edge',       label: 'Edge TTS',    desc: 'Free, zero config' },
  { id: 'kokoro',     label: 'Kokoro',      desc: 'Natural voices, self-hosted' },
  { id: 'piper',      label: 'Piper',       desc: 'Local, lightweight' },
  { id: 'elevenlabs', label: 'ElevenLabs',  desc: 'Premium voices, requires API key' },
  { id: 'google',     label: 'Google',      desc: 'Chirp 3 HD, requires API key' }
];

const DEFAULT_TEST = "The pattern holds. We're moving forward.";

export default function AgentCard({ agent: initialAgent, onSave, onDelete }) {
  const [agent, setAgent] = useState(initialAgent);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(true);
  const [error, setError] = useState(null);
  const [testText, setTestText] = useState('');
  const [showTestInput, setShowTestInput] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [muted, setMuted] = useState(() => isMuted(initialAgent.id));
  const previewTimerRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    return onSpeakingChange((id) => setIsSpeaking(id === agent.id));
  }, [agent.id]);

  useEffect(() => () => clearTimeout(previewTimerRef.current), []);

  useEffect(() => {
    if (confirmDelete && cancelRef.current) cancelRef.current.focus();
  }, [confirmDelete]);

  function update(fields) {
    setAgent(prev => ({ ...prev, ...fields }));
    setSaved(false);
  }

  function handleNameChange(e) {
    const name = e.target.value;
    update({ name, id: slugify(name) || agent.id });
  }

  function handleBackendChange(backend) {
    update({ backend, voice: defaultVoice(backend) });
  }

  function handleVoiceChange(voice) {
    update({ voice });
    // Auto-preview with 600ms debounce
    clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(async () => {
      stop();
      try {
        await speakAsAgent(testText.trim() || DEFAULT_TEST, { ...agent, voice });
      } catch {
        // Silently ignore preview errors — user can test manually
      }
    }, 600);
  }

  function handleSpeedChange(e) {
    update({ speed: parseFloat(e.target.value) });
  }

  function handleSave() {
    const updated = createAgent(agent);
    saveAgent(updated);
    setAgent(updated);
    setSaved(true);
    onSave?.(updated);
  }

  async function handleTest() {
    stop();
    setTesting(true);
    setError(null);
    const text = testText.trim() || DEFAULT_TEST;
    try {
      await speakAsAgent(text, agent);
    } catch (err) {
      // Humanize common errors
      let msg = err.message;
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        msg = `Can't reach server. Is Clarion running? (${agent.backend})`;
      } else if (msg.includes('not configured')) {
        msg = `${agent.backend} backend is not configured on this server.`;
      }
      setError(msg);
    } finally {
      setTesting(false);
    }
  }

  function handleDeleteClick() {
    setConfirmDelete(true);
  }

  function handleDeleteConfirm() {
    deleteAgent(agent.id);
    onDelete?.(agent.id);
  }

  function handleDeleteCancel() {
    setConfirmDelete(false);
  }

  function handleExport() {
    exportAgents(agent.id);
  }

  function handleMuteToggle() {
    if (muted) {
      unmuteAgent(agent.id);
      setMuted(false);
    } else {
      muteAgent(agent.id);
      setMuted(true);
    }
  }

  if (confirmDelete) {
    return (
      <article className="agent-card agent-card--confirming" role="alertdialog" aria-label={`Confirm deletion of ${agent.name}`}>
        <p className="agent-card__confirm-text">
          Delete <strong>{agent.name}</strong>? This cannot be undone.
        </p>
        <div className="agent-card__confirm-actions">
          <button className="agent-card__btn agent-card__btn--ghost" onClick={handleDeleteCancel} type="button" ref={cancelRef}>
            Cancel
          </button>
          <button className="agent-card__btn agent-card__btn--delete-confirm" onClick={handleDeleteConfirm} type="button">
            Delete
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className={`agent-card${isSpeaking ? ' agent-card--speaking' : ''}`}>
      <header className="agent-card__header">
        <input
          className="agent-card__name"
          type="text"
          value={agent.name}
          onChange={handleNameChange}
          placeholder="Who's speaking?"
          aria-label="Agent name"
        />
        <span className="agent-card__id" title="Agent ID (used by CLI)">{agent.id}</span>
      </header>

      <p className="agent-card__unsaved" role="status">
        {!saved ? 'Unsaved changes' : ''}
      </p>

      <div className="agent-card__body">
        <fieldset className="agent-card__field">
          <legend className="agent-card__label">Backend</legend>
          <div className="agent-card__backends">
            {BACKENDS.map(b => (
              <button
                key={b.id}
                className={`agent-card__backend-btn ${agent.backend === b.id ? 'agent-card__backend-btn--active' : ''}`}
                onClick={() => handleBackendChange(b.id)}
                type="button"
                aria-pressed={agent.backend === b.id}
                title={b.desc}
              >
                {b.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="agent-card__field">
          <label className="agent-card__label">Voice</label>
          <VoiceSelector
            backend={agent.backend}
            value={agent.voice}
            onChange={handleVoiceChange}
          />
        </div>

        {agent.backend !== 'piper' && (
          <div className="agent-card__field">
            <label className="agent-card__label" htmlFor={`agent-card-speed-${agent.id}`}>
              Speed
              <span className="agent-card__speed-value">{agent.speed.toFixed(2)}×</span>
            </label>
            <div className="agent-card__speed-wrap">
              <input
                id={`agent-card-speed-${agent.id}`}
                type="range"
                className="agent-card__speed"
                min="0.5"
                max="2.0"
                step="0.05"
                value={agent.speed}
                onChange={handleSpeedChange}
                list={`agent-card-speed-ticks-${agent.id}`}
                aria-valuemin="0.5"
                aria-valuemax="2.0"
                aria-valuenow={agent.speed.toFixed(2)}
                aria-valuetext={`${agent.speed.toFixed(2)}× speed`}
              />
              <datalist id={`agent-card-speed-ticks-${agent.id}`}>
                <option value="1"/>
              </datalist>
            </div>
          </div>
        )}

        <div className="agent-card__field agent-card__field--inline">
          <input
            id={`agent-card-prose-only-${agent.id}`}
            type="checkbox"
            className="agent-card__checkbox"
            checked={agent.proseOnly ?? true}
            onChange={e => update({ proseOnly: e.target.checked })}
          />
          <label className="agent-card__label agent-card__label--inline" htmlFor={`agent-card-prose-only-${agent.id}`}>
            Prose only — skip code blocks and lists
          </label>
        </div>

        {/* Custom test text */}
        {showTestInput && (
          <div className="agent-card__field">
            <label className="agent-card__label" htmlFor={`agent-card-test-text-${agent.id}`}>Test text</label>
            <textarea
              id={`agent-card-test-text-${agent.id}`}
              className="agent-card__test-input"
              value={testText}
              onChange={e => setTestText(e.target.value)}
              placeholder={DEFAULT_TEST}
              rows={3}
              spellCheck={false}
              maxLength={2000}
            />
            <span className="agent-card__char-hint">{testText.length}/2000</span>
          </div>
        )}
      </div>

      {error && <p className="agent-card__error" role="alert">{error}</p>}

      <footer className="agent-card__footer">
        <div className="agent-card__test-group">
          <button
            className="agent-card__btn agent-card__btn--test"
            onClick={testing ? () => { stop(); setTesting(false); } : handleTest}
            type="button"
          >
            {testing ? '■ Stop' : 'Test'}
          </button>
          <button
            className={`agent-card__btn agent-card__btn--ghost agent-card__btn--tiny ${showTestInput ? 'agent-card__btn--ghost-active' : ''}`}
            onClick={() => setShowTestInput(v => !v)}
            type="button"
            title="Customize test text"
            aria-label="Customize test text"
          >
            {showTestInput ? '↑' : '✎'}
          </button>
          <button
            className={`agent-card__btn agent-card__btn--ghost agent-card__btn--tiny agent-card__mute-btn${muted ? ' agent-card__mute-btn--muted' : ''}`}
            onClick={handleMuteToggle}
            type="button"
            title={muted ? 'Unmute agent' : 'Mute agent'}
            aria-label={muted ? 'Unmute agent' : 'Mute agent'}
            aria-pressed={muted}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>

        <div className="agent-card__actions">
          <button
            className="agent-card__btn agent-card__btn--ghost"
            onClick={handleExport}
            type="button"
            title="Export as JSON"
          >
            Export
          </button>
          <button
            className="agent-card__btn agent-card__btn--ghost agent-card__btn--danger"
            onClick={handleDeleteClick}
            type="button"
          >
            Delete
          </button>
          <button
            className={`agent-card__btn agent-card__btn--save ${saved ? 'agent-card__btn--saved' : ''}`}
            onClick={handleSave}
            type="button"
          >
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </footer>
    </article>
  );
}
