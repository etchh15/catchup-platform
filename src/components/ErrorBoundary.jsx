import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorLog: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorLog: error.message };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Critical Platform Exception Intercepted:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px', fontFamily: 'sans-serif' }}>
          <div className="premium-card" style={{ maxWidth: '500px', textAlign: 'center', borderColor: '#ef4444' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
            <h2 style={{ color: '#f8fafc', margin: '0 0 12px 0' }}>Application Sandbox Interrupted</h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
              A localized layout tracking error occurred during data compilation. The system isolated the crash safely to protect your active session row data.
            </p>
            <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', color: '#f43f5e', fontSize: '12px', textAlign: 'left', overflowX: 'auto', marginBottom: '24px', fontFamily: 'monospace' }}>
              Error: {this.state.errorLog}
            </div>
            <button onClick={() => window.location.reload()} className="btn-primary" style={{ width: '100%' }}>
              🔄 Re-initialize Live Application Engine
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
