import { useState, useEffect, useCallback } from 'react';
import SetupPanel from './SetupPanel.jsx';
import './SetupPanel.css';

/**
 * Standalone embeddable Clarion diagnostic panel.
 *
 * Props:
 *   serverUrl — Clarion server URL (required)
 *
 * Wraps SetupPanel + health polling into a single component
 * with no dependency on App-level state. Designed for embedding
 * in external projects (e.g. Terminus).
 */
export default function ClarionEmbed({ serverUrl }) {
  const [health, setHealth] = useState(null);
  const [agents, setAgents] = useState([]);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`${serverUrl}/health`, {
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        setHealth(await res.json());
      } else {
        setHealth({ edge: 'error', kokoro: 'error', piper: 'error', elevenlabs: 'error', google: 'error' });
      }
    } catch {
      setHealth({ edge: 'error', kokoro: 'error', piper: 'error', elevenlabs: 'error', google: 'error' });
    }
  }, [serverUrl]);

  const fetchAgents = useCallback(async () => {
    // Try to load agents from localStorage (same format as main app)
    try {
      const stored = localStorage.getItem('clarion-agents');
      if (stored) setAgents(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    fetchHealth();
    fetchAgents();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth, fetchAgents]);

  return (
    <div className="clarion-embed" role="region" aria-label="Clarion diagnostics" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
      <SetupPanel
        health={health}
        agents={agents}
        onAgentUpdate={fetchAgents}
      />
    </div>
  );
}
