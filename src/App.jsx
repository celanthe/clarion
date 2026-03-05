import { useState, useCallback } from 'react';
import AgentCard from './components/AgentCard.jsx';
import BackendStatus from './components/BackendStatus.jsx';
import VoiceAudition from './components/VoiceAudition.jsx';
import { loadAgents, importAgents, getServerUrl, setServerUrl } from '../services/storage/agent-storage.js';
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
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [importError, setImportError] = useState(null);
  const [health, setHealth] = useState(null);

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

  function handleServerUrlChange(e) {
    const url = e.target.value;
    setServerUrlState(url);
    setServerUrl(url);
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
          <p className="app-server-config__hint" id="server-url-hint">
            Point this at your Clarion server (<code>node src/node-server.js</code> or Cloudflare Worker).
          </p>
        </div>
      )}

      <nav className="app-tabs" aria-label="Views">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`app-tab ${tab === t.id ? 'app-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
            type="button"
            aria-current={tab === t.id ? 'page' : undefined}
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
                <p>No agents yet.</p>
                <p className="app-empty__hint">
                  Create one here, or use <button className="app-empty__tab-link" onClick={() => setTab('audition')} type="button">Audition</button> to match a voice to your agent's dialogue first.
                </p>
                <button className="app-new-btn" onClick={handleNewAgent} type="button">
                  Create your first agent
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
          <button className="app-new-btn" onClick={handleNewAgent} type="button">
            + New agent
          </button>

          <label className="app-import-label" title="Import agent profiles from JSON">
            Import JSON
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleImport}
              className="app-import-input"
            />
          </label>

          {importError && (
            <span className="app-import-error">{importError}</span>
          )}

          <div className="app-footer__credits">
            <span>Built on <a href="https://github.com/erikaflowers" target="_blank" rel="noopener">Erika Flowers</a>' <a href="https://github.com/erikaflowers" target="_blank" rel="noopener">Investiture</a> framework · inspired by <a href="https://everbloomreader.com" target="_blank" rel="noopener">Everbloom Reader</a></span>
            <span className="app-footer__sep">·</span>
            <span>Art & design by <a href="https://zabethy.com" target="_blank" rel="noopener">Zabethy</a> · in progress</span>
            <span className="app-footer__sep">·</span>
            <span>Based on <a href="https://zerovector.design" target="_blank" rel="noopener">zerovector.design</a> principles by <a href="https://github.com/erikaflowers" target="_blank" rel="noopener">@erikaflowers</a></span>
            <span className="app-footer__sep">·</span>
            <a href="https://github.com/celanthe/clarion" target="_blank" rel="noopener">GitHub</a>
          </div>
        </footer>
      )}
    </div>
  );
}
