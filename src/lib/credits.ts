import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

interface CreditState {
    credits: number;
    available: number;
    loading: boolean;
    refresh: () => Promise<void>;
    startFastPolling: () => void;
}

const CREDITS_FETCH_TIMEOUT = 10_000;

export function useCredits(uid: string | null): CreditState {
    const [credits, setCredits] = useState(0);
    const [loading, setLoading] = useState(true);
    const [fastPolling, setFastPolling] = useState(false);

    const fetchCredits = useCallback(async () => {
        if (!uid) {
            setCredits(0);
            setLoading(false);
            return;
        }
        try {
            const result = await Promise.race([
                supabase
                    .from('users')
                    .select('credits')
                    .eq('id', uid)
                    .single()
                    .then(res => res),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Credits fetch timeout')), CREDITS_FETCH_TIMEOUT)
                ),
            ]);

            if (result.data && !result.error) {
                const newCredits = (result.data as any).credits ?? 0;
                setCredits((prev) => {
                    if (fastPolling && newCredits > prev) {
                        setFastPolling(false);
                    }
                    return newCredits;
                });
            }
        } catch (e) {
            console.warn('[Credits] fetch error:', e);
        }
        setLoading(false);
    }, [uid, fastPolling]);

    useEffect(() => {
        fetchCredits();

        const interval = setInterval(fetchCredits, fastPolling ? 3000 : 30000);
        const guard = setTimeout(() => setLoading(false), 5000);

        let channel: ReturnType<typeof supabase.channel> | null = null;
        if (uid) {
            channel = supabase.channel(`public:users:id=eq.${uid}`)
                .on(
                    'postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${uid}` },
                    (payload) => {
                        if (payload.new && 'credits' in payload.new) {
                            setCredits((prev) => {
                                const newCredits = Number(payload.new.credits);
                                if (fastPolling && newCredits > prev) {
                                    setFastPolling(false);
                                }
                                return newCredits;
                            });
                        }
                    }
                )
                .subscribe();
        }

        return () => {
            clearInterval(interval);
            clearTimeout(guard);
            if (channel) supabase.removeChannel(channel);
        };
    }, [uid, fetchCredits, fastPolling]);

    return {
        credits,
        available: credits,
        loading,
        refresh: fetchCredits,
        startFastPolling: () => setFastPolling(true),
    };
}
