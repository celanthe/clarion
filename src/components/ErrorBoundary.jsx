import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error('[clarion] Uncaught render error:', error, info.componentStack);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.icon} aria-hidden="true">!</div>
          <h1 style={styles.heading}>Something went wrong</h1>
          <p style={styles.message}>
            Your agent profiles are safe — they are stored in your browser.
          </p>
          {import.meta.env.DEV && this.state.error && (
            <pre style={styles.detail}>{this.state.error.message}</pre>
          )}
          <button
            style={styles.button}
            onClick={this.handleReload}
            type="button"
            onMouseEnter={e => { e.target.style.background = '#9888ff'; }}
            onMouseLeave={e => { e.target.style.background = '#8272f0'; }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#14141f',
    padding: '24px',
    fontFamily: "'Space Grotesk', system-ui, -apple-system, sans-serif",
  },
  card: {
    background: '#1e1d2e',
    border: '1px solid #332f4e',
    borderRadius: '12px',
    padding: '48px 40px',
    maxWidth: '480px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
  },
  icon: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: 'rgba(224, 108, 117, 0.08)',
    border: '2px solid #e06c75',
    color: '#e06c75',
    fontSize: '1.375rem',
    fontWeight: '600',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  heading: {
    color: '#eae6f6',
    fontSize: '1.375rem',
    fontWeight: '600',
    margin: '0 0 8px',
  },
  message: {
    color: '#c0bad8',
    fontSize: '1rem',
    lineHeight: '1.5',
    margin: '0 0 24px',
  },
  detail: {
    background: '#272638',
    border: '1px solid #242238',
    borderRadius: '8px',
    padding: '12px 16px',
    color: '#b0aac8',
    fontSize: '0.8125rem',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    textAlign: 'left',
    overflowX: 'auto',
    marginBottom: '24px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  button: {
    background: '#8272f0',
    color: '#f5f3ff',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 32px',
    fontSize: '1rem',
    fontWeight: '500',
    fontFamily: "'Space Grotesk', system-ui, -apple-system, sans-serif",
    cursor: 'pointer',
    transition: '180ms ease',
    minHeight: '44px',
    minWidth: '44px',
  },
};
