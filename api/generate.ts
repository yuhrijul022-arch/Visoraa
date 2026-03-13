import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';
import { db } from './_lib/db';
import { users } from '../src/db/schema/users';
import { calculateCost } from './_lib/credits/costCalculator';
import { PlanType } from './_lib/payment/types';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openrouterApiKey = process.env.OPENROUTER_API_KEY!;

const MODELS: Record<string, { model: string; creditCost: number }> = {
    standard: { model: 'google/gemini-3.1-flash-image-preview', creditCost: 1 },
    pro: { model: 'google/gemini-3-pro-image-preview', creditCost: 2 },
};

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ── Config ──
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;
const FAIL_MAX = 5;
const COOLDOWN_MS = 180_000;
const TIMEOUT_MS = 120_000;
const MIN_INTERVAL_MS = 3_000;

// ── Bot detection ──
const BOT_PATTERNS = [/bot/i, /crawl/i, /spider/i, /curl/i, /wget/i, /python-requests/i, /go-http-client/i];
function isBot(ua: string | undefined): boolean {
    if (!ua || ua.length < 10) return true;
    return BOT_PATTERNS.some(p => p.test(ua));
}

// ── Rate limit helpers ──
async function getRateLimitData(uid: string) {
    const { data } = await supabase.from('generation_rate_limits').select('*').eq('user_id', uid).single();
    return data as any;
}

async function upsertRateLimitData(uid: string, updates: Record<string, any>) {
    await supabase.from('generation_rate_limits')
        .upsert({ user_id: uid, ...updates, updated_at: new Date().toISOString() } as never, { onConflict: 'user_id' } as any);
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

function parseBase64(dataUri: string): { data: string; mimeType: string } {
    if (dataUri.startsWith("data:")) {
        const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
        if (match) return { mimeType: match[1], data: match[2] };
    }
    return { data: dataUri, mimeType: "image/png" };
}

// ── Prompt builder for Visora ──
function buildVisoraPrompt(body: any, hasRef: boolean): string {
    const { customPrompt, textMode, brandName, headline, benefit, price, cta, matchStrength } = body;

    const hasUserText = Boolean(brandName || headline || benefit || price || cta || customPrompt);
    let TEXT_MODE = 'OFF';
    if (textMode === 'on') TEXT_MODE = 'ON';
    else if (textMode === 'off') TEXT_MODE = 'OFF';
    else TEXT_MODE = hasUserText ? 'ON' : 'OFF';

    let prompt = `You are NanoBanana Visual Replication Engine (Visora Production).
Return FINAL IMAGE ONLY. No JSON. No explanations.

INPUTS:
- product_image: provided
- reference_image: ${hasRef ? 'provided' : 'none'}
- custom_prompt: ${customPrompt || 'none'}
- match_strength: ${matchStrength || 50}
- TEXT_MODE: ${TEXT_MODE}

`;

    if (TEXT_MODE === 'ON') {
        prompt += `USER COPY:
- brand_name: ${brandName || ''}
- headline: ${headline || ''}
- benefit: ${benefit || ''}
- price: ${price || ''}
- cta: ${cta || ''}

`;
    }

    prompt += `PRIORITY CONTRACT:
1. SAFETY: Preserve product identity, never hallucinate packaging text, keep photorealistic.
2. CUSTOM PROMPT: Use as creative modifier for mood/lighting/background.
3. REFERENCE: Match pose/crop/composition/elements if provided.
4. DEFAULTS: Clean modern default if no reference.

`;

    if (TEXT_MODE === 'OFF') {
        prompt += `TEXT_MODE OFF: Output must contain NO overlay marketing text. Only packaging text allowed.\n`;
    } else {
        prompt += `TEXT_MODE ON: Overlay text allowed. Use provided copy. Never invent price numbers.\n`;
    }

    if (hasRef) {
        prompt += `\nREFERENCE SIMILARITY: Replace reference product with provided product. Preserve composition, lighting, depth, and pose geometry.\n`;
    }

    prompt += `\nNo watermarks. Output high-quality marketing image.`;

    if (customPrompt) {
        prompt += `\nAdditional: ${customPrompt}`;
    }

    return prompt;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return res.status(204).end();
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
        // Bot check
        if (isBot(req.headers['user-agent'] as string)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // Auth check
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing auth token' });
        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: 'Invalid auth token' });

        const uid = user.id;
        const { productImage, referenceImage, mode } = req.body;

        if (!productImage) return res.status(400).json({ error: 'Product image is required.' });

        const modelConfig = MODELS[mode || 'standard'] || MODELS.standard;
        const numImages = Math.min(Math.max(Number(req.body.qty) || 1, 1), 4);
        
        // Fetch user plan and credits using Drizzle
        const dbUser = await db.query.users.findFirst({ where: eq(users.id, uid) });
        if (!dbUser) return res.status(404).json({ error: 'User not found.' });

        // Calculate credit cost
        const combinedUserInput = `${req.body.customPrompt || ''} ${req.body.headline || ''} ${req.body.benefit || ''}`;
        const baseCostPerImage = calculateCost(combinedUserInput, (dbUser.plan as PlanType) || 'basic');
        const totalCreditCost = numImages * baseCostPerImage;

        // Rate limit
        let rateData = await getRateLimitData(uid);
        const now = Date.now();

        if (rateData?.is_generating) {
            return res.status(429).json({ error: 'Kamu masih punya proses generate yang berjalan.', retryAfter: 10 });
        }

        if (rateData?.request_timestamps?.length > 0) {
            const last = new Date(rateData.request_timestamps[rateData.request_timestamps.length - 1]).getTime();
            if (now - last < MIN_INTERVAL_MS) {
                return res.status(429).json({ error: 'Server sedang sibuk, coba beberapa saat lagi.', retryAfter: 3 });
            }
        }

        if (rateData?.request_timestamps) {
            const windowStart = now - RATE_LIMIT_WINDOW_MS;
            const recent = (rateData.request_timestamps as string[]).filter((ts: string) => new Date(ts).getTime() > windowStart);
            if (recent.length >= RATE_LIMIT_MAX) {
                return res.status(429).json({ error: 'Batas generate tercapai (maks 5 per menit). Coba beberapa saat lagi.', retryAfter: 60 });
            }
        }

        if (rateData?.fail_count >= FAIL_MAX && rateData?.last_fail_at) {
            const timeSince = now - new Date(rateData.last_fail_at).getTime();
            if (timeSince < COOLDOWN_MS) {
                const remaining = Math.ceil((COOLDOWN_MS - timeSince) / 1000);
                return res.status(429).json({ error: `Server sedang sibuk. Coba lagi dalam ${remaining} detik.`, retryAfter: remaining });
            }
            await upsertRateLimitData(uid, { fail_count: 0, last_fail_at: null });
            rateData = { ...rateData, fail_count: 0, last_fail_at: null };
        }

        // Credit check
        if (dbUser.credits < totalCreditCost) {
            return res.status(402).json({ error: `Credit tidak cukup. Tersedia: ${dbUser.credits}, dibutuhkan: ${totalCreditCost}` });
        }

        // Set generating lock
        const currentTs = (rateData?.request_timestamps || []) as string[];
        const windowStart = now - RATE_LIMIT_WINDOW_MS;
        const filtered = currentTs.filter((ts: string) => new Date(ts).getTime() > windowStart);
        filtered.push(new Date().toISOString());
        await upsertRateLimitData(uid, { is_generating: true, request_timestamps: filtered });

        // Build prompt
        const promptText = buildVisoraPrompt(req.body, !!referenceImage);

        // Build content parts for OpenRouter
        const contentParts: any[] = [];
        const { data: prodData, mimeType: prodMime } = parseBase64(productImage);
        contentParts.push({ type: "image_url", image_url: { url: `data:${prodMime};base64,${prodData}` } });

        if (referenceImage) {
            const { data: refData, mimeType: refMime } = parseBase64(referenceImage);
            contentParts.push({ type: "image_url", image_url: { url: `data:${refMime};base64,${refData}` } });
        }
        contentParts.push({ type: "text", text: promptText });

        // Generate single image
        const generateSingleImage = async (index: number): Promise<{ downloadUrl: string; storagePath: string; mimeType: string }> => {
            const openrouterResponse = await fetchWithTimeout(
                "https://openrouter.ai/api/v1/chat/completions",
                {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${openrouterApiKey}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": process.env.VITE_SITE_URL || "https://visora.vercel.app",
                        "X-Title": "Visora",
                    },
                    body: JSON.stringify({
                        model: modelConfig.model,
                        modalities: ["image", "text"],
                        stream: false,
                        messages: [{ role: "user", content: contentParts }],
                    }),
                },
                TIMEOUT_MS
            );

            if (!openrouterResponse.ok) {
                const errText = await openrouterResponse.text();
                throw new Error(`OpenRouter API error (${openrouterResponse.status}): ${errText.substring(0, 200)}`);
            }

            const data = await openrouterResponse.json();
            let imageData: string | null = null;
            let imageMime = "image/png";

            const choices = data.choices;
            if (choices?.[0]?.message) {
                const message = choices[0].message;
                // Priority 1: message.images[]
                if (message.images?.length > 0) {
                    for (const img of message.images) {
                        const url = img?.image_url?.url || img?.url;
                        if (url?.startsWith('data:')) {
                            const m = url.match(/^data:([^;]+);base64,(.+)$/);
                            if (m) { imageMime = m[1]; imageData = m[2]; break; }
                        }
                    }
                }
                // Priority 2: message.content (array)
                if (!imageData && Array.isArray(message.content)) {
                    for (const part of message.content) {
                        if (part.type === 'image_url' && part.image_url?.url?.startsWith('data:')) {
                            const m = part.image_url.url.match(/^data:([^;]+);base64,(.+)$/);
                            if (m) { imageMime = m[1]; imageData = m[2]; }
                            break;
                        }
                    }
                }
                // Priority 3: string content
                if (!imageData && typeof message.content === 'string') {
                    const m = message.content.match(/data:image\/([^;]+);base64,([A-Za-z0-9+/=]+)/);
                    if (m) { imageMime = `image/${m[1]}`; imageData = m[2]; }
                }
            }

            if (!imageData) throw new Error("No image data in OpenRouter response");

            // Upload to Supabase Storage
            const ext = imageMime.includes("jpeg") || imageMime.includes("jpg") ? "jpg" : "png";
            const filePath = `${uid}/${Date.now()}-${index}.${ext}`;
            const buffer = Buffer.from(imageData, "base64");
            const { error: uploadError } = await supabase.storage.from('outputs').upload(filePath, buffer, { contentType: imageMime, upsert: false });
            if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);
            const { data: urlData } = supabase.storage.from('outputs').getPublicUrl(filePath);
            return { downloadUrl: urlData.publicUrl, storagePath: filePath, mimeType: imageMime };
        };

        // Fire all in parallel
        const promises = Array.from({ length: numImages }, (_, i) => generateSingleImage(i));
        const results = await Promise.allSettled(promises);

        const outputs: Array<{ downloadUrl: string; storagePath: string; mimeType: string }> = [];
        let successCount = 0;
        let failedCount = 0;
        let lastError = "";

        for (const result of results) {
            if (result.status === 'fulfilled') { outputs.push(result.value); successCount++; }
            else {
                failedCount++;
                lastError = result.reason?.name === 'AbortError' ? 'Server sedang sibuk, coba beberapa saat lagi.' : (result.reason?.message || 'Unknown');
            }
        }

        // Deduct credits only for successful generations
        if (successCount > 0) {
            const actualCost = successCount * baseCostPerImage;
            const { error: rpcError } = await supabase.rpc('deduct_credits_safe', { p_user_id: uid, p_amount: actualCost });
            if (rpcError) {
                await db.update(users).set({ credits: Math.max(0, dbUser.credits - actualCost) }).where(eq(users.id, uid));
            }

            // Log generation
            try {
                await supabase.from('generation_logs').insert({
                    user_id: uid,
                    prompt: promptText.substring(0, 500),
                    model: modelConfig.model,
                    status: failedCount > 0 ? 'partial' : 'success',
                    credits_used: actualCost,
                    refunded: false,
                    image_urls: outputs.map(o => o.downloadUrl),
                } as never);
            } catch { }

            await upsertRateLimitData(uid, { is_generating: false, fail_count: 0, last_fail_at: null });
        } else {
            // All failed — increment failure, log refund
            const newFailCount = (rateData?.fail_count || 0) + 1;
            await upsertRateLimitData(uid, { is_generating: false, fail_count: newFailCount, last_fail_at: new Date().toISOString() });

            try {
                await supabase.from('generation_logs').insert({
                    user_id: uid,
                    prompt: promptText.substring(0, 500),
                    model: modelConfig.model,
                    status: 'failed',
                    credits_used: 0,
                    refunded: true,
                } as never);
            } catch { }
        }

        return res.status(200).json({
            status: successCount === numImages ? "SUCCEEDED" : successCount > 0 ? "PARTIAL" : "FAILED",
            outputs, outputCount: outputs.length, successCount, failedCount,
            error: failedCount > 0 ? lastError : null,
        });

    } catch (err: any) {
        // Release lock on crash
        try {
            const authHeader = req.headers.authorization;
            if (authHeader?.startsWith('Bearer ')) {
                const { data: { user } } = await supabase.auth.getUser(authHeader.split(' ')[1]);
                if (user) await upsertRateLimitData(user.id, { is_generating: false });
            }
        } catch { }

        const message = err?.name === 'AbortError' ? 'Server sedang sibuk, coba beberapa saat lagi.' : (err.message || "Internal server error");
        return res.status(500).json({ error: message });
    }
}
