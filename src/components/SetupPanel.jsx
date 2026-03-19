import { useState, useEffect, useCallback } from 'react';
import { getServerUrl } from '../../services/storage/agent-storage.js';
import { signRequest } from '../../services/crypto.js';
import { loadAgents, saveAgent } from '../../services/storage/agent-storage.js';
import './SetupPanel.css';

const BACKENDS = ['edge', 'kokoro', 'piper', 'elevenlabs', 'google'];

const BACKEND_LABELS = {
  edge: 'Edge TTS',
  kokoro: 'Kokoro',
  piper: 'Piper',
  elevenlabs: 'ElevenLabs',
  google: 'Google Chirp'
};

const STATUS_LABELS = {
  up: 'Online',
  down: 'Unreachable',
  unconfigured: 'Not configured',
  checking: 'Checking...',
  error: 'Error'
};

const REMEDIATION = {
  kokoro: { down: 'Is Docker running? Start Docker Desktop, then: docker-compose up -d' },
  piper: { down: 'Is the Piper server running? Check PIPER_SERVER in your server .env' },
  elevenlabs: { down: 'API key may be expired or invalid. Renew at elevenlabs.io/account' },
  google: { down: 'API key may be invalid. Check GOOGLE_TTS_API_KEY in your server .env' }
};

async function authHeaders(method, path) {
  const sig = await signRequest(method, path);
  return sig ? { Authorization: sig } : {};
}

export default function SetupPanel({ health, agents, onAgentUpdate }) {
  const [diagnostics, setDiagnostics] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const fetchDiagnostics = useCallback(async () => {
    const serverUrl = getServerUrl();
    try {
      const res = await fetch(`${serverUrl}/diagnostics`, {
        headers: await authHeaders('GET', '/diagnostics'),
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        setDiagnostics(await res.json());
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchDiagnostics();
  }, [fetchDiagnostics]);

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    const serverUrl = getServerUrl();
    try {
      const res = await fetch(`${serverUrl}/health`, {
        headers: await authHeaders('GET', '/health'),
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        const data = await res.json();
        const upCount = BACKENDS.filter(b => data[b] === 'up').length;
        setTestResult({ ok: true, message: `Connected — ${upCount} backend${upCount !== 1 ? 's' : ''} available` });
      } else {
        setTestResult({ ok: false, message: `Server returned ${res.status}` });
      }
    } catch (err) {
      setTestResult({ ok: false, message: `Unreachable: ${err.message}` });
    }
    setTesting(false);
  }

  function handleSwitchToEdge(agent) {
    const updated = { ...agent, backend: 'edge', voice: 'en-US-JennyNeural' };
    saveAgent(updated);
    onAgentUpdate?.();
  }

  // Use diagnostics if available, fall back to health
  const backendStatus = (backend) => {
    if (diagnostics?.backends?.[backend]) return diagnostics.backends[backend];
    const status = health?.[backend] || 'checking';
    return { status, configured: status !== 'unconfigured', detail: '' };
  };

  return (
    <div className="setup-panel">
      {/* Backend cards */}
      <h2 className="setup-panel__section-title">Backends</h2>
      <div className="setup-panel__backends">
        {BACKENDS.map(backend => {
          const info = backendStatus(backend);
          const status = info.status || 'checking';
          const remediation = REMEDIATION[backend]?.[status];

          return (
            <div key={backend} className="setup-panel__backend-card">
              <div className="setup-panel__backend-header">
                <span className={`setup-panel__backend-dot setup-panel__backend-dot--${status}`} aria-hidden="true" />
                <span className="setup-panel__backend-name">{BACKEND_LABELS[backend]}</span>
                <span className="setup-panel__backend-status">{STATUS_LABELS[status] || status}</span>
              </div>
              {info.detail && (
                <p className="setup-panel__backend-detail">{info.detail}</p>
              )}
              {remediation && (
                <p className="setup-panel__backend-hint">{remediation}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Agent health */}
      {agents && agents.length > 0 && (
        <>
          <h2 className="setup-panel__section-title">Agent Health</h2>
          <div className="setup-panel__agents">
            {agents.map(agent => {
              const info = backendStatus(agent.backend);
              const status = info.status || 'checking';
              const isDown = status === 'down' || status === 'error';

              return (
                <div key={agent.id} className="setup-panel__agent-row">
                  <span className={`setup-panel__backend-dot setup-panel__backend-dot--${status}`} aria-hidden="true" />
                  <span className="setup-panel__agent-name">{agent.name}</span>
                  <span className="setup-panel__agent-backend">{BACKEND_LABELS[agent.backend]} / {agent.voice}</span>
                  {isDown && agent.backend !== 'edge' && (
                    <>
                      <span className="setup-panel__agent-warning">Backend down</span>
                      <button
                        className="setup-panel__switch-btn"
                        type="button"
                        onClick={() => handleSwitchToEdge(agent)}
                        aria-label={`Switch ${agent.name} to Edge TTS`}
                        title={`Switch ${agent.name} to Edge TTS with default Jenny voice`}
                      >
                        Switch to Edge
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Connection test */}
      <h2 className="setup-panel__section-title">Connection</h2>
      <div className="setup-panel__test-row">
        <button
          className="setup-panel__test-btn"
          type="button"
          onClick={handleTestConnection}
          disabled={testing}
        >
          {testing ? 'Testing...' : 'Test connection'}
        </button>
        <span role="status" aria-live="polite" className={testResult ? `setup-panel__test-result ${testResult.ok ? 'setup-panel__test-result--ok' : 'setup-panel__test-result--fail'}` : ''}>
          {testResult ? testResult.message : ''}
        </span>
      </div>
    </div>
  );
}
