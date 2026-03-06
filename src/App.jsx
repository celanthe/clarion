import { useState, useCallback, useEffect, useRef } from 'react';
import AgentCard from './components/AgentCard.jsx';
import BackendStatus from './components/BackendStatus.jsx';
import VoiceAudition from './components/VoiceAudition.jsx';
import { loadAgents, importAgents, exportAgents, getServerUrl, setServerUrl, hasApiKey, setApiKey } from '../services/storage/agent-storage.js';
import { migrateApiKey } from '../services/crypto.js';
import { stop } from '../services/tts.js';
import { createAgent } from '../core/domain/agent.js';
import './App.css';

const TABS = [
  { id: 'agents',   label: 'Agents' },
  { id: 'audition', label: 'Audition' }
];

export default function App() {
  const [tab, setTab] = useState('agents');
  const [agents, setAgents] = useState(() => loadAgents());
  const [serverUrl, setServerUrlState] = useState(() => getServerUrl());
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [importError, setImportError] = useState(null);
  const [health, setHealth] = useState(null);
  const [urlError, setUrlError] = useState(null);
  const fileInputRef = useRef(null);

  function handleNewAgent() {
    const agent = createAgent({ name: 'New Agent' });
    setAgents(prev => {
      // Avoid duplicate IDs
      if (prev.some(a => a.id === agent.id)) {
        const ts = Date.now().toString(36);
        agent.id = `${agent.id}-${ts}`;
      }
      return [...prev, agent];
    });
  }

  const handleSave = useCallback(() => {
    setAgents(loadAgents());
  }, []);

  const handleDelete = useCallback((id) => {
    setAgents(prev => prev.filter(a => a.id !== id));
  }, []);

  // Migrate any plaintext key from localStorage → IndexedDB on first load.
  // Then check whether a signing key is already stored.
  useEffect(() => {
    migrateApiKey().then(() => hasApiKey().then(setApiKeyConfigured));
  }, []);

  // Space key stops playback globally (ignored when focus is in a text input)
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.code !== 'Space') return;
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || e.target.isContentEditable) return;
      e.preventDefault();
      stop();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  function handleServerUrlChange(e) {
    const url = e.target.value;
    setServerUrlState(url);
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setUrlError('URL must start with http:// or https://');
      } else {
        setUrlError(null);
        setServerUrl(url);
      }
    } catch {
      setUrlError('Enter a valid URL (e.g. http://localhost:8787)');
    }
  }

  async function handleSetApiKey() {
    const key = newApiKey.trim();
    await setApiKey(key);
    setApiKeyConfigured(!!key);
    setNewApiKey('');
  }

  async function handleClearApiKey() {
    await setApiKey('');
    setApiKeyConfigured(false);
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const { imported, errors } = await importAgents(file);
    setAgents(loadAgents());
    if (errors.length > 0) {
      setImportError(`Imported ${imported}. Errors: ${errors.join('; ')}`);
    }
    e.target.value = '';
  }

  // Audition saves directly to storage — reload agents list
  const handleAuditionSave = useCallback(() => {
    setAgents(loadAgents());
    setTab('agents');
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__left">
          <h1 className="app-header__title">Clarion</h1>
          <p className="app-header__tagline">Give your agent a voice</p>
        </div>
        <div className="app-header__right">
          <BackendStatus serverUrl={serverUrl} onHealthChange={setHealth} />
          <button
            className="app-header__config-btn"
            onClick={() => setShowServerConfig(v => !v)}
            type="button"
            aria-expanded={showServerConfig}
          >
            {showServerConfig ? 'Done' : 'Server'}
          </button>
        </div>
      </header>

      {showServerConfig && (
        <div className="app-server-config">
          <label className="app-server-config__label" htmlFor="server-url">
            Clarion server URL
          </label>
          <input
            id="server-url"
            className="app-server-config__input"
            type="url"
            value={serverUrl}
            onChange={handleServerUrlChange}
            placeholder="http://localhost:8787"
            aria-describedby="server-url-hint"
          />
          {urlError && (
            <p className="app-server-config__url-error" role="alert">{urlError}</p>
          )}
          <p className="app-server-config__hint" id="server-url-hint">
            Point this at your Clarion server (<code>node src/node-server.js</code> or Cloudflare Worker).
          </p>
          <label className="app-server-config__label" htmlFor="api-key">
            API key <span className="app-server-config__optional">(optional)</span>
          </label>
          {apiKeyConfigured ? (
            <div className="app-server-config__key-status">
              <span className="app-server-config__key-set">Key configured — requests are HMAC-signed</span>
              <button
                className="app-server-config__key-clear"
                type="button"
                onClick={handleClearApiKey}
              >
                Clear
              </button>
            </div>
          ) : (
            <div className="app-server-config__key-row">
              <input
                id="api-key"
                className="app-server-config__input"
                type="password"
                value={newApiKey}
                onChange={e => setNewApiKey(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSetApiKey(); }}
                placeholder="Enter API key to configure"
                autoComplete="off"
              />
              <button
                className="app-server-config__key-set-btn"
                type="button"
                onClick={handleSetApiKey}
                disabled={!newApiKey.trim()}
              >
                Set
              </button>
            </div>
          )}
          <p className="app-server-config__hint">
            Stored securely in your browser — the key never leaves your device. Requests are signed with HMAC-SHA256.
          </p>
        </div>
      )}

      {health !== null && health?.edge === 'error' && (
        <div className="app-offline-banner" role="alert">
          Can't reach server at <code>{serverUrl}</code>.{' '}
          <button
            className="app-offline-banner__action"
            type="button"
            onClick={() => setShowServerConfig(true)}
          >
            Check configuration
          </button>
        </div>
      )}

      <nav className="app-tabs" aria-label="Views" role="tablist">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`app-tab ${tab === t.id ? 'app-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {tab === 'audition' ? (
          <VoiceAudition health={health} onSave={handleAuditionSave} />
        ) : (
          <>
            {agents.length === 0 ? (
              <div className="app-empty">
                <p className="app-empty__headline">Give your agent a voice.</p>
                <p className="app-empty__hint">
                  Go to <button className="app-empty__tab-link" onClick={() => setTab('audition')} type="button">Audition</button> — paste a few lines of your agent's dialogue, hear each voice read them, and save the one that fits.
                </p>
                <p className="app-empty__hint">Or create a profile directly and pick a voice from the list.</p>
                <button className="app-new-btn" onClick={handleNewAgent} type="button">
                  Create an agent
                </button>
              </div>
            ) : (
              <div className="app-grid">
                {agents.map(agent => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onSave={handleSave}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {tab === 'agents' && (
        <footer className="app-footer">
          <div className="app-footer__actions">
            <button className="app-new-btn" onClick={handleNewAgent} type="button">
              + New agent
            </button>

            <button
              className="app-import-label"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Import agent profiles from JSON"
            >
              Import
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImport}
              className="app-import-input"
            />

            {agents.length > 0 && (
              <button className="app-import-label" onClick={() => exportAgents()} type="button">
                Export all
              </button>
            )}

            {importError && (
              <span className="app-import-error">{importError}</span>
            )}
          </div>

          <div className="app-footer__credits">
            <span>by <a href="https://github.com/celanthe" target="_blank" rel="noopener">celanthe</a> &amp; <a href="https://zabethy.com" target="_blank" rel="noopener">Zabethy</a></span>
            <span className="app-footer__sep">·</span>
            <a href="https://github.com/celanthe/clarion" target="_blank" rel="noopener">GitHub</a>
            <span className="app-footer__sep">·</span>
            <a href="https://ko-fi.com/rinoliver" target="_blank" rel="noopener" className="app-footer__kofi">
              <svg className="app-footer__kofi-heart" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M12 21.6C5.8 17.7 2 13.7 2 9.5 2 6.4 4.4 4 7.5 4c1.7 0 3.3.8 4.5 2.1C13.2 4.8 14.8 4 16.5 4 19.6 4 22 6.4 22 9.5c0 4.2-3.8 8.2-10 12.1z"/>
              </svg>
              Ko-fi
            </a>
          </div>
        </footer>
      )}
    </div>
  );
}
