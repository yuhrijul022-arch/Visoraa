import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ensureUserRow, toAppUser } from '../lib/auth';
import { LoginPage } from './LoginPage';
import { AppUser } from '../../types';

export const AuthGate: React.FC<{ children: (user: AppUser) => React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AppUser | null>(null);
    const [loading, setLoading] = useState(true);
    const initialized = useRef(false);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        // Safety timeout — never stay loading forever
        const timeout = setTimeout(() => setLoading(false), 8000);

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setUser(toAppUser(session.user));
                ensureUserRow(session.user).catch(console.error);
            }
            setLoading(false);
        }).catch(() => setLoading(false));

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                setUser(toAppUser(session.user));
                ensureUserRow(session.user).catch(console.error);
            } else {
                setUser(null);
            }
            setLoading(false);
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
        return <LoginPage onSignIn={async () => { await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } }); }} loading={false} />;
    }

    // Authenticated → langsung masuk ke app (credits jadi access control)
    return <>{children(user)}</>;
};

export const handleSignOut = () => supabase.auth.signOut();
