import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { ensureUserRow, toAppUser } from '../lib/auth.js';
import { LoginPage } from './LoginPage.js';
import { AppUser } from '../../types.js';
import { EntitlementResolver } from '../lib/entitlements.js';

/**
 * AuthGate — strict dashboard guard.
 * 
 * SECURITY: This gate is fail-CLOSED. If the plan check fails for any reason
 * (network error, DB timeout, etc.), the user is redirected away from the
 * dashboard. An unpaid user must NEVER see dashboard content, even briefly.
 */
export const AuthGate: React.FC<{ children: (user: AppUser) => React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AppUser | null>(null);
    const [loading, setLoading] = useState(true);
    const initialized = useRef(false);

    /**
     * Checks entitlement and either grants dashboard access or redirects.
     * Shared by both getSession and onAuthStateChange paths.
     */
    const resolveAccess = async (sessionUser: any, accessToken: string) => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('plan, status')
                .eq('id', sessionUser.id)
                .single();

            if (error || !data) {
                // DB query failed → fail CLOSED → redirect to formorderauth
                console.error('AuthGate: plan query failed, denying access:', error);
                window.location.href = '/formorderauth';
                return;
            }

            const resolver = new EntitlementResolver({
                plan: data.plan || 'free',
                infinite_enabled: false,  // not relevant for access check
                status: data.status || 'active',
            });

            if (resolver.canAccessDashboard) {
                // Active paid plan → grant dashboard access
                setUser(toAppUser(sessionUser));
                setLoading(false);
                return;
            }

            // No active plan → check for pending payment
            if (!data.plan || data.plan === 'none' || data.plan === 'free') {
                try {
                    const res = await fetch('/api/payment/latest-pending', {
                        headers: { Authorization: `Bearer ${accessToken}` }
                    });
                    if (res.ok) {
                        const pendingData = await res.json();
                        if (pendingData.hasPending) {
                            window.location.href = `/pending-payment?orderId=${pendingData.orderId}`;
                            return;
                        }
                    }
                } catch (e) { console.error('Error checking pending payment:', e); }
            }

            // No plan, no pending → formorderauth
            window.location.href = '/formorderauth';
        } catch (err) {
            // Unexpected error → fail CLOSED
            console.error('AuthGate: unexpected error, denying access:', err);
            window.location.href = '/formorderauth';
        }
    };

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        // Safety timeout — never stay loading forever
        const timeout = setTimeout(() => {
            // Timeout → fail CLOSED → redirect away
            console.warn('AuthGate: loading timeout, denying access');
            window.location.href = '/formorderauth';
        }, 8000);

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                Promise.resolve(ensureUserRow(session.user)).catch(console.error);
                resolveAccess(session.user, session.access_token);
            } else {
                clearTimeout(timeout);
                setLoading(false);
            }
        }).catch(() => {
            clearTimeout(timeout);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                window.location.href = '/';
                return;
            }
            if (session?.user) {
                Promise.resolve(ensureUserRow(session.user)).catch(console.error);
                resolveAccess(session.user, session.access_token);
            } else {
                setUser(null);
                setLoading(false);
            }
        });

        return () => {
            clearTimeout(timeout);
            subscription.unsubscribe();
        };
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-[#0071e3] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!user) {
        return <LoginPage onSignIn={async () => { await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/auth/resolve' } }); }} loading={false} />;
    }

    // Authenticated + verified active plan → render dashboard
    return <>{children(user)}</>;
};

export const handleSignOut = () => supabase.auth.signOut();
