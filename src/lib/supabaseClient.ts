import { createClient, SupabaseClient } from '@supabase/supabase-js';

const getEnvVar = (viteKey: string, nodeKey: string) => {
    if (typeof process !== 'undefined' && process.env && process.env[nodeKey]) {
        return process.env[nodeKey];
    }
    try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[viteKey]) {
            // @ts-ignore
            return import.meta.env[viteKey];
        }
    } catch (e) { }
    return '';
};

const SUPABASE_URL = getEnvVar('VITE_SUPABASE_URL', 'SUPABASE_URL');
const SUPABASE_KEY = getEnvVar('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY');

if (!SUPABASE_URL || !SUPABASE_KEY) {
    if (typeof console !== 'undefined') console.warn("Missing Supabase env vars");
}

let _client: SupabaseClient<any, 'public', any>;

export const getSupabaseClient = () => {
    if (!_client) {
        _client = createClient(SUPABASE_URL as string, SUPABASE_KEY as string, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                storageKey: 'visora-auth-token'
            }
        });
    }
    return _client;
};

export const supabase = getSupabaseClient();
