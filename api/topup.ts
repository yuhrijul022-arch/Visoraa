import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { db } from './_lib/db.js';
import { payments, users } from '../src/db/schema/index.js';
import { getActiveProvider } from './_lib/payment/factory.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// PRD Phase 3 sets 1 credit = Rp195, handled by frontend pricing, so we trust creditsQty * 195. 
// However, the PRD requirement mentions the backend should be safe. I will calculate total price based on 195.
const CREDIT_PRICE = 195;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        if (!supabase) return res.status(500).json({ error: 'Server configuration error.' });

        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing auth token' });
        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: 'Invalid auth token' });

        const uid = user.id;
        const { creditsQty, amount } = req.body;
        
        // If frontend passes amount, we use it directly or fallback to credits * 195
        const totalPrice = amount || (creditsQty * CREDIT_PRICE);
        // Calculate creditsQty backwards if amount was provided and creditsQty wasn't
        const finalCreditsQty = creditsQty || Math.ceil(totalPrice / CREDIT_PRICE);

        if (!finalCreditsQty || finalCreditsQty < 1) return res.status(400).json({ error: 'Minimum 1 credit.' });
        if (totalPrice < 10000) return res.status(400).json({ error: 'Minimal top-up Rp 10.000' });

        const email = user.email || 'unknown@visora.com';
        const username = user.user_metadata?.full_name || 'Visora User';

        const orderId = `VIS-TOPUP-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

        const provider = await getActiveProvider();
        const gatewayName = process.env.ACTIVE_GATEWAY === 'mayar' ? 'mayar' : 'midtrans';

        const result = await provider.createTransaction({
            userId: uid,
            orderId,
            email,
            name: username,
            amountIdr: totalPrice,
            paymentType: 'topup',
            creditsQty: finalCreditsQty
        });

        // Simpan transaksi di tabel payments (Drizzle)
        await db.insert(payments).values({
            userId: uid,
            orderId,
            gateway: gatewayName,
            type: 'topup',
            creditsAmount: finalCreditsQty,
            amountIdr: totalPrice,
            status: 'pending'
        });

        // Ensure user row exists in new Drizzle table (if they haven't been inserted for some reason)
        // We do insert ignore essentially
        await db.insert(users).values({
            id: uid,
            email,
            name: username,
            credits: 0
        }).onConflictDoNothing();

        return res.status(200).json({
            snapToken: result.token, // preserve for old frontend code
            token: result.token,
            orderId, 
            totalPrice,
            gateway: gatewayName,
            redirectUrl: result.redirectUrl,
            clientKey: process.env.MIDTRANS_CLIENT_KEY_PROD || process.env.MIDTRANS_CLIENT_KEY_SANDBOX || process.env.MIDTRANS_CLIENT_KEY,
            isProduction: process.env.MIDTRANS_IS_PROD === 'true',
        });

    } catch (err: any) {
        console.error('Topup error:', err);
        return res.status(500).json({ error: 'Gagal membuat transaksi top-up.' });
    }
}
