import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '24px 16px', gap: 12,
          color: '#999', fontSize: 12, textAlign: 'center',
        }}>
          <span style={{ fontSize: 20 }}>⚠</span>
          <span>{this.props.fallbackMessage || 'Something went wrong in this panel.'}</span>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 4, padding: '5px 14px', borderRadius: 6,
              border: '1px solid #444', background: 'transparent',
              color: '#ccc', fontSize: 11, cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
