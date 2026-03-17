import { useState, useEffect, useCallback } from 'react';
import { getCrewLog, clearCrewLog } from '../../services/storage/crew-log.js';
import { onSpeakingChange, speakAsAgent } from '../../services/tts.js';
import './CrewLog.css';

export default function CrewLog({ agents }) {
  const [entries, setEntries] = useState([]);
  const [filter, setFilter] = useState(null); // null = all agents
  const [loading, setLoading] = useState(true);

  function agentName(id) {
    return agents.find(a => a.id === id)?.name || id;
  }

  const loadLog = useCallback(async () => {
    setLoading(true);
    const log = await getCrewLog({ agentId: filter || undefined, limit: 100 });
    setEntries(log);
    setLoading(false);
  }, [filter]);

  useEffect(() => { loadLog(); }, [loadLog]);

  // Reload after each agent finishes speaking (agentId goes back to null)
  useEffect(() => {
    return onSpeakingChange((agentId) => {
      if (agentId === null) loadLog();
    });
  }, [loadLog]);

  async function handleClear(agentId) {
    await clearCrewLog(agentId || null);
    loadLog();
  }

  function handleReplay(entry) {
    const agent = agents.find(a => a.id === entry.agentId);
    if (!agent) return;
    speakAsAgent(entry.text, agent);
  }

  // Collect the set of agent IDs that appear in the current entries list
  const agentsInLog = [...new Set(entries.map(e => e.agentId))];

  return (
    <div className="crew-log">
      <div className="crew-log__toolbar">
        <div className="crew-log__filters" role="group" aria-label="Filter by agent">
          <button
            className={`crew-log__filter-btn${filter === null ? ' crew-log__filter-btn--active' : ''}`}
            onClick={() => setFilter(null)}
            type="button"
          >
            All
          </button>
          {agentsInLog.map(id => (
            <button
              key={id}
              className={`crew-log__filter-btn${filter === id ? ' crew-log__filter-btn--active' : ''}`}
              onClick={() => setFilter(id)}
              type="button"
            >
              {agentName(id)}
            </button>
          ))}
        </div>
        <button
          className="crew-log__clear-btn"
          onClick={() => handleClear(filter)}
          type="button"
        >
          Clear {filter ? agentName(filter) : 'all'}
        </button>
      </div>

      {loading ? (
        <p className="crew-log__empty">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="crew-log__empty">No messages yet. Speak as an agent to see the log here.</p>
      ) : (
        <ul className="crew-log__list">
          {entries.map(entry => (
            <li key={entry.id} className="crew-log__entry">
              <div className="crew-log__entry-meta">
                <span className="crew-log__entry-agent">{agentName(entry.agentId)}</span>
                <span className="crew-log__entry-time">
                  {new Date(entry.timestamp).toLocaleString()}
                </span>
                <button
                  className="crew-log__replay-btn"
                  onClick={() => handleReplay(entry)}
                  type="button"
                  title="Replay this message"
                >
                  ▶ Replay
                </button>
              </div>
              <p className="crew-log__entry-text">{entry.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
