import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { EntitlementResolver } from '../lib/entitlements.js';

/**
 * AuthResolver — neutral landing page after Google OAuth.
 * Determines where to route the user based on plan + pending payment state.
 * 
 * - Active plan → /dashboard
 * - Pending payment → /pending-payment?orderId=...
 * - No plan, no pending → /formorderauth
 */
export const AuthResolver: React.FC = () => {
    const [status, setStatus] = useState('Memverifikasi akun Anda...');

    useEffect(() => {
        const resolve = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (!session?.user) {
                    // Not logged in — send to landing
                    window.location.href = '/';
                    return;
                }

                // 1. Check plan status
                const { data: userData } = await supabase
                    .from('users')
                    .select('plan, status')
                    .eq('id', session.user.id)
                    .single();

                const resolver = new EntitlementResolver({
                    plan: userData?.plan || 'free',
                    infinite_enabled: false,
                    status: userData?.status || 'active',
                });

                if (resolver.canAccessDashboard) {
                    // Active paid plan + active status → dashboard
                    window.location.href = '/dashboard';
                    return;
                }

                // 2. Check pending payment
                setStatus('Memeriksa status pembayaran...');
                try {
                    const res = await fetch('/api/payment/latest-pending', {
                        headers: { Authorization: `Bearer ${session.access_token}` }
                    });
                    if (res.ok) {
                        const pendingData = await res.json();
                        if (pendingData.hasPending) {
                            window.location.href = `/pending-payment?orderId=${pendingData.orderId}`;
                            return;
                        }
                    }
                } catch (e) {
                    console.error('Error checking pending payment:', e);
                }

                // 3. No plan, no pending → formorderauth
                window.location.href = '/formorderauth';
            } catch (err) {
                console.error('AuthResolver error:', err);
                window.location.href = '/';
            }
        };

        resolve();
    }, []);

    return (
        <div style={{
            minHeight: '100vh',
            background: '#000',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            fontFamily: "'Inter', -apple-system, sans-serif",
        }}>
            <div style={{
                width: 32, height: 32,
                border: '2px solid #0071e3',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 0.6s linear infinite',
            }} />
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>{status}</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};
