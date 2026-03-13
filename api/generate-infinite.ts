import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import * as fal from '@fal-ai/serverless-client';
import { checkAndIncrementInfiniteUsage, getInfiniteStatus } from './_lib/infinite/rateLimit.js';

fal.config({
    credentials: process.env.FAL_KEY || process.env.VITE_FAL_KEY
});

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(204).end();

    try {
        if (!supabase) return res.status(500).json({ error: 'Server configuration error.' });

        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing auth token' });
        
        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: 'Invalid auth token' });

        if (req.method === 'GET') {
            return await handleStatus(req, res, user.id);
        } else if (req.method === 'POST') {
            return await handleGenerate(req, res, user.id);
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err: any) {
        console.error('Infinite generic error:', err);
        return res.status(500).json({ error: 'Internal server error: ' + err.message });
    }
}

async function handleStatus(req: VercelRequest, res: VercelResponse, uid: string) {
    try {
        const status = await getInfiniteStatus(uid);
        return res.status(200).json(status);
    } catch (err: any) {
        console.error('Infinite status error:', err);
        return res.status(500).json({ error: 'Internal error' });
    }
}

async function handleGenerate(req: VercelRequest, res: VercelResponse, uid: string) {
    try {
        if (!supabase) throw new Error('Supabase uninitialized');
        
        // Verify Pro Plan
        const { data: dbUser } = await supabase.from('users').select('plan, infiniteEnabled').eq('id', uid).single();
        if (!dbUser || dbUser.plan !== 'pro' || !dbUser.infiniteEnabled) {
            return res.status(403).json({ error: 'Infinite Mode is only available for Pro users.' });
        }

        const { productImage, promptText, referenceImage } = req.body;
        if (!productImage || !promptText) return res.status(400).json({ error: 'Product image and prompt are required.' });

        // Check & Increment limits
        try {
            await checkAndIncrementInfiniteUsage(uid);
        } catch (e: any) {
            if (e.type === 'LIFETIME_LIMIT_REACHED') {
                return res.status(403).json({ error: "LIFETIME_LIMIT_REACHED", redirectTo: "/billing" });
            }
            if (e.type === 'DAILY_LIMIT_REACHED') {
                return res.status(429).json({ error: "Limit harian 30 tercapai. Coba lagi besok." });
            }
            throw e;
        }

        // Generate with Fal.ai Flux Schnell (No credit cost)
        const result: any = await fal.subscribe("fal-ai/flux-schnell", {
            input: {
                prompt: promptText,
                image_size: "landscape_4_3",
                num_inference_steps: 4,
                num_images: 1,
                image_url: productImage
            },
            logs: true,
        });

        const outputs = [];
        if (result && result.images && result.images.length > 0) {
            outputs.push({
                downloadUrl: result.images[0].url,
                mimeType: result.images[0].content_type || 'image/jpeg',
                storagePath: null 
            });
        } else {
            return res.status(500).json({ error: 'Failed to generate image from Fal AI.' });
        }

        // Log generation successfully
        try {
            await supabase.from('generation_logs').insert({
                user_id: uid,
                prompt: promptText.substring(0, 500),
                model: 'fal-ai/flux-schnell',
                status: 'success',
                credits_used: 0,
                refunded: false,
                image_urls: outputs.map(o => o.downloadUrl),
            } as never);
        } catch { }

        return res.status(200).json({
            status: "SUCCEEDED",
            outputs, 
            outputCount: outputs.length, 
            successCount: 1, 
            failedCount: 0,
            error: null,
            cost: 0
        });
    } catch (err: any) {
        console.error('Generate infinite error:', err);
        return res.status(500).json({ error: 'Internal server error: ' + err.message });
    }
}
