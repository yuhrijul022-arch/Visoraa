import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { fal } from '@fal-ai/client';
import { checkAndIncrementInfiniteUsage, getInfiniteStatus } from './_lib/infinite/rateLimit.js';
import { recordZeroCostGeneration } from './_lib/infinite/usageLogger.js';
import { EntitlementResolver } from '../src/lib/entitlements.js';

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
        
        // Verify Entitlement
        const { data: dbUser } = await supabase.from('users').select('*').eq('id', uid).single();
        if (!dbUser) {
            return res.status(403).json({ error: 'User not found.' });
        }
        
        const rights = new EntitlementResolver({
            plan: dbUser.plan || 'free',
            infinite_enabled: dbUser.infiniteEnabled || false,
            status: dbUser.status || 'active'
        });

        if (!rights.canUseInfinite) {
            return res.status(403).json({ error: 'Infinite Mode is only available for Pro users.' });
        }

        const { productImage, promptText, textMode } = req.body;
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

        // Generate with Fal.ai Flux Schnell
        const baseStrength = textMode === 'on' ? 0.30 : 0.55; 
        const optimizedPrompt = `Professional product photography. Preserve exact product shape, label placement, packaging geometry, and brand marks. Only change environment, lighting, and scene styling. ${promptText}. 8k, highly detailed.`;

        const result: any = await fal.subscribe("fal-ai/flux-schnell", {
            input: {
                prompt: optimizedPrompt,
                image_size: "landscape_4_3",
                num_inference_steps: 4,
                num_images: 1,
                image_url: productImage,
                strength: baseStrength
            },
            logs: true,
        });

        const outputs = [];
        // The new @fal-ai/client returns result.data.images when successful, but let's handle safely:
        const imagesResult = result.data ? result.data.images : result.images;
        
        if (imagesResult && imagesResult.length > 0) {
            outputs.push({
                downloadUrl: imagesResult[0].url,
                mimeType: imagesResult[0].content_type || 'image/jpeg',
                storagePath: null 
            });
        } else {
            return res.status(500).json({ error: 'Failed to generate image from Fal AI.' });
        }

        // Log generation successfully
        try {
            await recordZeroCostGeneration(uid, 1200, promptText.substring(0, 500), outputs.map(o => o.downloadUrl));
        } catch (err: any) { 
            console.error('Failed to log zero cost generation:', err);
        }

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
