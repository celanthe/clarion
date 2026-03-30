import { useState, useEffect } from 'react';
import { fetchHealth } from '../../services/tts.js';
import './BackendStatus.css';

const BACKENDS = ['edge', 'kokoro', 'piper', 'elevenlabs', 'google'];

const BACKEND_LABELS = {
  edge: 'Edge TTS',
  kokoro: 'Kokoro',
  piper: 'Piper',
  elevenlabs: 'ElevenLabs',
  google: 'Google'
};

const STATUS_LABEL = {
  up:           'Online',
  down:         'Unreachable',
  unconfigured: 'Not configured',
  checking:     'Checking...',
  error:        'Error'
};

const HEALTH_TIMEOUT_MS = 6000;

function getAggregateStatus(status) {
  if (status.edge === 'checking') return 'unconfigured';
  if (status.edge === 'up') return 'up';
  return 'down';
}

function getAggregateAriaLabel(status) {
  const total = BACKENDS.length;
  const up = BACKENDS.filter(b => status[b] === 'up').length;
  if (status.edge === 'checking') return 'TTS backends: loading';
  return `TTS backends: ${up} of ${total} available`;
}

export default function BackendStatus({ serverUrl, onHealthChange }) {
  const [status, setStatus] = useState({ edge: 'checking', kokoro: 'checking', piper: 'checking', elevenlabs: 'checking', google: 'checking' });
  const [lastChecked, setLastChecked] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      // Timeout if health check hangs
      const timer = setTimeout(() => {
        if (!cancelled) {
          const timedOut = { edge: 'error', kokoro: 'error', piper: 'error', elevenlabs: 'error', google: 'error' };
          setStatus(timedOut);
          onHealthChange?.(timedOut);
          setLastChecked(new Date());
        }
      }, HEALTH_TIMEOUT_MS);

      try {
        const data = await fetchHealth();
        clearTimeout(timer);
        if (!cancelled) {
          setStatus(data);
          onHealthChange?.(data);
          setLastChecked(new Date());
        }
      } catch {
        clearTimeout(timer);
        if (!cancelled) {
          const err = { edge: 'error', kokoro: 'error', piper: 'error', elevenlabs: 'error', google: 'error' };
          setStatus(err);
          onHealthChange?.(err);
          setLastChecked(new Date());
        }
      }
    }

    check();
    let interval = setInterval(check, 30000);

    // Pause polling when the tab is backgrounded (saves battery on mobile)
    function onVisibilityChange() {
      if (document.hidden) {
        clearInterval(interval);
        interval = null;
      } else {
        check();
        interval = setInterval(check, 30000);
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [serverUrl]);

  const aggStatus = getAggregateStatus(status);
  const aggAriaLabel = getAggregateAriaLabel(status);

  // Only show backends that are actively configured or up.
  // Edge TTS is always shown (zero-config, always available).
  // All others are shown only when status is 'up', 'down', or 'error' —
  // meaning the user has pointed Clarion at them. 'unconfigured' and null
  // are hidden to keep the header clean on a fresh install.
  const visibleBackends = BACKENDS.filter(b =>
    b === 'edge' || status[b] === 'up' || status[b] === 'down' || status[b] === 'error'
  );

  return (
    <div className="backend-status" role="status">
      {/* Mobile: single aggregate dot */}
      <span
        className={`backend-status__aggregate backend-status__dot--${aggStatus}`}
        title={aggAriaLabel}
      >
        <span className="sr-only">{aggAriaLabel}</span>
      </span>
      {/* Desktop: per-backend list — only configured/reachable backends */}
      {visibleBackends.map(backend => (
        <span key={backend} className="backend-status__item" title={STATUS_LABEL[status[backend]] || status[backend]}>
          <span
            className={`backend-status__dot backend-status__dot--${status[backend]}`}
            aria-hidden="true"
          />
          <span className="backend-status__label">{BACKEND_LABELS[backend] || backend}</span>
          <span className="backend-status__state">
            {STATUS_LABEL[status[backend]] || status[backend]}
          </span>
        </span>
      ))}
    </div>
  );
}
