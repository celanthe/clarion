import { useState } from 'react';
import { createAgent, slugify, defaultVoice } from '../../core/domain/agent.js';
import { saveAgent, deleteAgent, exportAgents } from '../../services/storage/agent-storage.js';
import { speakAsAgent, stop } from '../../services/tts.js';
import VoiceSelector from './VoiceSelector.jsx';
import './AgentCard.css';

const BACKENDS = [
  { id: 'edge',   label: 'Edge TTS',  desc: 'Free, zero config' },
  { id: 'kokoro', label: 'Kokoro',    desc: 'Natural voices' },
  { id: 'piper',  label: 'Piper',     desc: 'Local, lightweight' }
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
        msg = `${agent.backend} backend not configured on this server.`;
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

  if (confirmDelete) {
    return (
      <article className="agent-card agent-card--confirming">
        <p className="agent-card__confirm-text">
          Delete <strong>{agent.name}</strong>? This cannot be undone.
        </p>
        <div className="agent-card__confirm-actions">
          <button className="agent-card__btn agent-card__btn--ghost" onClick={handleDeleteCancel} type="button">
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
    <article className="agent-card">
      <header className="agent-card__header">
        <input
          className="agent-card__name"
          type="text"
          value={agent.name}
          onChange={handleNameChange}
          placeholder="Agent name"
          aria-label="Agent name"
        />
        <span className="agent-card__id" title="Agent ID (used by CLI)">{agent.id}</span>
      </header>

      {!saved && (
        <p className="agent-card__unsaved">Unsaved changes</p>
      )}

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
            <label className="agent-card__label">
              Speed
              <span className="agent-card__speed-value">{agent.speed.toFixed(2)}×</span>
            </label>
            <input
              type="range"
              className="agent-card__speed"
              min="0.5"
              max="2.0"
              step="0.05"
              value={agent.speed}
              onChange={handleSpeedChange}
              aria-label="Speed"
              aria-valuemin="0.5"
              aria-valuemax="2.0"
              aria-valuenow={agent.speed.toFixed(2)}
            />
          </div>
        )}

        {/* Custom test text */}
        {showTestInput && (
          <div className="agent-card__field">
            <label className="agent-card__label">Test text</label>
            <textarea
              className="agent-card__test-input"
              value={testText}
              onChange={e => setTestText(e.target.value)}
              placeholder={DEFAULT_TEST}
              rows={3}
              spellCheck={false}
            />
          </div>
        )}
      </div>

      {error && <p className="agent-card__error">{error}</p>}

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
