import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('[ErrorBoundary]', error, info);
    }

    handleReload = () => {
        try { localStorage.removeItem('visora-auth-token'); } catch { }
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, sans-serif', color: 'white' }}>
                    <div style={{ textAlign: 'center', maxWidth: 400, padding: 40 }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
                        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Terjadi Kesalahan</h2>
                        <p style={{ color: '#888', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
                            Aplikasi mengalami error. Silakan muat ulang halaman.
                        </p>
                        <button
                            onClick={this.handleReload}
                            style={{ background: '#0071e3', color: 'white', border: 'none', padding: '12px 32px', borderRadius: 14, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                        >
                            Muat Ulang
                        </button>
                        {this.state.error && (
                            <pre style={{ marginTop: 24, fontSize: 10, color: '#555', textAlign: 'left', background: '#111', padding: 16, borderRadius: 12, overflow: 'auto', maxHeight: 150 }}>
                                {this.state.error.message}
                            </pre>
                        )}
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
