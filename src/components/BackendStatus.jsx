import { useState, useEffect } from 'react';
import { fetchHealth } from '../../services/tts.js';
import './BackendStatus.css';

const BACKENDS = ['edge', 'kokoro', 'piper', 'elevenlabs', 'google'];

const STATUS_LABEL = {
  up:           'Online',
  down:         'Unreachable',
  unconfigured: 'Not configured',
  checking:     'Checking...',
  error:        'Error'
};

const HEALTH_TIMEOUT_MS = 6000;

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
    const interval = setInterval(check, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [serverUrl]);

  return (
    <div className="backend-status" aria-label="Backend status">
      {BACKENDS.map(backend => (
        <span key={backend} className="backend-status__item" title={STATUS_LABEL[status[backend]] || status[backend]}>
          <span
            className={`backend-status__dot backend-status__dot--${status[backend]}`}
            aria-hidden="true"
          />
          <span className="backend-status__label">{backend}</span>
          <span className="backend-status__state">
            {STATUS_LABEL[status[backend]] || status[backend]}
          </span>
        </span>
      ))}
    </div>
  );
}
