import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ensureUserRow, toAppUser } from '../lib/auth';
import { LoginPage } from './LoginPage';
import { AppUser } from '../../types';

export const AuthGate: React.FC<{ children: (user: AppUser) => React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AppUser | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [isPro, setIsPro] = useState<boolean | null>(null);
    const [authProvider, setAuthProvider] = useState<string | null>(null);
    const initialized = useRef(false);

    const checkProStatus = async (uid: string) => {
        try {
            const { data } = await supabase.from('users').select('pro_active').eq('id', uid).single();
            setIsPro((data as any)?.pro_active ?? false);
        } catch {
            setIsPro(false);
        }
    };

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setUser(toAppUser(session.user));
                const provider = session.user.app_metadata?.provider || 'email';
                setAuthProvider(provider);
                if (provider === 'email') {
                    checkProStatus(session.user.id);
                } else {
                    setIsPro(true); // Google auth → masuk langsung
                }
                ensureUserRow(session.user).catch(console.error);
            }
            setAuthLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                setUser(toAppUser(session.user));
                const provider = session.user.app_metadata?.provider || 'email';
                setAuthProvider(provider);
                if (provider === 'email') {
                    await checkProStatus(session.user.id);
                } else {
                    setIsPro(true);
                }
                ensureUserRow(session.user).catch(console.error);
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
                setIsPro(null);
                setAuthProvider(null);
            }
            setAuthLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    if (authLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!user) {
        return <LoginPage onSignIn={async () => { await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } }); }} loading={false} />;
    }

    // Email users must have pro_active to enter
    if (authProvider === 'email' && isPro === false) {
        return <WaitingForPayment email={user.email || ''} onRefresh={() => checkProStatus(user.uid)} />;
    }

    return <>{children(user)}</>;
};

const WaitingForPayment: React.FC<{ email: string; onRefresh: () => void }> = ({ email, onRefresh }) => {
    const [checking, setChecking] = useState(false);

    const handleCheck = async () => {
        setChecking(true);
        await onRefresh();
        setTimeout(() => setChecking(false), 1500);
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6 font-sans">
            <div className="max-w-md w-full bg-[#1c1c1e] rounded-[2.5rem] p-10 border border-white/5 shadow-2xl text-center relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-blue-500/10 blur-[80px] pointer-events-none"></div>

                <div className="relative z-10">
                    <div className="w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-blue-500/20">
                        <svg width="40" height="40" viewBox="0 0 34 24" fill="none" className="text-blue-500">
                            <path d="M0 0H8V24H0V0Z" fill="currentColor" />
                            <path d="M12 0H22C28.6274 0 34 5.37258 34 12C34 18.6274 28.6274 24 22 24H12V0Z" fill="currentColor" />
                        </svg>
                    </div>

                    <h2 className="text-2xl font-bold tracking-tight mb-3">Satu Langkah Lagi!</h2>
                    <p className="text-gray-400 text-sm leading-relaxed mb-8">
                        Akun <span className="text-white font-medium">{email}</span> berhasil dibuat.
                        Selesaikan pembayaran untuk mengaktifkan akses <span className="text-blue-500 font-semibold">Visora Pro</span> Anda.
                    </p>

                    <div className="space-y-3">
                        <button
                            onClick={() => window.location.href = '/formorder'}
                            className="w-full py-4 bg-white text-black rounded-2xl font-semibold text-[15px] hover:bg-gray-200 transition-all active:scale-[0.98] shadow-xl shadow-white/5"
                        >
                            Lanjutkan Pembayaran
                        </button>

                        <button
                            onClick={handleCheck}
                            disabled={checking}
                            className="w-full py-4 bg-white/5 text-white rounded-2xl font-medium text-[15px] border border-white/10 hover:bg-white/10 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {checking ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Mengecek...</span>
                                </>
                            ) : 'Saya Sudah Bayar'}
                        </button>
                    </div>

                    <button
                        onClick={() => supabase.auth.signOut()}
                        className="mt-8 text-xs text-gray-600 hover:text-gray-400 underline underline-offset-4 transition-colors"
                    >
                        Gunakan Akun Lain (Logout)
                    </button>
                </div>
            </div>
        </div>
    );
};

export const handleSignOut = () => supabase.auth.signOut();
