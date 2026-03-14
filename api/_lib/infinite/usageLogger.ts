import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function recordZeroCostGeneration(uid: string, latencyMs: number, promptText: string, imageUrls: string[]) {
    if (!supabase) return;
    try {
        await supabase.from('generation_logs').insert({
            user_id: uid,
            model: 'fal-ai/flux-schnell', // Matching the official name in generation
            status: 'success',
            credits_used: 0,
            refunded: false, 
            prompt: promptText,
            image_urls: imageUrls,
            latency_ms: latencyMs,
            generation_mode: 'infinite',
        } as never);
    } catch (err) {
        console.error("Failed to log zero cost generation", err);
    }
}
